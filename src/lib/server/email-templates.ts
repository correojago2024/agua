/**
 * SERVICIO: email-templates.ts
 * DESCRIPCIÓN: Plantilla MAESTRA idéntica a la original de AquaSaaS + Mapa de Calor.
 */

import { Indicators } from '@/lib/calculations';

export function renderHeatmapHtml(matrix: number[][]): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const maxVal = Math.max(...matrix.map(row => Math.max(...row)), 1);

  let html = `<div style="overflow-x:auto; margin-top:25px; background:#f8fafc; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
    <h3 style="color:#0f172a; font-size:16px; margin:0 0 15px 0;">🔥 Mapa de Calor de Consumo (Histórico)</h3>
    <p style="font-size:11px; color:#64748b; margin-bottom:12px;">Visualización horaria del consumo histórico. Los colores más cálidos indican horas de mayor gasto de agua.</p>
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
      html += `<td style="padding:4px; border:1px solid #e2e8f0; background:${bgColor};">${val > 0 ? '●' : ''}</td>`;
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
  const flowLph = Math.abs(flowLpm * 60);
  const flowDirIcon = flowLpm >= 0 ? '🟢' : '🔴';
  const flowTypeText = flowLpm >= 0 ? 'llenado' : 'consumo';

  // Ordenar para las tablas
  const sortedDesc = [...measurements].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  const lastRecord = sortedDesc[0];
  const last10 = sortedDesc.slice(0, 10);

  const tableRows = last10.map(m => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:8px;text-align:left;">${new Date(m.recorded_at).toLocaleString('es-ES')}</td>
      <td style="padding:8px;">${Math.round(m.liters).toLocaleString()}</td>
      <td style="padding:8px;font-weight:bold;">${Math.round(m.percentage)}%</td>
      <td style="padding:8px;color:${(m.variation_lts || 0) >= 0 ? '#16a34a' : '#dc2626'}">${(m.variation_lts || 0) > 0 ? '+' : ''}${Math.round(m.variation_lts || 0).toLocaleString()}</td>
      <td style="padding:8px;">${Number(m.flow_lpm || 0).toFixed(2)}</td>
      <td style="padding:8px;">${m.flow_lpm > 0 ? (Math.abs((building.tank_capacity_liters - m.liters)/m.flow_lpm)/1440).toFixed(2) + ' d' : '—'}</td>
      <td style="padding:8px;">${m.flow_lpm < 0 ? (Math.abs(m.liters/m.flow_lpm)/1440).toFixed(2) + ' d' : '—'}</td>
      <td style="padding:8px;">${m.collaborator_name || 'Vecino'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:800px;margin:0 auto;background:#fff;line-height:1.6;">

  <div style="background:#f8fafc; padding:30px; border:1px solid #e2e8f0; border-radius:12px;">
    
    <div style="text-align:center; margin-bottom:30px;">
      <h1 style="margin:0; color:#0f172a; font-size:24px;">✨ Resumen de las Últimas Mediciones de Agua ✨</h1>
      <p style="margin:5px 0 0; color:#64748b; font-size:16px;">Edificio <strong>${building.name}</strong> — Sistema AquaSaaS</p>
      <p style="margin:10px 0 0; color:#94a3b8; font-size:13px;">Generado: ${indicators.reportDate}</p>
    </div>

    <div style="text-align:center; margin-bottom:40px; background:white; padding:25px; border-radius:20px; border:2px solid #f1f5f9;">
      <p style="margin:0 0 10px; font-size:14px; font-weight:bold; color:#64748b; text-transform:uppercase; tracking-widest:0.1em;">Estado de Reserva Actual</p>
      <p style="margin:0 0 15px; font-size:32px; font-weight:bold; color:${percentageInt > 60 ? '#16a34a' : percentageInt > 30 ? '#f59e0b' : '#dc2626'}">
        ${percentageInt > 60 ? '✅ ÓPTIMO' : percentageInt > 30 ? '⚠️ REGULAR' : '🚨 CRÍTICO'}
      </p>
      <p style="margin:0; font-size:24px; font-weight:bold;">${percentageInt}% de capacidad</p>
      <p style="margin:5px 0 0; font-size:16px; color:#64748b;">Aproximadamente ${Math.round(currentLiters).toLocaleString()} Litros</p>
    </div>

    <div style="margin-bottom:35px; font-size:15px; color:#334155;">
      <p>Estimado/a Vecino/a,</p>
      <p>Le presentamos el resumen más reciente del nivel de agua en nuestro tanque, basado en los datos aportados por la comunidad. Su participación es clave para mantener un control eficiente del recurso hídrico.</p>
    </div>

    <div style="background:#f1f5f9; padding:20px; border-radius:12px; margin-bottom:35px;">
      <h3 style="margin:0 0 15px; color:#1e40af; font-size:17px;">💡 Principales Indicadores del Tanque al Día de Hoy 🔍</h3>
      <p style="margin:0 0 15px; font-size:12px; color:#64748b;">Reporte generado: ${indicators.reportDate} — Último registro: ${new Date(lastRecord.recorded_at).toLocaleString('es-ES')} — Nivel: ${Math.round(lastRecord.percentage)}%</p>
      
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr><td style="padding:6px 0;">1️⃣ <b>Balance últimas 24 horas:</b></td><td style="padding:6px 0;">Se consumieron ${Math.round(indicators.balance24h.consumed).toLocaleString()} L y se llenaron ${Math.round(indicators.balance24h.filled).toLocaleString()} L. Balance neto: ${Math.round(indicators.balance24h.net).toLocaleString()} L.</td></tr>
        <tr><td style="padding:6px 0;">2️⃣ <b>Caudal promedio últimas 24h:</b></td><td style="padding:6px 0;">${indicators.avgFlow24h.toFixed(1)} L/h (${indicators.balance24h.net >= 0 ? 'llenado neto' : 'consumo neto'})</td></tr>
        <tr><td style="padding:6px 0;">3️⃣ <b>Última medición — Caudal:</b></td><td style="padding:6px 0;">${flowDirIcon} ${flowLph.toFixed(1)} L/h (${flowTypeText}) — ${(flowLph/60).toFixed(2)} L/min</td></tr>
        <tr><td style="padding:6px 0;">4️⃣ <b>Nivel actual del tanque:</b></td><td style="padding:6px 0;">${percentageInt}% — ${Math.round(currentLiters).toLocaleString()} L de ${building.tank_capacity_liters.toLocaleString()} L de capacidad total</td></tr>
        <tr><td style="padding:6px 0;">5️⃣ <b>Proyección nivel a las 11:00 PM:</b></td><td style="padding:6px 0;">Nivel estimado: ${indicators.projection11pm.toFixed(1)}% (${Math.round(indicators.projectedLiters11pm).toLocaleString()} L)</td></tr>
        <tr><td style="padding:6px 0;">6️⃣ <b>Tiempo estimado hasta ${flowLpm >= 0 ? 'completado' : 'vaciado'}:</b></td><td style="padding:6px 0;">${indicators.timeEstimate} — Fecha estimada: ${indicators.estimateDate}</td></tr>
        <tr><td style="padding:6px 0;">7️⃣ <b>Llenado registrado hoy:</b></td><td style="padding:6px 0;">${indicators.filledToday.toLocaleString()} L</td></tr>
        <tr><td style="padding:6px 0;">8️⃣ <b>Variación última medición:</b></td><td style="padding:6px 0;">${(lastRecord.variation_lts || 0) > 0 ? '+' : ''}${Math.round(lastRecord.variation_lts || 0).toLocaleString()} L (${(lastRecord.variation_lts || 0) > 0 ? 'entrada de agua' : 'consumo / salida de agua'})</td></tr>
      </table>
    </div>

    <h3 style="color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-bottom:20px; font-size:18px;">🖼️ Galería de Gráficos de Inteligencia Hídrica</h3>
    <div style="text-align:center; space-y:20px;">
      ${Object.values(chartUrls).map(url => `<div style="margin-bottom:25px;"><img src="${url}" style="width:100%; max-width:650px; border-radius:12px; border:1px solid #e2e8f0; shadow:sm;"></div>`).join('')}
    </div>

    ${indicators.heatmapData ? renderHeatmapHtml(indicators.heatmapData) : ''}

    <h3 style="color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:40px; margin-bottom:20px; font-size:18px;">📋 Detalle de las Últimas 10 Mediciones</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:center;">
        <thead style="background:#1e293b; color:white;">
          <tr>
            <th style="padding:10px;">Fecha y Hora</th>
            <th style="padding:10px;">💧 Litros</th>
            <th style="padding:10px;">📊 %</th>
            <th style="padding:10px;">📈 Variación (L)</th>
            <th style="padding:10px;">Caudal (L/min)</th>
            <th style="padding:10px;">T. Llenado</th>
            <th style="padding:10px;">T. Vaciado</th>
            <th style="padding:10px;">👥 Por</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <h3 style="color:#0f172a; margin-top:40px; font-size:17px;">⭐ Último Registro</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:center; background:#f8fafc; border:1px solid #e2e8f0;">
      <tr style="background:#334155; color:white;"><th style="padding:10px;">Fecha y Hora</th><th style="padding:10px;">Litros</th><th style="padding:10px;">%</th><th style="padding:10px;">Variación</th><th style="padding:10px;">Caudal</th><th style="padding:10px;">Estimado</th></tr>
      <tr>
        <td style="padding:10px;">${new Date(lastRecord.recorded_at).toLocaleString('es-ES')}</td>
        <td style="padding:10px;">${Math.round(lastRecord.liters).toLocaleString()}</td>
        <td style="padding:10px; font-weight:bold;">${Math.round(lastRecord.percentage)}%</td>
        <td style="padding:10px;">${(lastRecord.variation_lts || 0) > 0 ? '+' : ''}${Math.round(lastRecord.variation_lts || 0).toLocaleString()} L</td>
        <td style="padding:10px;">${Number(lastRecord.flow_lpm || 0).toFixed(2)}</td>
        <td style="padding:10px;">${indicators.timeEstimate}</td>
      </tr>
    </table>

    <div style="margin-top:50px; padding-top:30px; border-top:1px solid #e2e8f0; font-size:13px; color:#475569;">
      <h4 style="color:#0f172a; margin-bottom:15px;">*** Observaciones y Explicación de Gráficos ***</h4>
      <ul style="padding-left:20px; space-y:10px;">
        <li><b>Caudal de Llenado y Consumo:</b> Muestra la tasa de cambio en litros por minuto. Barras verdes indican llenado, barras rojas consumo.</li>
        <li><b>Evolución del Nivel del Tanque (%):</b> Línea azul con área sombreada. Puntos: Verde (>60%), Naranja (30-60%) y Rojo (<30%).</li>
        <li><b>Variación entre Mediciones:</b> Diferencia neta de litros entre reportes consecutivos.</li>
        <li><b>Nivel del Tanque con Umbrales:</b> Visualiza el nivel histórico comparado con las líneas de alerta crítica.</li>
        <li><b>Consumo Promedio por Día de Semana:</b> Promedio histórico de litros consumidos (solo variaciones negativas).</li>
        <li><b>Nivel % por Día — Últimas 4 Semanas:</b> Compara patrones de nivel entre las últimas 4 semanas naturales.</li>
        <li><b>Distribución de Consumo por Día:</b> Vista proporcional de qué días se consume más agua históricamente.</li>
        <li><b>Proyección de Llenado/Vaciado:</b> Fechas estimadas para alcanzar niveles críticos basado en el caudal actual.</li>
      </ul>
    </div>

    <div style="background:#f0f7ff; padding:20px; border-radius:12px; margin-top:40px;">
      <h4 style="color:#1e40af; margin:0 0 10px 0;">ℹ️ ¿Cómo interpretar el Caudal?</h4>
      <p style="font-size:13px; margin:0;">El caudal neto representa la tasa de cambio. Un valor <b>positivo</b> indica que el tanque se está llenando (entrada > consumo). Un valor <b>negativo</b> señala disminución (consumo > entrada). El tiempo estimado proyecta cuándo se vaciará o llenará el tanque si el ritmo se mantiene.</p>
    </div>

    <div style="background:#fffbeb; padding:20px; border-radius:12px; margin-top:25px; border:1px solid #fef3c7;">
      <h4 style="color:#92400e; margin:0 0 10px 0;">IMPORTANTE: Sistema de Resúmenes por Correo</h4>
      <p style="font-size:12px; margin:0;">✉️ <b>Activación:</b> Cada vez que registre un dato e incluya su correo, activará los próximos <b>5 resúmenes</b>.<br>➡️ <b>Fin del Ciclo:</b> Tras 5 correos, dejará de recibirlos hasta que vuelva a registrar una medición.</p>
    </div>

    <div style="margin-top:50px; text-align:center; font-size:12px; color:#94a3b8;">
      <p style="margin:0;">Saludos cordiales,<br><b>Comisión de Agua del Edificio</b></p>
      <p style="margin:15px 0;">Sistema AquaSaaS — Informe automático. 2026 ©<br><small>Por favor, no responda a este email.</small></p>
      <p style="margin:0; font-weight:bold; color:#64748b;">aquamanbombas@hotmail.com</p>
    </div>

  </div>
</body>
</html>`.trim();
}
