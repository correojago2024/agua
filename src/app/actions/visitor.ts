'use server';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function recordVisit(pageType: string, targetName: string, slug: string) {
  try {
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || headerList.get('x-real-ip') || 'unknown';
    const userAgent = headerList.get('user-agent') || 'unknown';
    const language = headerList.get('accept-language')?.split(',')[0] || 'unknown';
    const country = headerList.get('x-vercel-ip-country') || 'unknown';
    const city = headerList.get('x-vercel-ip-city') || 'unknown';
    const region = headerList.get('x-vercel-ip-country-region') || 'unknown';
    const platform = headerList.get('sec-ch-ua-platform') || 'unknown';
    
    // 1. Guardar en la tabla visitor_logs
    const { error: insertError } = await supabaseAdmin.from('visitor_logs').insert({
      page_type: pageType,
      target_name: targetName,
      url: `https://jgarciaotero46.pulse.is/edificio/${slug}`,
      ip_address: ip,
      user_agent: userAgent,
      platform: platform,
      language: language,
      country: country,
      city: city,
      region: region,
      notified: false
    });

    if (insertError) {
      console.error('Error guardando visita:', insertError);
      return { success: false };
    }

    // 2. Verificar umbral
    const { data: thresholdData } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'visitor_notification_threshold')
      .single();
    
    // Si no hay configuración, por defecto 10
    const threshold = thresholdData ? parseInt(typeof thresholdData.value === 'string' ? thresholdData.value : JSON.stringify(thresholdData.value)) : 10;

    // 3. Contar registros no notificados
    const { count } = await supabaseAdmin
      .from('visitor_logs')
      .select('*', { count: 'exact', head: true })
      .eq('notified', false);

    if (count && count >= threshold) {
      // 4. Obtener todos los registros no notificados
      const { data: unnotifiedLogs } = await supabaseAdmin
        .from('visitor_logs')
        .select('*')
        .eq('notified', false)
        .order('created_at', { ascending: false });

      if (unnotifiedLogs && unnotifiedLogs.length > 0) {
        // 5. Formatear email
        const visitDetails = unnotifiedLogs.map(v => `
          <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <p style="margin: 0; font-weight: bold; color: #1e40af;">Visitante en ${v.page_type}: ${v.target_name}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>URL:</b> ${v.url}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>IP:</b> ${v.ip_address} | <b>Ubicación:</b> ${v.city}, ${v.country}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>Navegador:</b> ${v.user_agent}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>Fecha:</b> ${new Date(v.created_at).toLocaleString('es-ES')}</p>
          </li>
        `).join('');

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px;">🚀 Reporte de Visitas Acumuladas</h1>
              <p style="margin: 5px 0 0; opacity: 0.9;">aGuaSaaS Automation</p>
            </div>
            <div style="padding: 20px;">
              <p>Hola <b>correojago</b>,</p>
              <p>Se ha alcanzado el umbral de <b>${threshold}</b> visitas configurado. Aquí tienes el detalle de los últimos <b>${unnotifiedLogs.length}</b> visitantes:</p>
              
              <ul style="list-style: none; padding: 0;">
                ${visitDetails}
              </ul>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #64748b;">
                  Este mensaje se envió automáticamente porque se alcanzó el límite de registros pendientes.
                  El contador ha sido reiniciado.
                </p>
              </div>
            </div>
          </div>
        `;

        // 6. Enviar email (a través de email_queue)
        const { saveToEmailQueue } = await import('@/lib/server/email');
        await saveToEmailQueue(
          'correojago@gmail.com',
          `¡Nuevo reporte de ${unnotifiedLogs.length} visitas en aGuaSaaS!`,
          emailHtml,
          'visitor_report',
          'pending'
        );

        // 7. Marcar como notificados
        const ids = unnotifiedLogs.map(l => l.id);
        await supabaseAdmin
          .from('visitor_logs')
          .update({ notified: true })
          .in('id', ids);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error en recordVisit:', error);
    return { success: false };
  }
}
