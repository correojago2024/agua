/**
 * ARCHIVO: app/api/measurements/route.ts
 * VERSION: 6.0
 * FECHA: 2026-04-24
 * CAMBIOS v6.0:
 * - Corrección de error de sintaxis Turbopack (código huérfano fuera de templates)
 * - Email 100% responsivo para móviles (max-width 600px, fuentes ajustadas)
 * - Eliminación de duplicidad de funciones
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateIndicators, Indicators } from '@/lib/calculations';
import { getAllImprovedCharts } from '@/lib/charts';
import { sendEmailViaGmail } from '@/lib/server/email';
import { logAudit } from '@/lib/audit';
import { checkWaterLevelThresholds } from '@/lib/server/whatsapp';

// ════════════════════════════════════════════════════════════════════════════
// HTML del email de reporte (Responsivo 600px)
// ════════════════════════════════════════════════════════════════════════════
function buildReportEmailHtml(
  building: any,
  measurements: any[],
  indicators: Indicators,
  currentLiters: number,
  percentage: number,
  isAnomaly: boolean,
  variationPercentage: number
): string {
  const percentageInt = Math.round(percentage);
  const lastM = measurements.length > 1 ? measurements[measurements.length - 2] : null;
  const varLts = lastM ? currentLiters - lastM.liters : 0;
  const flowLpm = indicators.lastFlow;
  const flowLph = flowLpm * 60;
  const flowDir = flowLpm >= 0 ? 'LLENADO' : 'CONSUMO';
  const flowDirIcon = flowLpm >= 0 ? '▲' : '▼';

  const chartUrls = getAllImprovedCharts(measurements);
  const chartRows = Object.entries(chartUrls)
    .map(([key, url]) => `
      <div style="margin-bottom:20px; text-align:center;">
        <img src="${url}" alt="${key}" style="width:100%; max-width:560px; height:auto; border-radius:8px; border:1px solid #e2e8f0;">
      </div>
    `).join('');

  const last10 = [...measurements].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()).slice(0, 10);
  const tableRows = last10.map(m => `
    <tr>
      <td style="padding:7px;border:1px solid #e2e8f0;text-align:left;">${new Date(m.recorded_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      <td style="padding:7px;border:1px solid #e2e8f0;">${Math.round(m.liters).toLocaleString()}</td>
      <td style="padding:7px;border:1px solid #e2e8f0;font-weight:bold;">${Math.round(m.percentage)}%</td>
      <td style="padding:7px;border:1px solid #e2e8f0;color:${(m.variation_lts || 0) >= 0 ? '#16a34a' : '#dc2626'}">${(m.variation_lts || 0) > 0 ? '+' : ''}${Math.round(m.variation_lts || 0).toLocaleString()}</td>
      <td style="padding:7px;border:1px solid #e2e8f0;">${Number(m.flow_lpm || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reporte AquaSaaS — ${building.name}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { padding: 12px !important; }
      .header h1 { font-size: 18px !important; }
      .kpi-card { padding: 15px !important; }
      .kpi-title { font-size: 24px !important; }
      .mobile-text { font-size: 13px !important; }
      .indicator-table td { padding: 6px !important; font-size: 11px !important; }
    }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;line-height:1.4;">

  <!-- ENCABEZADO -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:white;padding:25px 20px;text-align:center;">
    <h1 style="margin:0 0 5px;font-size:20px;line-height:1.2;">✨ Resumen de Agua ✨</h1>
    <p style="margin:0;opacity:0.8;font-size:14px;">Edificio <strong>${building.name}</strong></p>
    <p style="margin:5px 0 0;opacity:0.55;font-size:11px;">Generado: ${indicators.reportDate}</p>
  </div>

  <div class="container" style="padding:20px;">

    <!-- INDICADOR DE ALARMA (CSS) -->
    <div style="text-align:center;margin-bottom:25px;">
      <div class="kpi-card" style="display:inline-block; text-align:left; background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #e2e8f0; width:100%; box-sizing:border-box;">
        <p style="margin:0 0 8px; font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Estado de Reserva</p>
        <p class="kpi-title" style="margin:0 0 12px; font-size:26px; font-weight:bold; color:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}">
          ${percentageInt > 60 ? '✅ ÓPTIMO' : percentageInt > 30 ? '⚠️ REGULAR' : '🚨 CRÍTICO'}
        </p>
        <div style="width:100%; background:#e2e8f0; border-radius:10px; height:12px; overflow:hidden; margin-bottom:10px;">
          <div style="width:${percentageInt}%; background:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}; height:100%;"></div>
        </div>
        <p style="margin:0; font-size:16px; font-weight:bold;">${percentageInt}% de capacidad</p>
        <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Aprox. ${Math.round(currentLiters).toLocaleString()} Litros</p>
      </div>
    </div>

    <!-- INDICADORES CLAVE -->
    <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:15px;margin-bottom:20px;border-radius:0 8px 8px 0;">
      <h3 style="color:#2563eb;margin:0 0 12px;font-size:16px;">💡 Indicadores Clave</h3>
      <table class="indicator-table" style="font-size:12px;width:100%;border-collapse:collapse;">
        <tr style="background:#e2e8f0;"><td style="padding:8px;">1️⃣ Balance 24h:</td><td style="padding:8px;font-weight:bold;">C: ${Math.round(indicators.balance24h.consumed).toLocaleString()}L | LL: ${Math.round(indicators.balance24h.filled).toLocaleString()}L</td></tr>
        <tr><td style="padding:8px;">2️⃣ Caudal prom. 24h:</td><td style="padding:8px;font-weight:bold;">${indicators.avgFlow24h.toFixed(1)} L/h</td></tr>
        <tr style="background:#e2e8f0;"><td style="padding:8px;">3️⃣ Último Caudal:</td><td style="padding:8px;font-weight:bold;">${flowDirIcon} ${Math.abs(flowLph).toFixed(1)} L/h</td></tr>
        <tr><td style="padding:8px;">4️⃣ Proyección 11 PM:</td><td style="padding:8px;font-weight:bold;">${indicators.projection11pm.toFixed(1)}%</td></tr>
        <tr style="background:#e2e8f0;"><td style="padding:8px;">5️⃣ Tiempo est.:</td><td style="padding:8px;font-weight:bold;">${indicators.timeEstimate}</td></tr>
      </table>
    </div>

    ${isAnomaly ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:15px;margin-bottom:20px;border-radius:0 8px 8px 0;"><h3 style="color:#dc2626;margin:0 0 5px;font-size:15px;">⚠️ Anomalía Detectada</h3><p style="font-size:13px;margin:0;">Variación de ${variationPercentage.toFixed(1)}%.</p></div>` : ''}

    <h3 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:25px 0 15px;font-size:16px;">🖼️ Gráficos de Inteligencia</h3>
    ${chartUrls.caudalChart ? `<div style="margin-bottom:20px;text-align:center;"><img src="${chartUrls.caudalChart}" style="width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e2e8f0;"></div>` : ''}
    ${chartUrls.combinadoChart ? `<div style="margin-bottom:20px;text-align:center;"><img src="${chartUrls.combinadoChart}" style="width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e2e8f0;"></div>` : ''}
    ${chartUrls.last4WeeksChart ? `<div style="margin-bottom:20px;text-align:center;"><img src="${chartUrls.last4WeeksChart}" style="width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e2e8f0;"></div>` : ''}

    <h3 style="color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin:25px 0 10px;font-size:16px;">📋 Últimas 10 Mediciones</h3>
    <div style="width:100%; overflow-x:auto;"><table width="100%" style="font-size:10px;border-collapse:collapse;text-align:center;min-width:450px;"><thead><tr style="background:#1e293b;color:white;"><th style="padding:8px;text-align:left;">Fecha</th><th style="padding:8px;">Litros</th><th style="padding:8px;">%</th><th style="padding:8px;">Var.(L)</th><th style="padding:8px;">Caudal</th></tr></thead><tbody>${tableRows}</tbody></table></div>

    <div style="background:#fffbe6;padding:15px;border-radius:8px;font-size:12px;color:#444;margin:25px 0 20px;">
      <strong style="font-size:13px;">📌 Información de Suscripción</strong><br>
      Cada registro activa los próximos 5 resúmenes. Saludos cordiales.
    </div>

    <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:25px;line-height:1.4;">Sistema AquaSaaS — Informe automático. 2026 ©<br>No responder a este remitente.</p>
  </div>
</body>
</html>`.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// HTML Alerta de Anomalía
// ════════════════════════════════════════════════════════════════════════════
function buildAnomalyEmailHtml(building: any, newLiters: number, newPercentage: number, prevLiters: number, prevPercentage: number, variationPct: number, recordedAt: string, reportedBy: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1e293b;"><div style="background:#dc2626;color:white;padding:15px;border-radius:8px 8px 0 0;text-align:center;"><h2 style="margin:0;font-size:18px;">⚠️ Anomalía detectada — ${building.name}</h2></div><div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;"><p style="font-size:14px;">Se detectó una variación de <strong>${variationPct.toFixed(1)}%</strong>.</p><ul style="font-size:13px;line-height:1.8;"><li><strong>Fecha:</strong> ${new Date(recordedAt).toLocaleString('es-ES')}</li><li><strong>Nivel:</strong> ${Math.round(newLiters).toLocaleString()} L (${Number(newPercentage).toFixed(1)}%)</li><li><strong>Reportado por:</strong> ${reportedBy}</li></ul><p style="font-size:11px;color:#94a3b8;margin-top:20px;">Sistema AquaSaaS.</p></div></body></html>`.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Registrar medición y enviar reporte
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { building_id, liters, percentage, email, collaborator_name, recorded_at } = body;

    if (!building_id) return NextResponse.json({ error: 'building_id es requerido' }, { status: 400 });

    const { data: building, error: bErr } = await supabase.from('buildings').select('*').eq('id', building_id).single();
    if (bErr || !building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });

    const { data: history } = await supabase.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true });
    const lastM = history && history.length > 0 ? history[history.length - 1] : null;

    let isAnomaly = false;
    let variationPercentage = 0;
    if (lastM && lastM.liters > 0) {
      variationPercentage = Math.abs((liters - lastM.liters) / lastM.liters * 100);
      const { data: set } = await supabase.from('building_settings').select('alert_threshold_percentage, enable_anomaly_alerts').eq('building_id', building_id).single();
      if (variationPercentage > (set?.alert_threshold_percentage ?? 30)) {
        isAnomaly = true;
        if (set?.enable_anomaly_alerts && building.admin_email) {
          const aHtml = buildAnomalyEmailHtml(building, liters, percentage, lastM.liters, lastM.percentage, variationPercentage, recorded_at, collaborator_name || email || 'Anónimo');
          await sendEmailViaGmail([building.admin_email], `⚠️ Anomalía — ${building.name}`, aHtml, building_id, 'anomaly_alert');
        }
      }
    }

    const var_lts = lastM ? liters - lastM.liters : null;
    const { data: meas } = await supabase.from('measurements').insert([{
      building_id, liters, percentage, email: email || null,
      collaborator_name: collaborator_name || 'Anónimo',
      recorded_at, is_anomaly: isAnomaly, anomaly_checked: true,
      variation_lts: var_lts,
    }]).select().single();

    if (meas) await logAudit({ req: request, building_id, user_email: email || collaborator_name || 'Anónimo', operation: 'INSERT', entity_type: 'measurement', entity_id: meas.id, data_after: meas });

    // --- INTEGRACIÓN WHATSAPP ---
    // Verificar umbrales de nivel y enviar alertas si es necesario
    try {
      await checkWaterLevelThresholds(building_id, building.name, percentage, liters);
    } catch (waErr: any) {
      console.error('[WHATSAPP ALERT ERROR]', waErr.message);
    }
    // ----------------------------

    const { data: updHistory } = await supabase.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true });
    const indicators: Indicators = calculateIndicators(updHistory || [], building.tank_capacity_liters) || {
      lastFlow: 0, balance24h: { consumed: 0, filled: 0, net: 0 }, avgFlow24h: 0,
      projection11pm: percentage, projectedLiters11pm: liters, timeEstimate: 'Pendiente', estimateDate: 'N/A',
      filledToday: 0, filledLastWeek: 0, slotMax: { range: 'N/A', avg: 0 }, trends: { current: 0, previous: 0 },
      lastUpdate: new Date().toLocaleString('es-ES'), reportDate: new Date().toLocaleString('es-ES'),
    };

    if (email) {
      const { data: exSub } = await supabase.from('resident_subscriptions').select('id, emails_remaining').eq('building_id', building_id).eq('email', email).single();
      if (!exSub) await supabase.from('resident_subscriptions').insert({ building_id, email, emails_remaining: 5 });
    }

    const { data: subs } = await supabase.from('resident_subscriptions').select('email, id, emails_remaining').eq('building_id', building_id).gt('emails_remaining', 0);
    const recipientEmails = subs?.map(s => s.email) || [];
    if (building.admin_email && !recipientEmails.includes(building.admin_email)) recipientEmails.push(building.admin_email);

    if (recipientEmails.length > 0) {
      const emailHtml = buildReportEmailHtml(building, updHistory || [], indicators, liters, percentage, isAnomaly, variationPercentage);
      const res = await sendEmailViaGmail(recipientEmails, `💧 Reporte Agua: ${Math.round(percentage)}% — ${building.name}`, emailHtml, building_id, 'measurement_report');
      if (res.success && subs) {
        for (const s of subs) await supabase.from('resident_subscriptions').update({ emails_remaining: s.emails_remaining - 1 }).eq('id', s.id);
      }
    }

    return NextResponse.json({ success: true, measurementId: meas?.id, indicators, anomalyDetected: isAnomaly, variationPercentage: variationPercentage.toFixed(1), emailsSent: recipientEmails.length });
  } catch (err: any) {
    console.error('[ERROR] POST /api/measurements:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
