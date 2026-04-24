import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';

// Cliente administrativo privado
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function getGmailTransporter(): Promise<{ transporter: nodemailer.Transporter; fromEmail: string }> {
  // --- PRIORIDAD 1: VARIABLES DE ENTORNO (Vercel) ---
  const envUser = process.env.GMAIL_USER;
  const envPass = process.env.GMAIL_APP_PASSWORD;

  if (envUser && envPass) {
    console.log('[EMAIL] Usando credenciales de variables de entorno (ENV)');
    return createTransporter(envUser, envPass);
  }

  // --- PRIORIDAD 2: RESPALDO EN BASE DE DATOS (Supabase) ---
  console.log('[EMAIL] Variables de entorno no encontradas, intentando con Supabase...');
  const { data, error } = await supabaseAdmin
    .from('email_credentials')
    .select('email_user, email_password')
    .eq('id', 1)
    .single();
  
  if (error) {
    console.error('[DATABASE_ERROR] Falló el acceso a email_credentials:', error.message);
    
    // Intento de fallback: tomar el primer registro que encuentre
    const { data: fallback } = await supabaseAdmin
      .from('email_credentials')
      .select('email_user, email_password')
      .limit(1)
      .maybeSingle();

    if (!fallback) {
      throw new Error('No se encontraron credenciales de Gmail ni en ENV ni en Base de Datos.');
    }
    
    return createTransporter(fallback.email_user, fallback.email_password);
  }

  if (!data?.email_user || !data?.email_password) {
    throw new Error('Faltan credenciales de Gmail (ENV y DB vacíos).');
  }

  return createTransporter(data.email_user, data.email_password);
}

function createTransporter(user: string, pass: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return { transporter, fromEmail: user };
}

export async function saveToEmailQueue(
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  emailType: string,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string,
  building_id?: string
) {
  await supabaseAdmin.from('email_queue').insert({
    building_id: building_id || null,
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
}

export async function sendEmailViaGmail(
  to: string[],
  subject: string,
  html: string,
  building_id: string | null,
  emailType: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let transporter: nodemailer.Transporter;
  let fromEmail: string;

  try {
    ({ transporter, fromEmail } = await getGmailTransporter());
  } catch (err: any) {
    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'failed', err.message, building_id || undefined);
    return { success: false, error: err.message };
  }

  try {
    const info = await transporter.sendMail({
      from: `"AquaSaaS" <${fromEmail}>`,
      to: to.join(', '),
      subject: subject,
      html: html,
    });
    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'sent', undefined, building_id || undefined);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'failed', err.message, building_id || undefined);
    return { success: false, error: err.message };
  }
}
