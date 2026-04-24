/**
 * SERVICIO: whatsapp.ts
 * DESCRIPCIÓN: Gestión de envío de mensajes vía WhatsApp usando Green API, Whapi o Meta (Business API).
 * PORTADO DE: Apps Script v4.1 + Soporte Meta API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export type WhatsAppService = 'GREENAPI' | 'WHAPI' | 'BUSINESS';

interface WhatsAppCredentials {
  service_type: WhatsAppService;
  instance_id?: string;
  api_token: string;
  api_url?: string;
  phone_number_id?: string; // Para Meta Business
}

/**
 * Obtiene las credenciales activas para un servicio específico
 */
async function getCredentials(service: WhatsAppService): Promise<WhatsAppCredentials> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_credentials')
    .select('*')
    .eq('service_type', service)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`Credenciales no encontradas para el servicio ${service}`);
  }

  return data as WhatsAppCredentials;
}

/**
 * Registra el envío en la cola de WhatsApp
 */
async function logToQueue(
  building_id: string,
  phone: string,
  message: string,
  status: 'sent' | 'failed',
  error?: string
) {
  await supabaseAdmin.from('whatsapp_queue').insert({
    building_id,
    recipient_phone: phone,
    message_text: message,
    status,
    error_message: error || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    attempts: 1
  });
}

/**
 * Envío vía Green API
 */
async function sendViaGreenApi(creds: WhatsAppCredentials, phone: string, message: string) {
  const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
  const url = `${creds.api_url}/waInstance${creds.instance_id}/sendMessage/${creds.api_token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.idMessage;
}

/**
 * Envío vía Whapi
 */
async function sendViaWhapi(creds: WhatsAppCredentials, phone: string, message: string) {
  const chatId = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  const url = `${creds.api_url}/messages/text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.api_token}`
    },
    body: JSON.stringify({ to: chatId, body: message })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.id || data.sent_message_id;
}

/**
 * Envío vía WhatsApp Business (Meta Graph API)
 */
async function sendViaMeta(creds: WhatsAppCredentials, phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v18.0/${creds.phone_number_id}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.api_token}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: message }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.messages[0].id;
}

/**
 * Función principal de envío
 */
export async function sendWhatsApp(
  building_id: string,
  phones: string | string[],
  message: string,
  serviceOverride?: WhatsAppService
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener configuración del edificio
    const { data: settings } = await supabaseAdmin
      .from('building_whatsapp_settings')
      .select('*')
      .eq('building_id', building_id)
      .single();

    if (!settings?.is_enabled && !serviceOverride) {
      return { success: false, error: 'Servicio WhatsApp desactivado para este edificio' };
    }

    const service = serviceOverride || (settings?.preferred_service as WhatsAppService) || 'GREENAPI';
    
    // Priorizar credenciales del edificio, si no, usar las globales
    let creds: WhatsAppCredentials;
    
    if (settings?.wa_api_token || settings?.wa_business_phone_number_id) {
      creds = {
        service_type: service,
        instance_id: settings.wa_instance_id,
        api_token: settings.wa_api_token,
        api_url: settings.wa_api_url || (service === 'GREENAPI' ? 'https://api.greenapi.com' : 'https://gate.whapi.cloud'),
        phone_number_id: settings.wa_business_phone_number_id
      };
    } else {
      creds = await getCredentials(service);
    }
    
    const phoneList = Array.isArray(phones) ? phones : phones.split(',').map(p => p.trim());
    
    let lastError = '';
    let successCount = 0;

    for (const phone of phoneList) {
      try {
        if (service === 'GREENAPI') {
          await sendViaGreenApi(creds, phone, message);
        } else if (service === 'WHAPI') {
          await sendViaWhapi(creds, phone, message);
        } else if (service === 'BUSINESS') {
          await sendViaMeta(creds, phone, message);
        }
        await logToQueue(building_id, phone, message, 'sent');
        successCount++;
      } catch (err: any) {
        lastError = err.message;
        await logToQueue(building_id, phone, message, 'failed', err.message);
      }
    }

    return { 
      success: successCount > 0, 
      error: successCount === 0 ? lastError : undefined 
    };

  } catch (err: any) {
    console.error('Error en sendWhatsApp:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Lógica de alertas por umbral de agua
 */
export async function checkWaterLevelThresholds(
  building_id: string,
  building_name: string,
  percentage: number,
  liters: number
) {
  const { data: settings } = await supabaseAdmin
    .from('building_whatsapp_settings')
    .select('*')
    .eq('building_id', building_id)
    .single();

  if (!settings || !settings.is_enabled || !settings.junta_phones) return;

  const p = Math.round(percentage);
  let thresholdHit = 0;
  let alertType = '';
  let emoji = '';

  // Determinar si cruzamos un umbral hacia abajo
  if (p <= settings.threshold_critical) {
    thresholdHit = settings.threshold_critical;
    alertType = '🚨 NIVEL CRÍTICO';
    emoji = '🔴';
  } else if (p <= settings.threshold_rationing) {
    thresholdHit = settings.threshold_rationing;
    alertType = '⚠️ RACIONAMIENTO PREVENTIVO';
    emoji = '🟠';
  } else if (p <= settings.threshold_caution) {
    thresholdHit = settings.threshold_caution;
    alertType = '📢 PRECAUCIÓN';
    emoji = '🟡';
  }

  // Si no hay umbral alcanzado o es el mismo que el anterior, no enviamos nada
  // (Esto evita spam si el nivel fluctúa ligeramente en el mismo nivel)
  if (thresholdHit === 0 || thresholdHit === settings.last_threshold_notified) {
    // Si el nivel subió por encima del umbral de precaución, resetear el last_threshold
    if (p > settings.threshold_caution && settings.last_threshold_notified !== null) {
      await supabaseAdmin
        .from('building_whatsapp_settings')
        .update({ last_threshold_notified: null })
        .eq('building_id', building_id);
    }
    return;
  }

  const message = `*AquaSaaS - Alerta de Tanque*\n\n` +
    `${emoji} *${alertType}*\n` +
    `🏢 Edificio: ${building_name}\n` +
    `💧 Nivel Actual: ${p}%\n` +
    `🛢️ Litros Aprox: ${Math.round(liters).toLocaleString()}L\n\n` +
    `_Este es un mensaje automático del sistema de monitoreo._`;

  const result = await sendWhatsApp(building_id, settings.junta_phones, message);

  if (result.success) {
    // Actualizar el último umbral notificado
    await supabaseAdmin
      .from('building_whatsapp_settings')
      .update({ last_threshold_notified: thresholdHit })
      .eq('building_id', building_id);
  }
}
