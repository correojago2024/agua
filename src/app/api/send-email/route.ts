/**
 * ARCHIVO: route.ts (API de Envío de Emails via Gmail + Supabase - VERSIÓN ULTRA-ROBUSTA)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { supabase } from '@/lib/supabase';

const getSiteUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
};

const DEFAULT_TEMPLATES: Record<string, { subject: string, body: string }> = {
  welcome: {
    subject: '🎉 Bienvenido a AquaSaaS - {building_name}',
    body: `<h1>¡Bienvenido!</h1><p>Su edificio <strong>{building_name}</strong> ha sido registrado exitosamente.</p>`
  },
  measurement_report: {
    subject: '💧 Reporte de Agua: {building_name}',
    body: `<h2>✨ Resumen de Agua ✨</h2><p>Edificio: {building_name}</p><p>Nivel actual: <strong>{current_count}%</strong></p>`
  },
  anomaly_alert: {
    subject: '⚠️ Anomalía Detectada - {building_name}',
    body: `<h2 style="color:red;">⚠️ ALERTA CRÍTICA</h2><p>Se detectó una variación inusual en {building_name}.</p>`
  },
  limit_90_storage: {
    subject: '⚠️ Alerta Almacenamiento 90% - {building_name}',
    body: `<h2>⚠️ Alerta de Límite</h2><p>Has alcanzado el 90% de almacenamiento de registros.</p>`
  },
  limit_90_emails: {
    subject: '📧 Alerta Emails 90% - {building_name}',
    body: `<h2>📧 Alerta de Emails</h2><p>Has alcanzado el 90% de tus emails mensuales.</p>`
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, building, member, template, to, building_id, subject: customSubject } = body;

    // --- PRIORIDAD 1: SI VIENE UN NOMBRE DE PLANTILLA (TEST DESDE ADMIN) ---
    const templateName = template || type;
    
    if (templateName) {
      // Intentar buscar en DB
      const { data: tpl } = await supabase
        .from('email_templates')
        .select('*')
        .eq('name', templateName)
        .single();

      let htmlBody = tpl?.body_es || DEFAULT_TEMPLATES[templateName]?.body || `<h3>Mensaje de Prueba: ${templateName}</h3><p>Este es un correo de prueba del sistema AquaSaaS.</p>`;
      let subject = customSubject || tpl?.subject_es || DEFAULT_TEMPLATES[templateName]?.subject || `AquaSaaS: ${templateName}`;

      // Reemplazo de variables
      const bName = building?.name || 'Edificio de Prueba';
      htmlBody = htmlBody.replace(/{building_name}/g, bName);
      htmlBody = htmlBody.replace(/{current_count}/g, body.current_count || '75');
      htmlBody = htmlBody.replace(/{max_count}/g, body.max_count || '169000');
      subject = subject.replace(/{building_name}/g, bName);

      const recipients = to || ['correojago@gmail.com'];
      const result = await sendEmailViaGmail(recipients, subject, htmlBody, building_id || building?.id || null, 'admin_test');
      return NextResponse.json({ success: result.success, error: result.error });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
  } catch (error: any) {
    console.error('[API-EMAIL-ERROR]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
