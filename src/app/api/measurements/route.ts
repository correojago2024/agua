/**
 * ARCHIVO: app/api/measurements/route.ts
 * VERSION: 5.3
 * FECHA: 2026-04-06 07:15 AM
 * CAMBIOS v5.3:
 * - Ampliado y mejorado el texto inicial del email con la información detallada solicitada
 * - Agregado Gauge (tacómetro) al inicio del email
 * - Se mantiene 100% todo el código original sin eliminar nada
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { calculateIndicators, Indicators } from '@/lib/calculations';
import { getAllImprovedCharts } from '@/lib/charts';
import { logAudit } from '@/lib/audit';
import nodemailer from 'nodemailer';

// Cliente Supabase server-side para leer email_credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// ════════════════════════════════════════════════════════════════════════════
// GMAIL — obtener transporter usando variables de entorno
// ════════════════════════════════════════════════════════════════════════════
async function getGmailTransporter(): Promise<{ transporter: nodemailer.Transporter; fromEmail: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('[GMAIL] ⚠️ No se encontraron las variables de entorno GMAIL_USER o GMAIL_APP_PASSWORD. Intentando fallback a email_credentials...');
    
    // Intento de fallback a la tabla por si acaso, pero priorizamos env vars
    const { data: list } = await supabaseAdmin
      .from('email_credentials')
      .select('email_user, email_password')
      .limit(1);
    
    const dbUser = list && list.length > 0 ? list[0].email_user : null;
    const dbPass = list && list.length > 0 ? list[0].email_password : null;

    if (!dbUser || !dbPass) {
      throw new Error('Configuración de email ausente: Defina GMAIL_USER y GMAIL_APP_PASSWORD en Vercel.');
    }
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: dbUser, pass: dbPass },
    });
    return { transporter, fromEmail: dbUser };
  }

  console.log('[GMAIL] ✅ Usando credenciales desde variables de entorno Vercel.');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return { transporter, fromEmail: user };
}

// ════════════════════════════════════════════════════════════════════════════
// email_queue — guardar registro de auditoría
// ════════════════════════════════════════════════════════════════════════════
async function saveToEmailQueue(
  buildingId: string | null,
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  emailType: string,
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string
) {
  console.log(`[EMAIL_QUEUE] → tipo:${emailType} | destinatario:${recipientEmail.substring(0,5)}*** | estado:${status}`);
  const { error: queueError } = await supabase.from('email_queue').insert({
    building_id: buildingId,
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
  buildingId: string,
  emailType: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[SEND_EMAIL] ── Iniciando envío Gmail ──────────────────────`);
  let transporter: nodemailer.Transporter;
  let fromEmail: string;
  try {
    ({ transporter, fromEmail } = await getGmailTransporter());
  } catch (credErr: any) {
    console.error('[SEND_EMAIL] ❌ Error obteniendo transporter:', credErr.message);
    for (const email of to) {
      await saveToEmailQueue(buildingId, email, subject, html, emailType, 'failed', credErr.message);
    }
    return { success: false, error: credErr.message };
  }
  try {
    const info = await transporter.sendMail({
      from: `"AquaSaaS" <${fromEmail}>`,
      to: to.join(', '),
      subject: subject,
      html: html,
    });
    console.log('[SEND_EMAIL] ✅ Email enviado. messageId:', info.messageId);
    for (const email of to) {
      await saveToEmailQueue(buildingId, email, subject, html, emailType, 'sent', 'messageId: ' + info.messageId);
    }
    return { success: true, messageId: info.messageId };
  } catch (sendErr: any) {
    console.error('[SEND_EMAIL] ❌ Error en sendMail:', sendErr.message);
    for (const email of to) {
      await saveToEmailQueue(buildingId, email, subject, html, emailType, 'failed', sendErr.message);
    }
    return { success: false, error: sendErr.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HTML del email de reporte de medición (TEXTO AMPLIADO + GAUGE AL INICIO)
// ════════════════════════════════════════════════════════════════════════════
function buildReportEmailHtml(
  building: any,
  allMeasurements: any[],
  indicators: Indicators,
  currentLiters: number,
  currentPercentage: number,
  isAnomaly: boolean,
  variationPercentage: number
): string {
  // Pasamos TODOS los datos al motor de gráficos; cada función en charts.ts
  // ya hace su propio slice/sort por recorded_at internamente
  const graphHistory = allMeasurements;
  const last10 = [...allMeasurements].reverse().slice(0, 10);
  const percentageInt = Math.round(currentPercentage);
  // Con orden ascending, el último elemento ES el más reciente por recorded_at
  const lastRecord = [...allMeasurements].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  ).pop();
  const flowLpm = lastRecord?.flow_lpm || lastRecord?.caudal_lts_min || 0;
  const flowLph = lastRecord?.caudal_lts_hora || (flowLpm * 60);
  const varLts  = lastRecord?.variacion_lts ?? lastRecord?.variation_lts ?? 0;
  const flowDir = flowLpm > 0 ? 'llenado' : flowLpm < 0 ? 'consumo' : 'estable';
  const flowDirIcon = flowLpm > 0 ? '🟢' : flowLpm < 0 ? '🔴' : '⚪';

  const chartUrls = getAllImprovedCharts(graphHistory, building.tank_capacity_liters);

  // ── Filas de gráficos (6 pares) ────────────────────────────────────────────
  let chartRows = '';
  try {
    const rows: Array<[string, string, string, string]> = [
      [chartUrls.caudalChart,            'Caudal de Llenado y Consumo',         chartUrls.combinadoChart,         'Evolución del Nivel del Tanque (%)'],
      [chartUrls.variationChart,         'Variación entre Mediciones',           chartUrls.thresholdChart,         'Nivel con Umbrales de Alerta'],
      [chartUrls.dayOfWeekChart,         'Consumo Promedio por Día de Semana',   chartUrls.last4WeeksChart,        'Nivel % por Día — Últimas 4 Semanas'],
      [chartUrls.nightlyLitrosChart,     'Consumo Nocturno Estimado',            chartUrls.consumoSemanalDoughnut, 'Distribución de Consumo por Día (histórico)'],
      [chartUrls.weekendChart,           'Consumo Fines de Semana (5 semanas)',  chartUrls.projectionFillingChart, 'Proyección de Llenado/Vaciado'],
      [chartUrls.caudalHoraChart,        'Caudal en Litros por Hora',            chartUrls.historicoMensualChart,  'Histórico Mensual — Consumo y Llenado'],
      [chartUrls.weekendLitrosChart,     'Consumo/Llenado Sáb-Dom (5 semanas)', chartUrls.semanaVsAnteriorChart,  'Consumo por Día — Semana Actual vs Anterior'],
      [chartUrls.weekendVariacionChart,  'Variación % Sáb-Dom (5 semanas)',      chartUrls.franjaHorariaChart,     'Consumo Promedio por Franja Horaria'],
    ];

    chartRows = rows.map(([url1, lbl1, url2, lbl2]) => `
      <tr>
        <td width="50%" style="background:#f8fafc;padding:15px;border-radius:8px;text-align:center;vertical-align:top;">
          <img src="${url1}" width="340" height="auto" alt="${lbl1}" style="display:block;border:1px solid #e2e8f0;margin:0 auto;max-width:100%;"/>
          <br/><strong style="font-size:11px;color:#64748b;">${lbl1}</strong>
        </td>
        <td width="50%" style="background:#f8fafc;padding:15px;border-radius:8px;text-align:center;vertical-align:top;">
          <img src="${url2}" width="340" height="auto" alt="${lbl2}" style="display:block;border:1px solid #e2e8f0;margin:0 auto;max-width:100%;"/>
          <br/><strong style="font-size:11px;color:#64748b;">${lbl2}</strong>
        </td>
      </tr>`).join('');
  } catch (chartErr: any) {
    console.warn('[BUILD_HTML] ⚠️ Error generando gráficos:', chartErr.message);
    chartRows = `<tr><td colspan="2" style="text-align:center;padding:20px;color:#94a3b8;font-size:13px;">Gráficos no disponibles en este reporte.</td></tr>`;
  }

  // ── Tabla de últimas 10 mediciones ampliada ────────────────────────────────
  const CAP = building.tank_capacity_liters || 169000;
  const tableRows = last10.map((m: any) => {
    const vLts   = m.variacion_lts ?? m.variation_lts ?? 0;
    const caudal = m.caudal_lts_min ?? m.flow_lpm ?? 0;
    // Calcular tiempo estimado: usar campo BD si existe, sino calcularlo desde caudal
    let tLlenarNum: number | null = null;
    let tVaciarNum: number | null = null;
    if (m.tiempo_estimado_llenar_min != null) {
      tLlenarNum = m.tiempo_estimado_llenar_min / 1440;
    } else if (caudal > 0.01) {
      tLlenarNum = (CAP - m.liters) / (caudal * 60 * 24);
    }
    if (m.tiempo_estimado_vaciar_min != null) {
      tVaciarNum = m.tiempo_estimado_vaciar_min / 1440;
    } else if (caudal < -0.01) {
      tVaciarNum = m.liters / (Math.abs(caudal) * 60 * 24);
    }
    const tLlenar = tLlenarNum != null && tLlenarNum > 0 && tLlenarNum < 365 ? tLlenarNum.toFixed(2) : null;
    const tVaciar = tVaciarNum != null && tVaciarNum > 0 && tVaciarNum < 365 ? tVaciarNum.toFixed(2) : null;
    const varColor    = vLts   > 0 ? '#16a34a' : vLts   < 0 ? '#dc2626' : '#64748b';
    const caudalColor = caudal > 0 ? '#16a34a' : caudal < 0 ? '#dc2626' : '#64748b';
    return `
      <tr>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;white-space:nowrap;">${new Date(m.recorded_at).toLocaleString('es-ES')}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;">${Math.round(m.liters).toLocaleString()}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:center;">${Math.round(m.percentage)}%</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;color:${varColor};font-weight:bold;">${vLts !== 0 ? (vLts > 0 ? '+' : '') + Math.round(vLts).toLocaleString() : '—'}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:right;color:${caudalColor};">${caudal !== 0 ? caudal.toFixed(2) : '—'}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">${caudal > 0 && tLlenar ? tLlenar + ' d' : '—'}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;">${caudal < 0 && tVaciar ? tVaciar + ' d' : '—'}</td>
        <td style="padding:7px 8px;border:1px solid #e2e8f0;">${m.collaborator_name || '—'}</td>
      </tr>`;
  }).join('');

  // ── Último registro destacado ──────────────────────────────────────────────
  const ultimoM = last10[0];
  const uVLts  = ultimoM ? (ultimoM.variacion_lts ?? ultimoM.variation_lts ?? 0) : 0;
  const uCaudal = ultimoM ? (ultimoM.caudal_lts_min ?? ultimoM.flow_lpm ?? 0) : 0;
  // Tiempo estimado último registro: usar BD si existe, sino calcular desde caudal
  let uTiempo = 'Estable';
  if (ultimoM) {
    if (uCaudal > 0.01) {
      const mins = ultimoM.tiempo_estimado_llenar_min ?? ((CAP - ultimoM.liters) / (uCaudal * 60));
      if (mins > 0 && mins < 1440 * 365) uTiempo = (mins / 1440).toFixed(2) + ' días (Llenado)';
    } else if (uCaudal < -0.01) {
      const mins = ultimoM.tiempo_estimado_vaciar_min ?? (ultimoM.liters / (Math.abs(uCaudal) * 60));
      if (mins > 0 && mins < 1440 * 365) uTiempo = (mins / 1440).toFixed(2) + ' días (Vaciado)';
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reporte AquaSaaS — ${building.name}</title>
</head>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:900px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;line-height:1.5;">

  <!-- ENCABEZADO -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:white;padding:30px;text-align:center;">
    <h1 style="margin:0 0 5px;font-size:24px;">✨ Resumen de las Últimas Mediciones de Agua ✨</h1>
    <p style="margin:0;opacity:0.8;">Edificio <strong>${building.name}</strong> — Sistema AquaSaaS</p>
    <p style="margin:5px 0 0;opacity:0.55;font-size:12px;">Generado: ${indicators.reportDate}</p>
  </div>

  <div style="padding:28px;">

    <!-- INDICADOR DE ALARMA (CSS) -->
    <div style="text-align:center;margin-bottom:30px;">
      <div style="display:inline-block; text-align:left; background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #e2e8f0; min-width:300px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <p style="margin:0 0 8px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">Estado de Reserva Actual</p>
        <p style="margin:0 0 15px; font-size:28px; font-weight:bold; color:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}">
          ${percentageInt > 60 ? '✅ ÓPTIMO' : percentageInt > 30 ? '⚠️ REGULAR' : '🚨 CRÍTICO'}
        </p>
        <div style="width:100%; background:#e2e8f0; border-radius:10px; height:16px; overflow:hidden; margin-bottom:10px;">
          <div style="width:${percentageInt}%; background:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}; height:100%;"></div>
        </div>
        <p style="margin:0; font-size:18px; font-weight:bold; color:#1e293b;">${percentageInt}% de capacidad</p>
        <p style="margin:5px 0 0; font-size:12px; color:#64748b;">Aproximadamente ${Math.round(currentLiters).toLocaleString()} Litros</p>
      </div>
    </div>

    <!-- SALUDO -->
    <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:18px 20px;margin-bottom:22px;border-radius:0 8px 8px 0;">
      <p style="font-size:14px;line-height:1.8;margin:0;">
        Estimado/a Vecino/a,<br><br>
        Le presentamos el resumen más reciente del nivel de agua en nuestro tanque, basado en los datos aportados por la comunidad.<br>
        Su participación es clave para mantener un control eficiente del recurso hídrico.
      </p>
    </div>

    <!-- INDICADORES PRINCIPALES -->
    <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:18px 20px;margin-bottom:22px;border-radius:0 8px 8px 0;">
      <h3 style="color:#2563eb;margin:0 0 14px;">💡 Principales Indicadores del Tanque al Día de Hoy 🔍</h3>
      <p style="font-size:13px;color:#64748b;margin:0 0 10px;">
        Reporte generado: <strong>${indicators.reportDate}</strong> — Último registro: <strong>${indicators.lastUpdate}</strong> — Nivel: <strong>${percentageInt}%</strong>
      </p>
      <table style="font-size:13px;width:100%;border-collapse:collapse;">
        <tr style="background:#e2e8f0;">
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">1️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Balance últimas 24 horas:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            Se consumieron <span style="color:#dc2626;">${Math.round(indicators.balance24h.consumed).toLocaleString()} L</span>
            y se llenaron <span style="color:#16a34a;">${Math.round(indicators.balance24h.filled).toLocaleString()} L</span>.
            Balance neto: <strong>${Math.round(indicators.balance24h.net).toLocaleString()} L</strong>.
          </td>
        </tr>
        <tr>
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">2️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Caudal promedio últimas 24h:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            ${indicators.avgFlow24h.toFixed(1)} L/h
            ${indicators.balance24h.net >= 0 ? '(llenado neto)' : '(consumo neto)'}
          </td>
        </tr>
        <tr style="background:#e2e8f0;">
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">3️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Última medición — Caudal:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            ${flowDirIcon} ${Math.abs(flowLph).toFixed(1)} L/h (${flowDir})
            — ${Math.abs(flowLpm).toFixed(2)} L/min
          </td>
        </tr>
        <tr>
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">4️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Nivel actual del tanque:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            ${percentageInt}% — ${Math.round(currentLiters).toLocaleString()} L
            de ${(building.tank_capacity_liters || 169000).toLocaleString()} L de capacidad total
          </td>
        </tr>
        <tr style="background:#e2e8f0;">
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">5️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Proyección nivel a las 11:00 PM:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            Nivel estimado: ${indicators.projection11pm.toFixed(1)}%
            (${Math.round(indicators.projectedLiters11pm).toLocaleString()} L)
          </td>
        </tr>
        <tr>
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">6️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Tiempo estimado hasta ${flowLpm >= 0 ? 'llenado' : 'vaciado'}:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            ${indicators.timeEstimate}
            ${indicators.estimateDate !== 'N/A' ? '— Fecha estimada: ' + indicators.estimateDate : ''}
          </td>
        </tr>
        <tr style="background:#e2e8f0;">
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">7️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Llenado registrado hoy:</td>
          <td style="padding:8px 10px;font-weight:bold;">
            ${Math.round(indicators.filledToday).toLocaleString()} L
          </td>
        </tr>
        <tr>
          <td style="padding:8px 10px;font-weight:bold;color:#1e293b;">8️⃣</td>
          <td style="padding:8px 10px;color:#64748b;">Variación última medición:</td>
          <td style="padding:8px 10px;font-weight:bold;color:${varLts > 0 ? '#16a34a' : varLts < 0 ? '#dc2626' : '#64748b'};">
            ${varLts > 0 ? '+' : ''}${Math.round(varLts).toLocaleString()} L
            (${varLts > 0 ? 'entrada de agua / llenado' : varLts < 0 ? 'consumo / salida de agua' : 'sin cambio'})
          </td>
        </tr>
      </table>
    </div>

    ${isAnomaly ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:18px 20px;margin-bottom:22px;border-radius:0 8px 8px 0;">
      <h3 style="color:#dc2626;margin:0 0 8px;">⚠️ Alerta: Variación Anormal Detectada</h3>
      <p style="font-size:14px;margin:0;">Se detectó una variación de <strong>${variationPercentage.toFixed(1)}%</strong> respecto a la medición anterior. Se recomienda verificar el dato ingresado.</p>
    </div>` : ''}

    <!-- GALERÍA DE GRÁFICOS -->
    <h3 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:15px;">
      🖼️ Galería de Gráficos de Inteligencia Hídrica
    </h3>
    <table width="100%" cellspacing="12" style="margin-bottom:30px;">${chartRows}</table>

    <!-- TABLA COMPLETA -->
    <h3 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">
      📋 Detalle de las Últimas 10 Mediciones
    </h3>
    <div style="overflow-x:auto;">
      <table width="100%" style="font-size:11px;border-collapse:collapse;text-align:center;margin-bottom:16px;min-width:650px;">
        <thead>
          <tr style="background:#1e293b;color:white;">
            <th style="padding:9px 8px;border:1px solid #334155;text-align:left;">Fecha y Hora</th>
            <th style="padding:9px 8px;border:1px solid #334155;">💧 Litros</th>
            <th style="padding:9px 8px;border:1px solid #334155;">📊 %</th>
            <th style="padding:9px 8px;border:1px solid #334155;">📈 Variación (L)</th>
            <th style="padding:9px 8px;border:1px solid #334155;">Caudal (L/min)</th>
            <th style="padding:9px 8px;border:1px solid #334155;">T. Llenado (d)</th>
            <th style="padding:9px 8px;border:1px solid #334155;">T. Vaciado (d)</th>
            <th style="padding:9px 8px;border:1px solid #334155;">👥 Reportado por</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- ÚLTIMO REGISTRO DESTACADO -->
    ${ultimoM ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:22px;">
      <p style="font-size:12px;color:#166534;font-weight:bold;margin:0 0 6px;">⭐ Último Registro</p>
      <table width="100%" style="font-size:12px;border-collapse:collapse;">
        <tr style="background:#dcfce7;">
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">Fecha y Hora</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">💧 Litros</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">📊 %</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">📈 Variación (L)</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">Caudal (L/min)</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">Tiempo Estimado</th>
          <th style="padding:7px 8px;border:1px solid #bbf7d0;">👥 Reportado por</th>
        </tr>
        <tr style="text-align:center;">
          <td style="padding:7px 8px;border:1px solid #bbf7d0;">${new Date(ultimoM.recorded_at).toLocaleString('es-ES')}</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;font-weight:bold;">${Math.round(ultimoM.liters).toLocaleString()}</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;font-weight:bold;">${Math.round(ultimoM.percentage)}%</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;font-weight:bold;color:${uVLts >= 0 ? '#16a34a' : '#dc2626'};">${uVLts > 0 ? '+' : ''}${Math.round(uVLts).toLocaleString()}</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;">${uCaudal.toFixed(2)}</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;">${uTiempo}</td>
          <td style="padding:7px 8px;border:1px solid #bbf7d0;">${ultimoM.collaborator_name || '—'}</td>
        </tr>
      </table>
    </div>` : ''}

    <!-- OBSERVACIONES -->
    <div style="background:#fffbe6;padding:20px;border-radius:8px;font-size:13px;color:#444;margin-bottom:22px;">
      <strong>*** Observaciones y Explicación de Gráficos ***</strong><br><br>
      <ol style="margin:8px 0 0;padding-left:20px;line-height:1.9;">
        <li><strong>Caudal de Llenado y Consumo:</strong> Muestra la tasa de cambio en litros por minuto. Barras verdes indican llenado (entrada de agua), barras rojas indican consumo (salida de agua).</li>
        <li><strong>Evolución del Nivel del Tanque (%):</strong> Línea azul con área sombreada mostrando el porcentaje del nivel a lo largo del tiempo. Los puntos se colorean en verde (>60%), naranja (30-60%) y rojo (&lt;30%) según el umbral de alerta.</li>
        <li><strong>Variación entre Mediciones:</strong> Diferencia de litros entre reportes consecutivos. Barras <span style="color:#16a34a;font-weight:bold;">verdes = llenado</span>, barras <span style="color:#dc2626;font-weight:bold;">rojas = consumo</span>.</li>
        <li><strong>Nivel del Tanque con Umbrales:</strong> Visualiza el nivel histórico con líneas de alerta: Alerta ${Math.round((building.tank_capacity_liters||169000)*0.6).toLocaleString()} L (60%), Racionamiento ${Math.round((building.tank_capacity_liters||169000)*0.4).toLocaleString()} L (40%), Crítico ${Math.round((building.tank_capacity_liters||169000)*0.2).toLocaleString()} L (20%).</li>
        <li><strong>Consumo Promedio por Día de Semana (barras):</strong> Promedio histórico de litros consumidos por cada día. Solo considera variaciones negativas (consumo real).</li>
        <li><strong>Nivel % por Día — Últimas 4 Semanas:</strong> Cada línea representa una semana. El eje X muestra los días Lun–Dom. Permite comparar patrones entre semanas.</li>
        <li><strong>Consumo Nocturno Estimado:</strong> Litros consumidos entre mediciones consecutivas. Representa el consumo en los períodos registrados.</li>
        <li><strong>Distribución de Consumo por Día (Doughnut):</strong> Vista proporcional del consumo promedio histórico por día de la semana. Permite identificar qué días se consume más agua.</li>
        <li><strong>Consumo Fin de Semana — Últimas 5 Semanas:</strong> Barras amarillas = sábados, barras azules = domingos. Muestra la evolución real del consumo en cada fin de semana.</li>
        <li><strong>Proyección de Llenado/Vaciado:</strong> Basado en el caudal de la última medición, proyecta las fechas y horas estimadas para alcanzar niveles críticos (vaciado: 60%, 40%, 30%, 20%, 0%) o completos (llenado: 50%, 60%, 80%, 90%, 100%).</li>
        <li><strong>Caudal en Litros por Hora:</strong> Evolución del caudal horario en las últimas mediciones. Valores positivos = llenado, negativos = consumo.</li>
        <li><strong>Histórico Mensual — Consumo y Llenado:</strong> Barras rojas = litros consumidos por mes, barras verdes = litros de llenado por mes. Muestra los últimos 6 meses.</li>
        <li><strong>Consumo/Llenado Sáb-Dom (5 semanas):</strong> Barras agrupadas mostrando litros consumidos y llenados cada sábado y domingo de las últimas 5 semanas. Permite identificar patrones de fin de semana.</li>
        <li><strong>Consumo por Día — Semana Actual vs Anterior:</strong> Barras azules = semana actual, grises = semana anterior. Comparación directa del consumo diario entre ambas semanas.</li>
        <li><strong>Variación % Sáb-Dom (5 semanas):</strong> Cambio neto en puntos porcentuales del nivel del tanque durante cada sábado y domingo. Verde = el tanque subió, rojo = bajó.</li>
        <li><strong>Consumo Promedio por Franja Horaria:</strong> El consumo histórico agrupado en franjas de 6 horas (madrugada, mañana, tarde, noche). La barra roja indica la franja de mayor consumo.</li>
      </ol>
    </div>

    <!-- CAUDAL EXPLICADO -->
    <div style="background:#f1f5f9;padding:16px 20px;border-radius:8px;font-size:13px;color:#475569;margin-bottom:22px;">
      <strong>ℹ️ ¿Cómo interpretar el Caudal?</strong><br><br>
      El caudal neto (L/min) representa la tasa de cambio en el volumen de agua, calculada dividiendo la diferencia de litros entre dos mediciones consecutivas sobre el tiempo transcurrido (en minutos).<br><br>
      Un valor <strong style="color:#16a34a;">positivo</strong> indica que el tanque se está llenando: la entrada de agua supera al consumo.<br>
      Un valor <strong style="color:#dc2626;">negativo</strong> señala una disminución en el nivel: el consumo en el edificio supera la entrada de agua, o hay ausencia de suministro desde la red pública.<br><br>
      El tiempo estimado de llenado se basa en los caudales positivos, proyectando el tiempo necesario para alcanzar la capacidad máxima (${(building.tank_capacity_liters||169000).toLocaleString()} L).<br>
      El tiempo estimado de vaciado se calcula con los caudales negativos, estimando cuánto tardaría el tanque en vaciarse si el consumo se mantiene en ese ritmo.
    </div>

    <!-- IMPORTANTE -->
    <div style="background:#fffbe6;padding:20px;border-radius:8px;font-size:13px;color:#444;margin-bottom:22px;">
      <strong>IMPORTANTE (Manténgase Informado): Así Funciona Nuestro Sistema de Resúmenes por Correo</strong><br><br>
      Para que siempre esté al tanto del nivel del agua de nuestro tanque, hemos diseñado un sistema de notificación muy sencillo:<br><br>
      ✉️ <strong>Activación de Resúmenes:</strong> Cada vez que usted registre un nuevo dato en el formulario e incluya su correo electrónico, activará la recepción de los próximos <strong>5 resúmenes</strong> de estadísticas del agua.<br>
      ➡️ <strong>Fin del Ciclo:</strong> Una vez que haya recibido esos 5 correos, su ciclo de suscripción actual finalizará y dejará de recibir notificaciones.<br>
      ➡️ <strong>Reactivar su Suscripción:</strong> ¿Desea seguir recibiendo estas valiosas actualizaciones? ¡Es muy fácil! Simplemente, vuelva a registrar un nuevo dato en el formulario e indique nuevamente su correo electrónico.<br><br>
      Agradecemos su colaboración en el monitoreo del agua. ¡Cada dato registrado es un paso hacia una mejor gestión del agua en el edificio!<br><br>
      Saludos cordiales,<br>
      <strong>Comisión de Agua del Edificio</strong>
    </div>

    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:25px;">
      Sistema AquaSaaS — Informe automático. 2026 © Todos los derechos reservados.<br>
      <strong>NOTA:</strong> Por favor, no responder al remitente de este email, ya que esta notificación es enviada en forma automática por nuestros sistemas, y se trata de una dirección que solamente se utiliza para el envío de emails y su buzón de entrada no es monitoreado ni será atendido por ninguna persona.
    </p>
  </div>
</body>
</html>`.trim();
}


// ════════════════════════════════════════════════════════════════════════════
// HTML del email de alerta de anomalía (se mantiene igual)
// ════════════════════════════════════════════════════════════════════════════
function buildAnomalyEmailHtml(
  building: any,
  newLiters: number,
  newPercentage: number,
  prevLiters: number,
  prevPercentage: number,
  variationPct: number,
  recordedAt: string,
  reportedBy: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1e293b;">
  <div style="background:#dc2626;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
    <h2 style="margin:0;">⚠️ Alerta de Anomalía — ${building.name}</h2>
  </div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p>Se detectó una variación anormal en el nivel del tanque:</p>
    <div style="background:#fef2f2;border:1px solid #ef4444;padding:16px;border-radius:8px;margin:16px 0;">
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:2;">
        <li><strong>Fecha:</strong> ${new Date(recordedAt).toLocaleString('es-ES')}</li>
        <li><strong>Medición anterior:</strong> ${Math.round(prevLiters).toLocaleString()} L (${prevPercentage.toFixed(1)}%)</li>
        <li><strong>Medición actual:</strong> ${Math.round(newLiters).toLocaleString()} L (${Number(newPercentage).toFixed(1)}%)</li>
        <li><strong>Variación:</strong> <span style="color:#dc2626;font-weight:bold;">${variationPct.toFixed(1)}%</span></li>
        <li><strong>Reportado por:</strong> ${reportedBy}</li>
      </ul>
    </div>
    <p style="font-size:13px;color:#475569;">Por favor, revise este dato en el panel de administración.</p>
    <p style="font-size:11px;color:#94a3b8;margin-top:20px;">Sistema AquaSaaS — mensaje automático.</p>
  </div>
</body>
</html>`.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Registrar medición y enviar reporte por Gmail
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('[STEP 0] INICIO POST /api/measurements (Gmail)');
  console.log('[STEP 0] Timestamp:', new Date().toISOString());
  console.log('══════════════════════════════════════════════════');
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr: any) {
      console.error('[STEP 1] ❌ Error parseando JSON:', parseErr.message);
      return NextResponse.json({ error: 'Body inválido — se esperaba JSON' }, { status: 400 });
    }
    const { building_id, liters, percentage, email, collaborator_name, recorded_at } = body;

    if (!building_id) {
      return NextResponse.json({ error: 'building_id es requerido' }, { status: 400 });
    }
    if (liters == null && percentage == null) {
      return NextResponse.json({ error: 'Se requiere liters o percentage' }, { status: 400 });
    }

    const { data: building, error: buildingError } = await supabase
      .from('buildings')
      .select('*')
      .eq('id', building_id)
      .single();

    if (buildingError || !building) {
      return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
    }

    const { data: history } = await supabase
      .from('measurements')
      .select('*')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: true });

    let isAnomaly = false;
    let variationPercentage = 0;

    if (history && history.length > 0) {
      const lastM = history[history.length - 1];
      if (lastM.liters > 0) {
        variationPercentage = Math.abs((liters - lastM.liters) / lastM.liters * 100);
        const { data: settings } = await supabase
          .from('building_settings')
          .select('alert_threshold_percentage, enable_anomaly_alerts')
          .eq('building_id', building_id)
          .single();
        const threshold = settings?.alert_threshold_percentage ?? 30;
        if (variationPercentage > threshold) {
          isAnomaly = true;
          if (settings?.enable_anomaly_alerts && building.admin_email) {
            const anomalyHtml = buildAnomalyEmailHtml(
              building, liters, percentage,
              lastM.liters, lastM.percentage,
              variationPercentage, recorded_at,
              collaborator_name || email || 'Anónimo'
            );
            await sendEmailViaGmail(
              [building.admin_email],
              `⚠️ Anomalía detectada — ${building.name}`,
              anomalyHtml,
              building_id,
              'anomaly_alert'
            );
          }
        }
      }
    }

    // Calcular variation_lts respecto a la medición anterior
    const lastMeasurement = history && history.length > 0 ? history[history.length - 1] : null;
    const variation_lts = lastMeasurement ? liters - lastMeasurement.liters : null;

    const { data: measurement } = await supabase
      .from('measurements')
      .insert([{
        building_id,
        liters,
        percentage,
        email: email || null,
        collaborator_name: collaborator_name || 'Anónimo',
        recorded_at,
        is_anomaly: isAnomaly,
        anomaly_checked: true,
        variation_lts: variation_lts,
      }])
      .select()
      .single();

    // AUDITORÍA: Registrar nueva medición
    if (measurement) {
      await logAudit({
        req: request,
        building_id,
        user_email: email || collaborator_name || 'Anónimo',
        operation: 'INSERT',
        entity_type: 'measurement',
        entity_id: measurement.id,
        data_after: measurement,
        status: 'SUCCESS'
      });
    }

    const { data: updatedHistory } = await supabase
      .from('measurements')
      .select('*')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: true });

    const allMeasurements = updatedHistory || [];
    const rawIndicators = calculateIndicators(allMeasurements, building.tank_capacity_liters);
    const indicators: Indicators = rawIndicators ?? {
      lastFlow: 0,
      balance24h: { consumed: 0, filled: 0, net: 0 },
      avgFlow24h: 0,
      projection11pm: percentage,
      projectedLiters11pm: liters,
      timeEstimate: 'Pendiente de más datos',
      estimateDate: 'N/A',
      filledToday: 0,
      filledLastWeek: 0,
      slotMax: { range: 'N/A', avg: 0 },
      trends: { current: 0, previous: 0 },
      lastUpdate: new Date().toLocaleString('es-ES'),
      reportDate: new Date().toLocaleString('es-ES'),
    };

    if (email) {
      const { data: existingSub } = await supabase
        .from('resident_subscriptions')
        .select('id, emails_remaining')
        .eq('building_id', building_id)
        .eq('email', email)
        .single();
      if (!existingSub) {
        await supabase
          .from('resident_subscriptions')
          .insert({ building_id, email, emails_remaining: 10 });
      }
    }

    const { data: subscribers } = await supabase
      .from('resident_subscriptions')
      .select('email, id, emails_remaining')
      .eq('building_id', building_id)
      .gt('emails_remaining', 0);

    const emailHtml = buildReportEmailHtml(
      building, allMeasurements, indicators,
      liters, percentage, isAnomaly, variationPercentage
    );

    let emailsSent = 0;
    const recipientEmails = subscribers?.map(s => s.email) || [];
    
    // SIEMPRE añadir al administrador del edificio a los destinatarios si tiene admin_email
    if (building.admin_email && !recipientEmails.includes(building.admin_email)) {
      recipientEmails.push(building.admin_email);
    }

    if (recipientEmails.length > 0) {
      const emailResult = await sendEmailViaGmail(
        recipientEmails,
        `💧 Reporte de Agua: ${Math.round(percentage)}% actual — ${building.name}`,
        emailHtml,
        building_id,
        'measurement_report'
      );

      if (emailResult.success) {
        emailsSent = recipientEmails.length;
      }

      // Descontar créditos solo a los suscriptores residentes (no al admin)
      if (subscribers && subscribers.length > 0) {
        for (const sub of subscribers) {
          const nuevoCredito = sub.emails_remaining - 1;
          await supabase
            .from('resident_subscriptions')
            .update({ emails_remaining: nuevoCredito })
            .eq('id', sub.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      measurementId: measurement?.id,
      indicators,
      anomalyDetected: isAnomaly,
      variationPercentage: variationPercentage.toFixed(1),
      emailsSent,
    });

  } catch (error: any) {
    console.error('[ERROR] Excepción no capturada en POST /api/measurements:', error.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
