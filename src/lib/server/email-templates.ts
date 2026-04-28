/**
 * SERVICIO: email-templates.ts
 * DESCRIPCIÓN: Plantilla MAESTRA FINAL con enriquecimiento de datos en tiempo real para tablas precisas.
 */

import { Indicators } from '@/lib/calculations';
import { differenceInMinutes } from 'date-fns';

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
  chartUrls: any,
  settings?: {
    emails_on_subscription?: number,
    prevention_threshold?: number,
    rationing_threshold?: number
  }
): string {
  const percentageInt = Math.round(percentage);
  const prevThr = settings?.prevention_threshold ?? 60;
  const ratThr  = settings?.rationing_threshold ?? 40;
  const emailsLimit = settings?.emails_on_subscription ?? 5;
  
  // ── ENRIQUECIMIENTO DE DATOS EN TIEMPO REAL ──
  // Ordenamos de más antiguo a más nuevo para calcular
  const enriched = [...measurements].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  
  for (let i = 1; i < enriched.length; i++) {
    const prev = enriched[i - 1];
    const curr = enriched[i];
    
    // Calcular Variación si no existe o es 0
    if (!curr.variation_lts || curr.variation_lts === 0) {
      curr.variation_lts = curr.liters - prev.liters;
    }
    
    // Calcular Caudal (L/min)
    const mins = differenceInMinutes(new Date(curr.recorded_at), new Date(prev.recorded_at));
    if (mins > 0 && (!curr.flow_lpm || curr.flow_lpm === 0)) {
      curr.flow_lpm = curr.variation_lts / mins;
    }
  }

  // Ahora invertimos para las tablas (más reciente primero)
  const sortedDesc = enriched.reverse();
  const lastRecord = sortedDesc[0];
  const last10 = sortedDesc.slice(0, 10);

  const flowLpm = lastRecord.flow_lpm || 0;
  const flowLph = Math.abs(flowLpm * 60);
  const flowDirIcon = flowLpm >= 0 ? '🟢' : '🔴';
  const flowTypeText = flowLpm >= 0 ? 'llenado' : 'consumo';

  // Función de formateo de fecha personalizada: dd/mm/aaaa hh:mm AM/PM
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(',', '').toUpperCase();
  };

  const tableRows = last10.map(m => {
    const varLts = m.variation_lts || 0;
    const flow = m.flow_lpm || 0;
    const tLlenado = (flow > 0.01) ? (Math.abs((building.tank_capacity_liters - m.liters) / flow) / 1440).toFixed(2) + ' d' : '—';
    const tVaciado = (flow < -0.01) ? (Math.abs(m.liters / flow) / 1440).toFixed(2) + ' d' : '—';
    
    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px;text-align:left;">${formatDate(m.recorded_at)}</td>
        <td style="padding:8px;">${Math.round(m.liters).toLocaleString()}</td>
        <td style="padding:8px;font-weight:bold;">${Math.round(m.percentage)}%</td>
        <td style="padding:8px;color:${varLts >= 0 ? '#16a34a' : '#dc2626'}">${varLts > 0 ? '+' : ''}${Math.round(varLts).toLocaleString()}</td>
        <td style="padding:8px;">${Number(flow).toFixed(2)}</td>
        <td style="padding:8px;">${tLlenado}</td>
        <td style="padding:8px;">${tVaciado}</td>
        <td style="padding:8px;">${m.collaborator_name || 'Vecino'}</td>
      </tr>
    `;
  }).join('');

  // Mapa de traducción para los títulos de los gráficos
  const chartTitles: { [key: string]: string } = {
    caudalChart:            'Caudal de Llenado y Consumo',
    combinadoChart:         'Evolución del Nivel del Tanque (%)',
    variationChart:         'Variación entre Mediciones',
    thresholdChart:         'Nivel con Umbrales de Alerta',
    dayOfWeekChart:         'Consumo Promedio por Día de Semana',
    last4WeeksChart:        'Nivel % por Día — Últimas 4 Semanas',
    nightlyLitrosChart:     'Consumo Nocturno Estimado',
    consumoSemanalDoughnut: 'Distribución de Consumo por Día (histórico)',
    weekendChart:           'Consumo Fines de Semana (5 semanas)',
    projectionFillingChart: 'Proyección de Llenado/Vaciado',
    caudalHoraChart:        'Caudal en Litros por Hora',
    historicoMensualChart:  'Histórico Mensual — Consumo y Llenado',
    weekendLitrosChart:     'Consumo/Llenado Sáb-Dom (5 semanas)',
    semanaVsAnteriorChart:  'Consumo por Día — Semana Actual vs Anterior',
    weekendVariacionChart:  'Variación % Sáb-Dom (5 semanas)',
    franjaHorariaChart:     'Consumo Promedio por Franja Horaria'
  };

  // Lógica de Doble Columna para Gráficos (Filtrando el Gauge)
  const chartEntries = Object.entries(chartUrls).filter(([key]) => key !== 'gaugeChart');
  let chartGalleryHtml = '<table width="100%" border="0" cellspacing="0" cellpadding="5">';
  for (let i = 0; i < chartEntries.length; i += 2) {
    const pair = chartEntries.slice(i, i + 2);
    chartGalleryHtml += '<tr>';
    pair.forEach(([key, url]) => {
      const title = chartTitles[key] || key.replace('Chart', '').toUpperCase();
      chartGalleryHtml += `<td width="50%" align="center" style="vertical-align:top; padding-bottom:25px;">
        <div style="font-size:11px; color:#0f172a; margin-bottom:8px; font-weight:bold; text-transform:none;">${title}</div>
        <img src="${url}" style="width:100%; max-width:380px; height:auto; border-radius:8px; border:1px solid #e2e8f0;">
      </td>`;
    });
    if (pair.length === 1) chartGalleryHtml += '<td width="50%"></td>';
    chartGalleryHtml += '</tr>';
  }
  chartGalleryHtml += '</table>';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:900px;margin:0 auto;background:#fff;line-height:1.6;">

  <div style="padding:20px; border:1px solid #e2e8f0;">
    
    <div style="text-align:center; margin-bottom:30px;">
      <h1 style="margin:0; color:#0f172a; font-size:24px;">✨ Resumen de las Últimas Mediciones de Agua ✨</h1>
      <p style="margin:5px 0 0; color:#64748b; font-size:16px;">Edificio <strong>${building.name}</strong> — Sistema aGuaSaaS</p>
      <p style="margin:10px 0 0; color:#94a3b8; font-size:13px;">Generado: ${indicators.reportDate}</p>
    </div>

    <div style="text-align:center; margin-bottom:40px; background:white; padding:25px; border-radius:20px; border:2px solid #f1f5f9;">
      <p style="margin:0 0 10px; font-size:14px; font-weight:bold; color:#64748b; text-transform:uppercase; tracking-widest:0.1em;">Estado de Reserva Actual</p>
      <p style="margin:0 0 15px; font-size:32px; font-weight:bold; color:${percentageInt > prevThr ? '#16a34a' : percentageInt > ratThr ? '#f59e0b' : '#dc2626'}">
        ${percentageInt > prevThr ? '✅ ÓPTIMO' : percentageInt > ratThr ? '⚠️ REGULAR' : '🚨 CRÍTICO'}
      </p>
      <p style="margin:0; font-size:24px; font-weight:bold;">${percentageInt}% de capacidad</p>
      <p style="margin:5px 0 0; font-size:16px; color:#64748b;">Aproximadamente ${Math.round(currentLiters).toLocaleString()} Litros</p>
    </div>

    <div style="margin-bottom:35px; font-size:15px; color:#334155;">
      <p>Estimado/a Vecino/a,</p>
      <p>Le presentamos el resumen más reciente del nivel de agua en nuestro tanque, basado en los datos aportados por la comunidad. Su participación es clave para mantener un control eficiente del recurso hídrico.</p>
    </div>

    <div style="background:#f1f5f9; padding:20px; border-radius:12px; margin-bottom:15px;">
      <h3 style="margin:0 0 15px; color:#1e40af; font-size:17px;">💡 Principales Indicadores del Tanque al Día de Hoy 🔍</h3>
      <p style="margin:0 0 15px; font-size:12px; color:#64748b;">Reporte generado: ${indicators.reportDate} — Último registro: ${formatDate(lastRecord.recorded_at)} — Nivel: ${Math.round(lastRecord.percentage)}%</p>
      
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

    <!-- MAPA DE CALOR -->
    ${indicators.heatmapData ? renderHeatmapHtml(indicators.heatmapData) : ''}

    <h3 style="color:#0f172a; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:40px; margin-bottom:20px; font-size:18px;">🖼️ Galería de Gráficos de Inteligencia Hídrica</h3>
    
    ${chartGalleryHtml}

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
            <th style="padding:10px;">👥 Reportado por</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <h3 style="color:#0f172a; margin-top:40px; font-size:17px;">⭐ Último Registro</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:center; background:#f8fafc; border:1px solid #e2e8f0;">
      <thead style="background:#334155; color:white;">
        <tr>
          <th style="padding:10px;">Fecha y Hora</th>
          <th style="padding:10px;">💧 Litros</th>
          <th style="padding:10px;">📊 %</th>
          <th style="padding:10px;">📈 Variación (L)</th>
          <th style="padding:10px;">Caudal (L/min)</th>
          <th style="padding:10px;">Tiempo Estimado</th>
          <th style="padding:10px;">👥 Reportado por</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px;">${formatDate(lastRecord.recorded_at)}</td>
          <td style="padding:10px;">${Math.round(lastRecord.liters).toLocaleString()}</td>
          <td style="padding:10px; font-weight:bold;">${Math.round(lastRecord.percentage)}%</td>
          <td style="padding:10px;">${(lastRecord.variation_lts || 0) > 0 ? '+' : ''}${Math.round(lastRecord.variation_lts || 0).toLocaleString()}</td>
          <td style="padding:10px;">${Number(lastRecord.flow_lpm || 0).toFixed(2)}</td>
          <td style="padding:10px;">${indicators.timeEstimate}</td>
          <td style="padding:10px;">${lastRecord.collaborator_name || 'Vecino'}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top:50px; padding-top:30px; border-top:1px solid #e2e8f0; font-size:13px; color:#475569;">
      <h4 style="color:#0f172a; margin-bottom:15px;">*** Observaciones y Explicación de Gráficos ***</h4>
      <p style="margin-bottom:10px;">1. <b>Caudal de Llenado y Consumo:</b> Muestra la tasa de cambio en litros por minuto. Barras verdes indican llenado (entrada de agua), barras rojas indican consumo (salida de agua).</p>
      <p style="margin-bottom:10px;">2. <b>Evolución del Nivel del Tanque (%):</b> Línea azul con área sombreada mostrando el porcentaje del nivel a lo largo del tiempo. Los puntos se colorean en verde (>${prevThr}%), naranja (${ratThr}-${prevThr}%) y rojo (<${ratThr}%) según el umbral de alerta.</p>
      <p style="margin-bottom:10px;">3. <b>Variación entre Mediciones:</b> Diferencia de litros entre reportes consecutivos. Barras verdes = llenado, barras rojas = consumo.</p>
      <p style="margin-bottom:10px;">4. <b>Nivel del Tanque con Umbrales:</b> Visualiza el nivel histórico con líneas de alerta: Alerta ${Math.round(building.tank_capacity_liters * (prevThr/100)).toLocaleString()} L (${prevThr}%), Racionamiento ${Math.round(building.tank_capacity_liters * (ratThr/100)).toLocaleString()} L (${ratThr}%), Crítico ${Math.round(building.tank_capacity_liters * 0.2).toLocaleString()} L (20%).</p>
      <p style="margin-bottom:10px;">5. <b>Consumo Promedio por Día de Semana (barras):</b> Promedio histórico de litros consumidos por cada día. Solo considera variaciones negativas (consumo real).</p>
      <p style="margin-bottom:10px;">6. <b>Nivel % por Día — Últimas 5 Semanas:</b> Cada línea representa una semana. El eje X muestra los días Lun–Dom. Permite comparar patrones entre semanas.</p>
      <p style="margin-bottom:10px;">7. <b>Consumo Nocturno Estimado:</b> Litros consumidos entre mediciones consecutivas. Representa el consumo en los períodos registrados.</p>
      <p style="margin-bottom:10px;">8. <b>Distribución de Consumo por Día (Doughnut):</b> Vista proporcional del consumo promedio histórico por día de la semana. Permite identificar qué días se consume más agua.</p>
      <p style="margin-bottom:10px;">9. <b>Consumo Fin de Semana — Últimas 5 Semanas:</b> Barras amarillas = sábados, barras azules = domingos. Muestra la evolución real del consumo en cada fin de semana.</p>
      <p style="margin-bottom:10px;">10. <b>Proyección de Llenado/Vaciado:</b> Basado en el caudal de la última medición, proyecta las fechas y horas estimadas para alcanzar niveles críticos (vaciado: ${prevThr}%, ${ratThr}%, 30%, 20%, 0%) o completos (llenado: 50%, 60%, 80%, 90%, 100%).</p>
      <p style="margin-bottom:10px;">11. <b>Caudal en Litros por Hora:</b> Evolución del caudal horario en las últimas mediciones. Valores positivos = llenado, negativos = consumo.</p>
      <p style="margin-bottom:10px;">12. <b>Histórico Mensual — Consumo y Llenado:</b> Barras rojas = litros consumidos por mes, barras verdes = litros de llenado por mes. Muestra los últimos 6 meses.</p>
      <p style="margin-bottom:10px;">13. <b>Consumo/Llenado Sáb-Dom (5 semanas):</b> Barras agrupadas mostrando litros consumidos y llenados cada sábado y domingo de las últimas 5 semanas. Permite identificar patrones de fin de semana.</p>
      <p style="margin-bottom:10px;">14. <b>Consumo por Día — Semana Actual vs Anterior:</b> Barras azules = semana actual, grises = semana anterior. Comparación directa del consumo diario entre ambas semanas.</p>
      <p style="margin-bottom:10px;">15. <b>Variación % Sáb-Dom (5 semanas):</b> Cambio neto en puntos porcentuales del nivel del tanque durante cada sábado y domingo. Verde = el tanque subió, rojo = bajó.</p>
      <p style="margin-bottom:10px;">16. <b>Consumo Promedio por Franja Horaria:</b> El consumo histórico agrupado en franjas de 6 horas (madrugada, mañana, tarde, noche). La barra roja indica la franja de mayor consumo.</p>
    </div>

    <div style="background:#f0f7ff; padding:20px; border-radius:12px; margin-top:40px;">
      <h4 style="color:#1e40af; margin:0 0 10px 0;">ℹ️ ¿Cómo interpretar el Caudal?</h4>
      <p style="font-size:13px; margin-bottom:10px;">El caudal neto (L/min) representa la tasa de cambio en el volumen de agua, calculada dividiendo la diferencia de litros entre dos mediciones consecutivas sobre el tiempo transcurrido (en minutos).</p>
      <p style="font-size:13px; margin-bottom:10px;">Un valor <b style="color:#16a34a;">positivo</b> indica que el tanque se está llenando: la entrada de agua supera al consumo.</p>
      <p style="font-size:13px; margin-bottom:10px;">Un valor <b style="color:#dc2626;">negativo</b> señala una disminución en el nivel: el consumo en el edificio supera la entrada de agua, o hay ausencia de suministro desde la red pública.</p>
      <p style="font-size:13px; margin-bottom:10px;">El tiempo estimado de <b>llenado</b> se basa en los caudales positivos, proyectando el tiempo necesario para alcanzar la capacidad máxima (${building.tank_capacity_liters.toLocaleString()} L).</p>
      <p style="font-size:13px;">El tiempo estimado de <b>vaciado</b> se calcula con los caudales negativos, estimando cuánto tardaría el tanque en vaciarse si el consumo se mantiene en ese ritmo.</p>
    </div>

    <div style="background:#fffbeb; padding:20px; border-radius:12px; margin-top:25px; border:1px solid #fef3c7;">
      <h4 style="color:#92400e; margin:0 0 10px 0;">IMPORTANTE (Manténgase Informado): Así Funciona Nuestro Sistema de Resúmenes por Correo</h4>
      <p style="font-size:13px; margin-bottom:10px;">Para que siempre esté al tanto del nivel del agua de nuestro tanque, hemos diseñado un sistema de notificación muy sencillo:</p>
      <p style="font-size:13px; margin-bottom:5px;">✉️ <b>Activación de Resúmenes:</b> Cada vez que usted registre un nuevo dato en el formulario e incluya su correo electrónico, activará la recepción de los próximos <b>${emailsLimit} resúmenes</b> de estadísticas del agua.</p>
      <p style="font-size:13px; margin-bottom:5px;">➡️ <b>Fin del Ciclo:</b> Una vez que haya recibido esos ${emailsLimit} correos, su ciclo de suscripción actual finalizará y dejará de recibir notificaciones.</p>
      <p style="font-size:13px; margin-bottom:10px;">➡️ <b>Reactivar su Suscripción:</b> ¿Desea seguir recibiendo estas valiosas actualizaciones? ¡Es muy fácil! Simplemente, vuelva a registrar un nuevo dato en el formulario e indique nuevamente su correo electrónico.</p>
      <p style="font-size:13px; margin-top:15px;">Agradecemos su colaboración en el monitoreo del agua. ¡Cada dato registrado es un paso hacia una mejor gestión del agua en el edificio!</p>
    </div>

    <div style="margin-top:50px; text-align:center; font-size:12px; color:#94a3b8;">
      <p style="margin:0;">Saludos cordiales,<br><b>Comisión de Agua del Edificio</b></p>
      <p style="margin:15px 0;">Sistema aGuaSaaS — Informe automático. 2026 © Todos los derechos reservados.</p>
      <p style="font-size:11px; margin-top:20px;"><b>NOTA:</b> Por favor, no responder al remitente de este email, ya que esta notificación es enviada en forma automática por nuestros sistemas, y se trata de una dirección que solamente se utiliza para el envío de emails y su buzón de entrada no es monitoreado ni será atendido por ninguna persona.</p>
    </div>

  </div>
</body>
</html>`.trim();
}

export function buildAiAnalysisEmailHtml(building: any, report: any, chartUrls?: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background-color: #0d6efd; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Análisis de Inteligencia Hídrica</h1>
      <p style="color: #e0f2fe; margin: 10px 0 0 0; font-size: 14px; font-weight: 500; opacity: 0.9;">Edificio ${building.name}</p>
    </div>

    <!-- Intro Card -->
    <div style="padding: 30px;">
      <div style="background-color: #f0f9ff; border-left: 4px solid #0d6efd; padding: 20px; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
        <h2 style="color: #0c4a6e; margin: 0 0 10px 0; font-size: 16px; font-weight: 700;">Resumen del Informe</h2>
        <p style="color: #075985; margin: 0; font-size: 14px; line-height: 1.5;">
          Este informe ha sido generado automáticamente utilizando algoritmos de Inteligencia Artificial de aGuaSaaS, 
          analizando el comportamiento histórico y los patrones de consumo de su edificación.
        </p>
      </div>

      <!-- Report Content -->
      <div style="margin-bottom: 40px;">
        ${report.html_report}
      </div>

      ${chartUrls ? `
      <!-- Charts Section -->
      <div style="border-top: 2px solid #f1f5f9; padding-top: 30px; margin-top: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; font-weight: 800; margin-bottom: 20px; text-align: center;">Visualización de Datos Actualizados</h2>
        
        <div style="margin-bottom: 25px; text-align: center;">
          <p style="font-size: 12px; color: #64748b; margin-bottom: 10px; font-weight: 700; text-transform: uppercase;">Estado Actual del Tanque</p>
          <img src="${chartUrls.gauge}" alt="Nivel Actual" style="width: 250px; height: auto; border-radius: 8px;">
        </div>

        <div style="margin-bottom: 25px; text-align: center;">
          <p style="font-size: 12px; color: #64748b; margin-bottom: 10px; font-weight: 700; text-transform: uppercase;">Tendencia de Consumo Reciente</p>
          <img src="${chartUrls.trend}" alt="Tendencia" style="width: 100%; max-width: 500px; height: auto; border: 1px solid #f1f5f9; border-radius: 12px;">
        </div>

        <div style="margin-bottom: 25px; text-align: center;">
          <p style="font-size: 12px; color: #64748b; margin-bottom: 10px; font-weight: 700; text-transform: uppercase;">Consumo por Día de la Semana</p>
          <img src="${chartUrls.dayOfWeek}" alt="Consumo por Día" style="width: 100%; max-width: 500px; height: auto; border: 1px solid #f1f5f9; border-radius: 12px;">
        </div>
      </div>
      ` : ''}

      <!-- Footer Action -->
      <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #f1f5f9;">
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">
          Para ver más detalles o configurar los reportes automáticos, acceda a su panel de administración.
        </p>
        <a href="https://aguasaas.vercel.app/edificio-admin/${building.slug || building.id}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; display: inline-block;">
          Ir al Panel de Administración
        </a>
      </div>
    </div>

    <!-- Legal Footer -->
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
      <p style="margin: 0; font-size: 11px; color: #94a3b8;">
        &copy; 2026 aGuaSaaS — Monitoreo Inteligente de Agua. Todos los derechos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function buildAnomalyEmailHtml(
  building: any, 
  newLiters: number, 
  newPercentage: number, 
  prevLiters: number, 
  prevPercentage: number, 
  variationPct: number, 
  recordedAt: string, 
  reportedBy: string,
  threshold: number = 30
): string {
  const variationLtrs = newLiters - prevLiters;
  const isIncrease = variationLtrs > 0;
  const absVariationPct = variationPct; // ya viene como valor absoluto desde la ruta
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background-color: #f8fafc;">
  <div style="background: #dc2626; color: white; padding: 25px; border-radius: 20px 20px 0 0; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">⚠️ Anomalía Detectada</h1>
    <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px; font-weight: 500;">Edificio: ${building.name}</p>
  </div>
  
  <div style="background: white; border: 1px solid #e2e8f0; border-top: none; padding: 30px; border-radius: 0 0 20px 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
    
    <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 16px; padding: 25px; margin-bottom: 30px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Variación Registrada</p>
      <p style="margin: 12px 0 0; font-size: 48px; font-weight: 900; color: #dc2626; line-height: 1;">${absVariationPct.toFixed(1)}%</p>
      <p style="margin: 10px 0 0; font-size: 16px; color: #b91c1c; font-weight: 600;">${isIncrease ? '📈 Aumento' : '📉 Disminución'} brusca de nivel</p>
    </div>

    <div style="margin-bottom: 30px;">
      <h3 style="color: #0f172a; font-size: 18px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-top: 0; margin-bottom: 15px;">📊 Análisis de la Medición</h3>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <tr style="border-bottom: 1px solid #f8fafc;">
          <td style="padding: 12px 0; color: #64748b; font-weight: 500;">Dato Anterior:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #334155;">${Math.round(prevLiters).toLocaleString()} L <span style="color: #94a3b8; font-weight: 400; font-size: 13px;">(${Number(prevPercentage).toFixed(1)}%)</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #f8fafc;">
          <td style="padding: 12px 0; color: #64748b; font-weight: 500;">Dato Registrado:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #0f172a;">${Math.round(newLiters).toLocaleString()} L <span style="color: #94a3b8; font-weight: 400; font-size: 13px;">(${Number(newPercentage).toFixed(1)}%)</span></td>
        </tr>
        <tr style="border-bottom: 1px solid #f8fafc;">
          <td style="padding: 12px 0; color: #64748b; font-weight: 500;">Variación Absoluta:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; color: ${isIncrease ? '#16a34a' : '#dc2626'}">
            ${isIncrease ? '+' : ''}${Math.round(variationLtrs).toLocaleString()} L
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #64748b; font-weight: 500;">Variación Porcentual:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #dc2626;">${absVariationPct.toFixed(1)}% <span style="color: #94a3b8; font-weight: 400; font-size: 12px;">(relativa)</span></td>
        </tr>
      </table>
    </div>

    <div style="background: #f8fafc; border-left: 4px solid #dc2626; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
      <h4 style="margin: 0 0 10px; color: #0f172a; font-size: 16px; font-weight: 700;">🧐 ¿Por qué es una anomalía?</h4>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">
        El sistema detectó que el volumen de agua cambió un <strong>${absVariationPct.toFixed(1)}%</strong> en comparación con el registro anterior. 
        Este cambio supera el <strong>límite de seguridad del ${threshold}%</strong> configurado para <b>${building.name}</b>.
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #475569;">
        <strong>Posibles causas:</strong> Fugas masivas, llenado rápido por cisterna, uso inusual simultáneo o un error en la digitación del registro manual.
      </p>
    </div>

    <div style="background: #f1f5f9; border-radius: 12px; padding: 15px; margin-bottom: 30px;">
      <table style="width: 100%; font-size: 13px;">
        <tr>
          <td style="color: #64748b;">Reportado por:</td>
          <td style="text-align: right; font-weight: 600; color: #334155;">${reportedBy}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Fecha y Hora:</td>
          <td style="text-align: right; font-weight: 600; color: #334155;">${new Date(recordedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="https://aguasaas.vercel.app/edificio-admin/${building.slug || building.id}" style="background: #0f172a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; display: inline-block; transition: all 0.2s;">
        Revisar en el Panel de Control
      </a>
    </div>

    <div style="margin-top: 40px; padding-top: 25px; border-top: 1px solid #f1f5f9; text-align: center;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Aviso automático de seguridad — <strong>Sistema aGuaSaaS</strong>
      </p>
      <p style="font-size: 10px; color: #cbd5e1; margin: 5px 0 0;">
        Si cree que esta alerta es un error, puede ajustar el umbral de sensibilidad en la configuración del edificio.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
