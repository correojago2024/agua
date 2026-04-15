/**
 * ARCHIVO: route.ts (API de Envío de Emails de Contacto via Gmail)
 * VERSION: 2.0
 * PROYECTO: AquaSaaS
 * REFACTOR: Se adoptó la estructura robusta de 'measurements/route.ts' para el envío de emails,
 *           incluyendo logging a la tabla 'email_queue'.
 */

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase server-side para leer email_credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// ════════════════════════════════════════════════════════════════════════════
// GMAIL — obtener transporter con credenciales de Supabase
// ════════════════════════════════════════════════════════════════════════════
async function getGmailTransporter(): Promise<{ transporter: nodemailer.Transporter; fromEmail: string }> {
  console.log('[GMAIL] Leyendo credenciales de email_credentials...');
  let { data, error } = await supabaseAdmin
    .from('email_credentials')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) {
    console.warn('[GMAIL] No se encontró id=1, buscando cualquier registro...');
    const fallback = await supabaseAdmin
      .from('email_credentials')
      .select('*')
      .limit(1)
      .single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.error('[GMAIL] Error consultando email_credentials:', error.message);
    throw new Error('Error consultando email_credentials: ' + error.message);
  }
  if (!data) {
    throw new Error('Tabla email_credentials vacía — no hay credenciales configuradas');
  }
  console.log('[GMAIL] Credenciales encontradas. email_user:', data.email_user ? data.email_user.substring(0, 6) + '***' : 'VACÍO');
  if (!data.email_user || !data.email_password) {
    throw new Error('email_credentials incompleto: faltan email_user o email_password');
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: data.email_user,
      pass: data.email_password,
    },
  });
  return { transporter, fromEmail: data.email_user };
}

// ════════════════════════════════════════════════════════════════════════════
// email_queue — guardar registro de auditoría
// ════════════════════════════════════════════════════════════════════════════
async function saveToEmailQueue(
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  emailType: string,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string
) {
  console.log(`[EMAIL_QUEUE] → tipo:${emailType} | destinatario:${recipientEmail.substring(0,5)}*** | estado:${status}`);
  const { error: queueError } = await supabaseAdmin.from('email_queue').insert({
    // building_id es omitido ya que no aplica en el formulario de contacto
    recipient_email: recipientEmail,
    subject: subject,
    html_content: htmlContent,
    email_type: emailType,
    status: status,
    attempts: 1,
    max_attempts: 3,
    last_attempt: new Date().toISOString(),
    error_message: errorMessage || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });
  if (queueError) {
    console.warn('[EMAIL_QUEUE] No se pudo guardar en email_queue:', queueError.message);
  } else {
    console.log('[EMAIL_QUEUE] ✅ Registro guardado');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Envío de email con Gmail + registro en email_queue
// ════════════════════════════════════════════════════════════════════════════
async function sendEmailViaGmail(
  to: string[],
  subject: string,
  html: string,
  emailType: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[SEND_EMAIL] ── Iniciando envío Gmail para ${emailType} ──────────────────────`);
  let transporter: nodemailer.Transporter;
  let fromEmail: string;

  try {
    ({ transporter, fromEmail } = await getGmailTransporter());
  } catch (credErr: any) {
    console.error('[SEND_EMAIL] ❌ Error obteniendo transporter:', credErr.message);
    for (const email of to) {
      await saveToEmailQueue(email, subject, html, emailType, 'failed', credErr.message);
    }
    return { success: false, error: credErr.message };
  }

  try {
    const info = await transporter.sendMail({
      from: `"AquaSaaS Contact" <${fromEmail}>`,
      to: to.join(', '),
      subject: subject,
      html: html,
    });
    console.log('[SEND_EMAIL] ✅ Email enviado. messageId:', info.messageId);
    for (const email of to) {
      await saveToEmailQueue(email, subject, html, emailType, 'sent', 'messageId: ' + info.messageId);
    }
    return { success: true, messageId: info.messageId };
  } catch (sendErr: any) {
    console.error('[SEND_EMAIL] ❌ Error en sendMail:', sendErr.message);
    for (const email of to) {
      await saveToEmailQueue(email, subject, html, emailType, 'failed', sendErr.message);
    }
    return { success: false, error: sendErr.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Recibir datos del formulario de contacto y enviar email
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  console.log('=== INICIO API /api/contact (v2.0) ===');
  
  try {
    const body = await request.json();
    const { nombre_apellido, nombre_edificio, rol, email, whatsapp, mensaje } = body;

    const subject = 'Nuevo Mensaje de Contacto desde AquaSaaS';
    const recipient = 'correojago@gmail.com';
    const emailType = 'contact_form';

    const htmlContent = `
      <h1>Nuevo Contacto desde la Web</h1>
      <p><strong>Nombre y Apellido:</strong> ${nombre_apellido}</p>
      <p><strong>Nombre del Edificio:</strong> ${nombre_edificio}</p>
      <p><strong>Rol:</strong> ${rol}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>WhatsApp:</strong> ${whatsapp}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${mensaje}</p>
    `;

    const result = await sendEmailViaGmail(
      [recipient],
      subject,
      htmlContent,
      emailType
    );

    if (result.success) {
      console.log('Email de contacto enviado exitosamente! ID:', result.messageId);
      return NextResponse.json({ success: true, message: 'Email de contacto enviado.' });
    } else {
      console.error('Fallo el envío del email de contacto. Revisar email_queue para detalles.');
      return NextResponse.json({ error: 'Error al enviar el email', details: result.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error('ERROR GENERAL en API /api/contact:', error);
    // Loguear el intento fallido incluso si el error es general antes del envío
    await saveToEmailQueue(
      'correojago@gmail.com',
      'Intento de contacto fallido (Error General)',
      `Error: ${error.message}`,
      'contact_form_error',
      'failed',
      error.message
    );
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

