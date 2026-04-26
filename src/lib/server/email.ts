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

  // --- LÓGICA DE CUOTAS Y LÍMITES POR EDIFICIO ---
  if (building_id) {
    const { data: building } = await supabaseAdmin
      .from('buildings')
      .select('name, admin_email, emails_sent_this_month, max_emails_per_month, last_quota_reset_at, notified_90_emails')
      .eq('id', building_id)
      .single();

    if (building) {
      const now = new Date();
      const lastReset = new Date(building.last_quota_reset_at || now);
      const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);

      // 1. Reiniciar contador si pasaron 30 días
      if (daysSinceReset >= 30) {
        await supabaseAdmin.from('buildings').update({
          emails_sent_this_month: 0,
          last_quota_reset_at: now.toISOString(),
          notified_90_emails: false
        }).eq('id', building_id);
        building.emails_sent_this_month = 0;
      }

      // 2. Verificar límite mensual
      const maxEmails = building.max_emails_per_month || 100;
      if (building.emails_sent_this_month >= maxEmails) {
        console.warn(`[EMAIL] Límite alcanzado para ${building.name} (${building.emails_sent_this_month}/${maxEmails})`);
        return { success: false, error: 'Límite mensual de emails alcanzado para este edificio.' };
      }

      // 3. Alerta 90% Emails
      const usagePct = (building.emails_sent_this_month / maxEmails) * 100;
      if (usagePct >= 90 && !building.notified_90_emails) {
        const alertTo = [building.admin_email, 'correojago@gmail.com'].filter(Boolean);
        const emailAlertHtml = `
          <h3>📧 Alerta de Envío de Emails: 90% alcanzado</h3>
          <p>El edificio <b>${building.name}</b> ha alcanzado el 90% de su límite mensual (${building.emails_sent_this_month} de ${maxEmails}).</p>
          <p>Deberá esperar al mes siguiente para seguir recibiendo emails o cambiar de plan. Los datos se seguirán guardando, pero sin notificaciones.</p>
        `;
        // Evitamos recursividad infinita enviando la alerta directamente
        try {
          const { transporter: t, fromEmail: f } = await getGmailTransporter();
          await t.sendMail({
            from: `"aGuaSaaS" <${f}>`,
            to: alertTo.join(', '),
            subject: `📧 Alerta 90% Emails Mensuales — ${building.name}`,
            html: emailAlertHtml
          });
          await supabaseAdmin.from('buildings').update({ notified_90_emails: true }).eq('id', building_id);
        } catch (e) {
          console.error('[EMAIL] Error enviando alerta de cuota:', e);
        }
      }
    }
  }

  try {
    ({ transporter, fromEmail } = await getGmailTransporter());
  } catch (err: any) {
    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'failed', err.message, building_id || undefined);
    return { success: false, error: err.message };
  }

  try {
    const info = await transporter.sendMail({
      from: `"aGuaSaaS" <${fromEmail}>`,
      to: to.join(', '),
      subject: subject,
      html: html,
    });
    
    // Incrementar contador en la base de datos
    if (building_id) {
      await supabaseAdmin.rpc('increment_building_emails', { b_id: building_id, count: to.length });
    }

    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'sent', undefined, building_id || undefined);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    for (const email of to) await saveToEmailQueue(email, subject, html, emailType, 'failed', err.message, building_id || undefined);
    return { success: false, error: err.message };
  }
}
