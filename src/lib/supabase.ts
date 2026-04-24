import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are missing. Using placeholders for build.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente administrativo para operaciones sensibles (emails, logs)
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey)

// ════════════════════════════════════════════════════════════════════════════
// GMAIL — obtener transporter con credenciales de Supabase
// ════════════════════════════════════════════════════════════════════════════
export async function getGmailTransporter(): Promise<{ transporter: nodemailer.Transporter; fromEmail: string }> {
  console.log('[GMAIL] Leyendo credenciales de email_credentials...');
  let { data, error } = await supabaseAdmin
    .from('email_credentials')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error || !data) {
    const fallback = await supabaseAdmin.from('email_credentials').select('*').limit(1).single();
    data = fallback.data;
    error = fallback.error;
  }
  
  if (error || !data || !data.email_user || !data.email_password) {
    throw new Error('Credenciales de Gmail no configuradas en email_credentials');
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

// ════════════════════════════════════════════════════════════════════════════
// Envío de email con Gmail + registro en email_queue
// ════════════════════════════════════════════════════════════════════════════
export async function sendEmailViaGmail(
  to: string[],
  subject: string,
  html: string,
  building_id: string | null,
  emailType: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[SEND_EMAIL] → Iniciando envío para ${emailType}`);
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
