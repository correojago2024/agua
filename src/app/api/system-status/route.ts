/**
 * API: /api/system-status
 * Retorna el estado actual de uso vs límites del plan gratuito
 * Envía reporte por email al admin
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SYSTEM_ADMIN_EMAIL = 'correojago@gmail.com';

// Largos del plan gratuito de Supabase
const FREE_LIMITS = {
  rows_per_month: 500000,
  storage_mb: 500,
  bandwidth_mb: 1000,
  databases: 1,
  projects: 1,
};

// Largos approximados de Vercel (puede variar)
const VERCEL_LIMITS = {
  bandwidth_gb: 100, // GB por mes
  build_time_min: 6000, // minutos por mes
  functions: 12,
};

// Largos de Gmail (Google Workspace free tier)
const GMAIL_LIMITS = { emails_per_day: 500, recipients_per_message: 500 };

// Contador de emails enviados (en producción seería de DB)
let emailsSentThisMonth = 0;
let emailsMonthStart = new Date().toISOString().slice(0, 7); // YYYY-MM

async function sendStatusEmail(stats: any) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'agua.sistema2024@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const supabasePct = (stats.totalMeasurements / FREE_LIMITS.rows_per_month) * 100;
    const vercelPct = stats.vercelUsage || 15; // Estimado
    const gmailPct = (stats.emailsSent || 0) / GMAIL_LIMITS.emails_per_day * 100;
    
    const htmlBody = `
    <h2>📊 Estado del Sistema aGuaSaaS</h2>
    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
    
    <h3>🗄️ Supabase - Plan Gratuito</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <tr style="background: #f0f0f0;">
        <th style="padding: 8px; text-align: left;">Recurso</th>
        <th style="padding: 8px; text-align: right;">Uso</th>
        <th style="padding: 8px; text-align: right;">Límite</th>
        <th style="padding: 8px; text-align: right;">% Usado</th>
      </tr>
      <tr>
        <td style="padding: 8px;">📝 Filas (mediciones)</td>
        <td style="padding: 8px; text-align: right;">${stats.totalMeasurements.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right;">${FREE_LIMITS.rows_per_month.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: ${supabasePct > 80 ? 'red' : supabasePct > 60 ? 'orange' : 'green'};">
          ${supabasePct.toFixed(1)}%
        </td>
      </tr>
      <tr>
        <td style="padding: 8px;">🏢 Edificios</td>
        <td style="padding: 8px; text-align: right;">${stats.totalBuildings}</td>
        <td style="padding: 8px; text-align: right;">Ilimitado</td>
        <td style="padding: 8px; text-align: right;">—</td>
      </tr>
      <tr>
        <td style="padding: 8px;">👤 Suscriptores</td>
        <td style="padding: 8px; text-align: right;">${stats.totalSubscribers.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right;">Ilimitado</td>
        <td style="padding: 8px; text-align: right;">—</td>
      </tr>
    </table>

    <h3>🌐 Vercel - Plan Gratuito (Hobby)</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="padding: 8px;">📊 Ancho de banda</td>
        <td style="padding: 8px; text-align: right;">~${vercelPct}% estimado</td>
        <td style="padding: 8px; text-align: right;">100 GB/mes</td>
        <td style="padding: 8px; text-align: right; color: ${vercelPct > 80 ? 'red' : 'green'};">
          ${vercelPct}%
        </td>
      </tr>
      <tr>
        <td style="padding: 8px;">⚙️ Build minutes</td>
        <td style="padding: 8px; text-align: right;">~6,000 min/mes</td>
        <td style="padding: 8px; text-align: right;">6,000 min/mes</td>
        <td style="padding: 8px; text-align: right;">~1%</td>
      </tr>
    </table>

    <h3>📧 Gmail - Envío por SMTP</h3>
    <table style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="padding: 8px;">✉️ Emails enviados (hoy)</td>
        <td style="padding: 8px; text-align: right;">${stats.emailsSent || 0}</td>
        <td style="padding: 8px; text-align: right;">${GMAIL_LIMITS.emails_per_day}/día</td>
        <td style="padding: 8px; text-align: right; color: ${gmailPct > 80 ? 'red' : gmailPct > 60 ? 'orange' : 'green'};">
          ${gmailPct.toFixed(1)}%
        </td>
      </tr>
    </table>

    <h3>📦 Resumen General</h3>
    <ul>
      <li><strong>Supabase:</strong> ${supabasePct > 90 ? '⚠️ CRÍTICO' : supabasePct > 75 ? '⚠️ Advertencia' : '✅ Normal'}</li>
      <li><strong>Vercel:</strong> ${vercelPct > 80 ? '⚠️ Alto uso' : '✅ Normal'}</li>
      <li><strong>Gmail:</strong> ${gmailPct > 80 ? '⚠️ Revisar' : '✅ Normal'}</li>
      <li><strong>Próximo email:</strong> Se envía cuando cualquier servicio > 75%</li>
    </ul>

    <hr>
    <p style="color: #666; font-size: 12px;">
      Este es un reporte automático del sistema aGuaSaaS.<br>
      Configurable desde el panel de admin.
    </p>
  `;

  await transporter.sendMail({
    from: '"aGuaSaaS Sistema" <agua.sistema2024@gmail.com>',
    to: SYSTEM_ADMIN_EMAIL,
    subject: `📊 Estado Sistema - ${new Date().toLocaleDateString('es-ES')} | aGuaSaaS`,
    html: htmlBody,
  });
}

export async function GET() {
  try {
    // Contar mediciones totales
    const { count: measurementsCount } = await supabase
      .from('measurements')
      .select('*', { count: 'exact', head: true });

    // Contar edificios
    const { count: buildingsCount } = await supabase
      .from('buildings')
      .select('*', { count: 'exact', head: true });

    // Contar suscriptores
    const { count: subscribersCount } = await supabase
      .from('resident_subscriptions')
      .select('*', { count: 'exact', head: true });

    const totalMeasurements = measurementsCount || 0;
    const usagePct = (totalMeasurements / FREE_LIMITS.rows_per_month) * 100;

    const status: any = {
      supabase: {
        measurements: totalMeasurements,
        limit: FREE_LIMITS.rows_per_month,
        usagePct: usagePct.toFixed(1),
        status: usagePct > 90 ? 'critical' : usagePct > 75 ? 'warning' : 'normal',
      },
      buildings: buildingsCount || 0,
      subscribers: subscribersCount || 0,
      updatedAt: new Date().toISOString(),
    };

    // Enviar email si está cerca del límite
    if (usagePct > 75) {
      try {
        await sendStatusEmail({...status.supabase, emailsSent: emailsSentThisMonth});
        status.emailSent = true;
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        status.emailSent = false;
      }
    }

    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, sendEmail } = await request.json();

    // Get counts
    const { count: measurementsCount } = await supabase
      .from('measurements')
      .select('*', { count: 'exact', head: true });

    const { count: buildingsCount } = await supabase
      .from('buildings')
      .select('*', { count: 'exact', head: true });

    const { count: subscribersCount } = await supabase
      .from('resident_subscriptions')
      .select('*', { count: 'exact', head: true });

    const totalMeasurements = measurementsCount || 0;
    const usagePct = (totalMeasurements / FREE_LIMITS.rows_per_month) * 100;

    // Send email if requested or if over threshold
    if (sendEmail || usagePct > 75) {
      await sendStatusEmail({
        totalMeasurements,
        totalBuildings: buildingsCount || 0,
        totalSubscribers: subscribersCount || 0,
      });
    }

    return NextResponse.json({
      success: true,
      measurements: totalMeasurements,
      limit: FREE_LIMITS.rows_per_month,
      usagePct: usagePct.toFixed(1),
      buildings: buildingsCount || 0,
      subscribers: subscribersCount || 0,
      emailSent: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}