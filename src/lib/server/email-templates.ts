/**
 * SERVICIO: email-templates.ts
 * DESCRIPCIÓN: Plantilla MAESTRA FINAL RIGUROSA con 16 gráficos en pares, Mapa de Calor al inicio y texto literal sagrado.
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

  const sortedDesc = [...measurements].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  const lastRecord = sortedDesc[0];
  const last10 = sortedDesc.slice(0, 10);

  // Tablas de datos
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

  // Definición de pares de gráficos (16 en total)
  const chartPairs = [
    { left: { key: 'caudalChart', label: 'Caudal de llenado y consumo (l/min)' }, right: { key: 'combinadoChart', label: 'Evolucion del nivel del tanque (%)' } },
    { left: { key: 'variationChart', label: 'Variacion entre mediciones' }, right: { key: 'thresholdChart', label: 'Nivel con umbrales de alerta' } },
    { left: { key: 'dayOfWeekChart', label: 'consumo promedio por dia de semana' }, right: { key: 'last4WeeksChart', label: 'Nivel % por dia - ultimas 5 semanas' } },
    { left: { key: 'nightlyLitrosChart', label: 'consumo nocturno estimado' }, right: { key: 'consumoSemanalDoughnut', label: 'Distribucion de consume por dia (historico)' } },
    { left: { key: 'weekendChart', label: 'consumo fines de semana (5 semanas)' }, right: { key: 'projectionFillingChart', label: 'Proyeccion de llenado/vaciado' } },
    { left: { key: 'caudalHoraChart', label: 'caudal en litros por hora' }, right: { key: 'historicoMensualChart', label: 'historico mensual - consume y llenado' } },
    { left: { key: 'weekendLitrosChart', label: 'consumo/llenado sab-dom (5 semanas)' }, right: { key: 'semanaVsAnteriorChart', label: 'consume por dia - semana actual vs anterior' } },
    { left: { key: 'weekendVariacionChart', label: 'variacion % sab-dom (5 semanas)' }, right: { key: 'franjaHorariaChart', label: 'consume promedio por franja horaria' } }
  ];

  let chartGalleryHtml = '<table width="100%" border="0" cellspacing="0" cellpadding="5">';
  chartPairs.forEach(pair => {
    chartGalleryHtml += '<tr>';
    // Lado Izquierdo
    chartGalleryHtml += `<td width="50%" align="center" style="vertical-align:top; padding-bottom:25px;">
      <div style="font-size:10px; color:#64748b; margin-bottom:5px; font-weight:bold;">${pair.left.label}</div>
      <img src="${chartUrls[pair.left.key]}" style="width:100%; max-width:380px; height:auto; border-radius:8px; border:1px solid #e2e8f0;">
    </td>`;
    // Lado Derecho
    chartGalleryHtml += `<td width="50%" align="center" style="vertical-align:top; padding-bottom:25px;">
      <div style="font-size:10px; color:#64748b; margin-bottom:5px; font-weight:bold;">${pair.right.label}</div>
      <img src="${chartUrls[pair.right.key]}" style="width:100%; max-width:380px; height:auto; border-radius:8px; border:1px solid #e2e8f0;">
    </td>`;
    chartGalleryHtml += '</tr>';
  });
  chartGalleryHtml += '</table>';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:900px;margin:0 auto;background:#fff;line-height:1.6;">

  <div style="padding:20px; border:1px solid #e2e8f0;">
    
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

    <div style="background:#f1f5f9; padding:20px; border-radius:12px; margin-bottom:15px;">
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
          <td style="padding:10px;">${new Date(lastRecord.recorded_at).toLocaleString('es-ES')}</td>
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
      <p style="margin-bottom:10px;"><b>Caudal de Llenado y Consumo:</b> Muestra la tasa de cambio en litros por minuto. Barras verdes indican llenado (entrada de agua), barras rojas indican consumo (salida de agua).</p>
      <p style="margin-bottom:10px;"><b>Evolución del Nivel del Tanque (%):</b> Línea azul con área sombreada mostrando el porcentaje del nivel a lo largo del tiempo. Los puntos se colorean en verde (>60%), naranja (30-60%) y rojo (<30%) según el umbral de alerta.</p>
      <p style="margin-bottom:10px;"><b>Variación entre Mediciones:</b> Diferencia de litros entre reportes consecutivos. Barras verdes = llenado, barras rojas = consumo.</p>
      <p style="margin-bottom:10px;"><b>Nivel del Tanque con Umbrales:</b> Visualiza el nivel histórico con líneas de alerta: Alerta ${Math.round(building.tank_capacity_liters * 0.6).toLocaleString()} L (60%), Racionamiento ${Math.round(building.tank_capacity_liters * 0.4).toLocaleString()} L (40%), Crítico ${Math.round(building.tank_capacity_liters * 0.2).toLocaleString()} L (20%).</p>
      <p style="margin-bottom:10px;"><b>Consumo Promedio por Día de Semana (barras):</b> Promedio histórico de litros consumidos por cada día. Solo considera variaciones negativas (consumo real).</p>
      <p style="margin-bottom:10px;"><b>Nivel % por Día — Últimas 4 Semanas:</b> Cada línea representa una semana. El eje X muestra los días Lun–Dom. Permite comparar patrones entre semanas.</p>
      <p style="margin-bottom:10px;"><b>Consumo Nocturno Estimado:</b> Litros consumidos entre mediciones consecutivas. Representa el consumo en los períodos registrados.</p>
      <p style="margin-bottom:10px;"><b>Distribución de Consumo por Día (Doughnut):</b> Vista proporcional del consumo promedio histórico por día de la semana. Permite identificar qué días se consume más agua.</p>
      <p style="margin-bottom:10px;"><b>Consumo Fin de Semana — Últimas 5 Semanas:</b> Barras amarillas = sábados, barras azules = domingos. Muestra la evolución real del consumo en cada fin de semana.</p>
      <p style="margin-bottom:10px;"><b>Proyección de Llenado/Vaciado:</b> Basado en el caudal de la última medición, proyecta las fechas y horas estimadas para alcanzar niveles críticos (vaciado: 60%, 40%, 30%, 20%, 0%) o completos (llenado: 50%, 60%, 80%, 90%, 100%).</p>
      <p style="margin-bottom:10px;"><b>Caudal en Litros por Hora:</b> Evolución del caudal horario en las últimas mediciones. Valores positivos = llenado, negativos = consumo.</p>
      <p style="margin-bottom:10px;"><b>Histórico Mensual — Consumo y Llenado:</b> Barras rojas = litros consumidos por mes, barras verdes = litros de llenado por mes. Muestra los últimos 6 meses.</p>
      <p style="margin-bottom:10px;"><b>Consumo/Llenado Sáb-Dom (5 semanas):</b> Barras agrupadas mostrando litros consumidos y llenados cada sábado y domingo de las últimas 5 semanas. Permite identificar patrones de fin de semana.</p>
      <p style="margin-bottom:10px;"><b>Consumo por Día — Semana Actual vs Anterior:</b> Barras azules = semana actual, grises = semana anterior. Comparación directa del consumo diario entre ambas semanas.</p>
      <p style="margin-bottom:10px;"><b>Variación % Sáb-Dom (5 semanas):</b> Cambio neto en puntos porcentuales del nivel del tanque durante cada sábado y domingo. Verde = el tanque subió, rojo = bajó.</p>
      <p style="margin-bottom:10px;"><b>Consumo Promedio por Franja Horaria:</b> El consumo histórico agrupado en franjas de 6 horas (madrugada, mañana, tarde, noche). La barra roja indica la franja de mayor consumo.</p>
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
      <p style="font-size:13px; margin-bottom:5px;">✉️ <b>Activación de Resúmenes:</b> Cada vez que usted registre un nuevo dato en el formulario e incluya su correo electrónico, activará la recepción de los próximos <b>5 resúmenes</b> de estadísticas del agua.</p>
      <p style="font-size:13px; margin-bottom:5px;">➡️ <b>Fin del Ciclo:</b> Una vez que haya recibido esos 5 correos, su ciclo de suscripción actual finalizará y dejará de recibir notificaciones.</p>
      <p style="font-size:13px; margin-bottom:10px;">➡️ <b>Reactivar su Suscripción:</b> ¿Desea seguir recibiendo estas valiosas actualizaciones? ¡Es muy fácil! Simplemente, vuelva a registrar un nuevo dato en el formulario e indique nuevamente su correo electrónico.</p>
      <p style="font-size:13px; margin-top:15px;">Agradecemos su colaboración en el monitoreo del agua. ¡Cada dato registrado es un paso hacia una mejor gestión del agua en el edificio!</p>
    </div>

    <div style="margin-top:50px; text-align:center; font-size:12px; color:#94a3b8;">
      <p style="margin:0;">Saludos cordiales,<br><b>Comisión de Agua del Edificio</b></p>
      <p style="margin:15px 0;">Sistema AquaSaaS — Informe automático. 2026 © Todos los derechos reservados.</p>
      <p style="font-size:11px; margin-top:20px;"><b>NOTA:</b> Por favor, no responder al remitente de este email, ya que esta notificación es enviada en forma automática por nuestros sistemas, y se trata de una dirección que solamente se utiliza para el envío de emails y su buzón de entrada no es monitoreado ni será atendido por ninguna persona.</p>
    </div>

  </div>
</body>
</html>`.trim();
}
