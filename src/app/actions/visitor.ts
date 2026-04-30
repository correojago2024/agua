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
    const host = headerList.get('host') || 'agua-rust.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // Detectar la URL real dinámicamente
    let path = '/';
    if (pageType === 'formulario') path = `/edificio/${slug}`;
    if (pageType === 'portal') path = `/edificio-admin/${slug}`;
    
    const fullUrl = `${protocol}://${host}${path}`;

    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || headerList.get('x-real-ip') || 'unknown';
    const userAgent = headerList.get('user-agent') || 'unknown';
    const language = headerList.get('accept-language')?.split(',')[0] || 'unknown';
    const country = headerList.get('x-vercel-ip-country') || 'unknown';
    const city = headerList.get('x-vercel-ip-city') || 'unknown';
    const region = headerList.get('x-vercel-ip-country-region') || 'unknown';
    const platform = headerList.get('sec-ch-ua-platform') || 'unknown';
    
    // 1. Guardar la nueva visita
    const { error: insertError } = await supabaseAdmin.from('visitor_logs').insert({
      page_type: pageType,
      target_name: targetName,
      url: fullUrl,
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

    // 2. Obtener el umbral configurado
    const { data: thresholdData } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'visitor_notification_threshold')
      .single();
    
    let threshold = 10;
    if (thresholdData?.value) {
      const val = thresholdData.value;
      threshold = parseInt(typeof val === 'object' ? JSON.stringify(val).replace(/"/g, '') : String(val));
    }

    // 3. INTENTO ATÓMICO: Seleccionar IDs pendientes y tratar de marcarlos como 'notified'
    // Primero vemos cuántos hay
    const { data: pending } = await supabaseAdmin
      .from('visitor_logs')
      .select('id')
      .eq('notified', false)
      .order('created_at', { ascending: true });

    if (pending && pending.length >= threshold) {
      const idsToMark = pending.map(p => p.id);
      
      // Intentamos actualizar estos registros específicos a notified=true
      // Solo aquellos que sigan siendo false (evita doble envío si hay concurrencia)
      const { data: marked, error: updateError } = await supabaseAdmin
        .from('visitor_logs')
        .update({ notified: true })
        .in('id', idsToMark)
        .eq('notified', false)
        .select();

      if (updateError) {
        console.error('Error al marcar visitas como notificadas:', updateError);
        return { success: false };
      }

      // 4. SOLO si logramos marcar registros (evita duplicados), enviamos el email
      if (marked && marked.length > 0) {
        const visitDetails = marked.map(v => `
          <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; list-style: none;">
            <p style="margin: 0; font-weight: bold; color: #1e40af;">📍 ${v.page_type.toUpperCase()}: ${v.target_name}</p>
            <p style="margin: 2px 0; font-size: 13px; color: #475569;"><b>URL:</b> ${v.url}</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>🌍 Ubicación:</b> ${v.city || '?'}, ${v.country || '?'} (${v.ip_address})</p>
            <p style="margin: 2px 0; font-size: 13px;"><b>💻 Dispositivo:</b> ${v.platform} | ${v.language}</p>
            <p style="margin: 2px 0; font-size: 13px; color: #94a3b8;"><b>⏰ Fecha:</b> ${new Date(v.created_at).toLocaleString('es-ES')}</p>
          </li>
        `).join('');

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.025em;">🚀 Reporte de Visitas</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Automatización aGuaSaaS detectada</p>
            </div>
            <div style="padding: 30px; background-color: white;">
              <p style="font-size: 16px;">Hola <b>correojago</b>,</p>
              <p style="color: #64748b;">Se han procesado <b>${marked.length}</b> nuevas visitas. Aquí tienes el resumen:</p>
              
              <div style="margin-top: 25px;">
                ${visitDetails}
              </div>
              
              <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin-top: 30px; text-align: center; border: 1px dashed #cbd5e1;">
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  Este es un mensaje automático del sistema de monitoreo.<br>
                  Solo se incluyen las visitas detectadas desde el último reporte.
                </p>
              </div>
            </div>
          </div>
        `;

        const { sendEmailViaGmail } = await import('@/lib/server/email');
        await sendEmailViaGmail(
          ['correojago@gmail.com'],
          `🔔 Resumen de ${marked.length} visitas nuevas en aGuaSaaS`,
          emailHtml,
          null,
          'visitor_report'
        );
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error en recordVisit:', error);
    return { success: false };
  }
}
