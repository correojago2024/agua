/**
 * SERVICIO: email-templates.ts
 * DESCRIPCIÓN: Plantillas HTML profesionales para correos electrónicos.
 */

import { Indicators } from '@/lib/calculations';
import { format } from 'date-fns';

export function renderHeatmapHtml(matrix: number[][]): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxVal = Math.max(...matrix.map(row => Math.max(...row)), 1);

  let html = `<div style="overflow-x:auto; margin-top:25px; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
    <h3 style="color:#0f172a; font-size:15px; margin:0 0 12px 0; display:flex; align-items:center; gap:8px;">🔥 Mapa de Calor de Consumo (Histórico)</h3>
    <table style="border-collapse:collapse; font-size:9px; width:100%; min-width:450px; text-align:center; table-layout:fixed;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:4px; border:1px solid #e2e8f0; width:35px;">Día</th>
          ${hours.map(h => `<th style="padding:2px; border:1px solid #e2e8f0;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

  matrix.forEach((row, dayIdx) => {
    html += `<tr>
      <td style="padding:4px; border:1px solid #e2e8f0; font-weight:bold; background:#f8fafc;">${days[dayIdx]}</td>`;
    row.forEach(val => {
      const intensity = val / maxVal;
      let bgColor = '#ffffff';
      if (val > 0) {
        if (intensity < 0.25) bgColor = '#bae6fd';
        else if (intensity < 0.5) bgColor = '#fde047';
        else if (intensity < 0.75) bgColor = '#fb923c';
        else bgColor = '#fda4af';
      }
      const textColor = intensity > 0.5 ? '#000000' : '#1e293b';
      html += `<td style="padding:4px; border:1px solid #e2e8f0; background:${bgColor}; color:${textColor};">${val > 0 ? '●' : ''}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>
  <div style="margin-top:10px; font-size:10px; color:#64748b; text-align:right;">Bajo Consumo <span style="display:inline-block; width:10px; height:10px; background:#bae6fd; vertical-align:middle; margin:0 2px;"></span> <span style="display:inline-block; width:10px; height:10px; background:#fde047; vertical-align:middle; margin:0 2px;"></span> <span style="display:inline-block; width:10px; height:10px; background:#fb923c; vertical-align:middle; margin:0 2px;"></span> <span style="display:inline-block; width:10px; height:10px; background:#fda4af; vertical-align:middle; margin:0 2px;"></span> Alto Consumo</div>
  </div>`;
  return html;
}

export function buildReportEmailHtml(
  building: any,
  measurements: any[],
  indicators: Indicators,
  currentLiters: number,
  percentage: number,
  isAnomaly: boolean,
  variationPercentage: number,
  chartUrls: any
): string {
  const percentageInt = Math.round(percentage);
  const flowLpm = indicators.lastFlow;
  const flowLph = flowLpm * 60;
  const flowDirIcon = flowLpm >= 0 ? '▲' : '▼';

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
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;line-height:1.4;">

  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:white;padding:25px 20px;text-align:center;">
    <h1 style="margin:0 0 5px;font-size:20px;line-height:1.2;">✨ Resumen de Agua ✨</h1>
    <p style="margin:0;opacity:0.8;font-size:14px;">Edificio <strong>${building.name}</strong></p>
    <p style="margin:5px 0 0;opacity:0.55;font-size:11px;">Generado: ${indicators.reportDate}</p>
  </div>

  <div style="padding:20px;">

    <div style="text-align:center;margin-bottom:25px;">
      <div style="display:inline-block; text-align:left; background:#f8fafc; padding:20px; border-radius:16px; border:1px solid #e2e8f0; width:100%; box-sizing:border-box;">
        <p style="margin:0 0 8px; font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Estado de Reserva</p>
        <p style="margin:0 0 12px; font-size:26px; font-weight:bold; color:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}">
          ${percentageInt > 60 ? '✅ ÓPTIMO' : percentageInt > 30 ? '⚠️ REGULAR' : '🚨 CRÍTICO'}
        </p>
        <div style="width:100%; background:#e2e8f0; border-radius:10px; height:12px; overflow:hidden; margin-bottom:10px;">
          <div style="width:${percentageInt}%; background:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}; height:100%;"></div>
        </div>
        <p style="margin:0; font-size:16px; font-weight:bold;">${percentageInt}% de capacidad</p>
        <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Aprox. ${Math.round(currentLiters).toLocaleString()} Litros</p>
      </div>
    </div>

    <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:15px;margin-bottom:20px;border-radius:0 8px 8px 0;">
      <h3 style="color:#2563eb;margin:0 0 12px;font-size:16px;">💡 Indicadores Clave</h3>
      <table style="font-size:12px;width:100%;border-collapse:collapse;">
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

    ${indicators.heatmapData ? renderHeatmapHtml(indicators.heatmapData) : ''}

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
