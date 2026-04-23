/**
 * ARCHIVO: src/lib/charts.ts
 * VERSIÓN: 3.1
 * FECHA: 2026-04-09
 * CORRECCIONES v3.1:
 * - Fix crítico: todos los gráficos usan recorded_at para ordenar/filtrar fechas
 * - Gráfico combinado: doble eje Y (litros izq, % der)
 * - Variación: barras rojas/verdes
 * - Tendencia 4 semanas: líneas por semana, eje X = Lun-Dom
 * - Reemplaza "Proyección 23:00" por Doughnut consumo por día semana
 * - Fines de semana: últimas 5 semanas reales
 * - Proyección: fechas/horas reales en eje X
 * - Reemplaza "Tiempo Estimado" por histórico mensual consumo+llenado
 * - Gauge mejorado con umbrales 30/60/100
 */

import { Measurement } from './calculations';
import { format, addMinutes, startOfWeek, addDays, subWeeks, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const QUICKCHART_BASE = 'https://quickchart.io/chart';

// Helper para limpiar objetos de valores no serializables como NaN o Infinity
function sanitize(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) return 0;
    }
    return value;
  }));
}

function enc(cfg: any, w = 700, h = 350): string {
  const sanitizedCfg = sanitize(cfg);
  // Forzamos v=3 para usar la sintaxis moderna de Chart.js
  return `${QUICKCHART_BASE}?v=3&c=${encodeURIComponent(JSON.stringify(sanitizedCfg))}&width=${w}&height=${h}&bkg=white`;
}

// ... (getVar y lastN se mantienen igual) ...

// ── 1. Gauge mejorado ─────────────────────────────────────────────────────────
export function getGaugeChartUrl(percentage: number) {
  const safePct = isNaN(percentage) ? 0 : percentage;
  const pct = Math.round(Math.max(0, Math.min(100, safePct)));
  return enc({
    type: 'gauge',
    data: {
      datasets: [{
        value: pct,
        data: [30, 60, 100],
        backgroundColor: ['#ef4444', '#fbbf24', '#22c55e'],
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        datalabels: {
          display: true,
          formatter: (v: any) => v + '%'
        }
      }
    }
  }, 420, 260);
}

// ── 2. Caudal Llenado/Consumo ─────────────────────────────────────────────────
export function getCaudalChartUrl(measurements: Measurement[]) {
  const data = lastN(measurements, 20);
  const labels = data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm'));
  const flowField = (m: Measurement) => (m.flow_lpm ?? m.caudal_lts_min ?? 0) as number;
  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Llenado (L/min)', data: data.map(m => flowField(m) > 0 ? +flowField(m).toFixed(2) : 0), backgroundColor: '#22c55e' },
        { label: 'Consumo (L/min)', data: data.map(m => flowField(m) < 0 ? +Math.abs(flowField(m)).toFixed(2) : 0), backgroundColor: '#ef4444' }
      ]
    },
    options: { 
      plugins: { title: { display: true, text: 'Caudal — Llenado vs Consumo (L/min)' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ── 3. Porcentaje del Tanque (línea simple) ──────────────────────────────────
export function getCombinadoChartUrl(measurements: Measurement[]) {
  const data = lastN(measurements, 20);
  const labels = data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm'));
  const valores = data.map(m => +m.percentage.toFixed(1));
  const pointColors = valores.map(v => v > 60 ? '#22c55e' : v > 30 ? '#f59e0b' : '#ef4444');
  return enc({
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nivel del Tanque (%)',
        data: valores,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: pointColors,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      plugins: { title: { display: true, text: 'Evolución del Nivel del Tanque (%)' } },
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: '% Nivel' } }
      }
    }
  });
}

// ── 4. Variación entre Mediciones — barras rojas/verdes ──────────────────────
export function getDailyVariationChartUrl(measurements: Measurement[]) {
  const data = lastN(measurements, 20);
  const labels = data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm'));
  const values = data.map(m => +getVar(m));
  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Variación (L)', data: values, backgroundColor: values.map(v => v >= 0 ? '#22c55e' : '#ef4444') }]
    },
    options: { plugins: { title: { display: true, text: 'Variación entre Mediciones (verde=llenado, rojo=consumo)' } } }
  });
}

// ── 5. Nivel con Umbrales ────────────────────────────────────────────────────
export function getThresholdChartUrl(measurements: Measurement[], capacity: number) {
  const data = lastN(measurements, 30);
  const labels = data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm'));
  const n = data.length;
  return enc({
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Nivel Actual', data: data.map(m => Math.round(m.liters)), borderColor: '#3b82f6', borderWidth: 3, pointRadius: 2 },
        { label: `60% (${Math.round(capacity*0.6).toLocaleString()} L)`, data: Array(n).fill(Math.round(capacity*0.6)), borderColor: '#fbbf24', borderDash: [6,4], borderWidth: 2, pointRadius: 0 },
        { label: `40% (${Math.round(capacity*0.4).toLocaleString()} L)`, data: Array(n).fill(Math.round(capacity*0.4)), borderColor: '#f97316', borderDash: [6,4], borderWidth: 2, pointRadius: 0 },
        { label: `20% (${Math.round(capacity*0.2).toLocaleString()} L)`, data: Array(n).fill(Math.round(capacity*0.2)), borderColor: '#ef4444', borderDash: [6,4], borderWidth: 2, pointRadius: 0 }
      ]
    },
    options: { plugins: { title: { display: true, text: 'Nivel del Tanque con Umbrales de Alerta' } } }
  });
}

// ── 6. Tendencia 4 Semanas — líneas por semana, eje X = Lun-Dom ──────────────
export function getLast4WeeksChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const diasLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
  const datasets: any[] = [];

  for (let w = 3; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const weekEnd   = addDays(weekStart, 6);
    const weekData: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dayStr = format(addDays(weekStart, d), 'yyyy-MM-dd');
      const dayMs = measurements.filter(m =>
        format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr
      );
      weekData.push(dayMs.length > 0
        ? +(dayMs.reduce((a, m) => a + m.percentage, 0) / dayMs.length).toFixed(1)
        : null
      );
    }
    // Build label with date range: "Esta sem (05/04-11/04)" or "Sem -1 (29/03)"
    const startFmt = format(weekStart, 'dd/MM');
    const endFmt   = format(weekEnd,   'dd/MM');
    const lbl = w === 0
      ? `Esta sem (${startFmt}-${endFmt})`
      : `Sem -${w} (${startFmt})`;
    datasets.push({
      label: lbl,
      data: weekData,
      borderColor: COLORS[3 - w],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3,
      spanGaps: true
    });
  }
  return enc({
    type: 'line',
    data: { labels: diasLabels, datasets },
    options: {
      plugins: { title: { display: true, text: 'Nivel % por Día — Últimas 4 Semanas' } },
      scales: { y: { title: { display: true, text: '% Nivel' }, min: 0, max: 100 } }
    }
  });
}

// ── 7. Consumo Nocturno ──────────────────────────────────────────────────────
export function getNightlyLitrosChartUrl(measurements: Measurement[]) {
  const data = lastN(measurements, 20);
  return enc({
    type: 'bar',
    data: {
      labels: data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm')),
      datasets: [{ label: 'Consumo (L)', data: data.map(m => { const v = getVar(m); return v < 0 ? +Math.abs(v).toFixed(0) : 0; }), backgroundColor: '#1e293b' }]
    },
    options: { plugins: { title: { display: true, text: 'Consumo Nocturno Estimado (Litros)' } } }
  });
}

// ── 8. Doughnut consumo promedio por día semana ───────────────────────────────
export function getConsumoSemanalDoughnutUrl(measurements: Measurement[]) {
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  measurements.forEach(m => {
    const v = getVar(m);
    if (v < 0) { const d = new Date(m.recorded_at).getDay(); sums[d] += Math.abs(v); counts[d]++; }
  });
  const promedios = sums.map((s, i) => counts[i] > 0 ? Math.round(s / counts[i]) : 0);
  return enc({
    type: 'doughnut',
    data: {
      labels: DIAS,
      datasets: [{ data: promedios, backgroundColor: ['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#f97316'] }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Consumo Promedio por Día (histórico)' },
        legend: { position: 'right' }
      }
    }
  }, 700, 350);
}

// ── 9. Consumo por Día de Semana (barras) ─────────────────────────────────────
export function getDayOfWeekChartUrl(measurements: Measurement[]) {
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  measurements.forEach(m => {
    const v = getVar(m);
    if (v < 0) { const d = new Date(m.recorded_at).getDay(); sums[d] += Math.abs(v); counts[d]++; }
  });
  return enc({
    type: 'bar',
    data: {
      labels: DIAS,
      datasets: [{ label: 'Consumo Promedio (L)', data: sums.map((s, i) => counts[i] > 0 ? Math.round(s / counts[i]) : 0), backgroundColor: '#3b82f6' }]
    },
    options: { plugins: { title: { display: true, text: 'Consumo Promedio por Día de la Semana' } } }
  });
}

// ── 10. Fines de Semana — últimas 5 semanas reales ────────────────────────────
export function getWeekendChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const labels: string[] = [];
  const dataSab: (number | null)[] = [];
  const dataDom: (number | null)[] = [];

  for (let w = 4; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const sabStr = format(addDays(weekStart, 5), 'yyyy-MM-dd');
    const domStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    labels.push(`Sem ${format(weekStart, 'dd/MM')}`);
    const sumNeg = (ms: Measurement[]) => ms.reduce((a, m) => { const v = getVar(m); return a + (v < 0 ? Math.abs(v) : 0); }, 0);
    const sabMs = measurements.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === sabStr);
    const domMs = measurements.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === domStr);
    dataSab.push(sabMs.length > 0 ? Math.round(sumNeg(sabMs)) : null);
    dataDom.push(domMs.length > 0 ? Math.round(sumNeg(domMs)) : null);
  }
  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Sábado', data: dataSab, backgroundColor: '#f59e0b' },
        { label: 'Domingo', data: dataDom, backgroundColor: '#3b82f6' }
      ]
    },
    options: { plugins: { title: { display: true, text: 'Consumo Fines de Semana — Últimas 5 Semanas' } } }
  });
}

// ── 11. Proyección Llenado/Vaciado con fechas/horas reales en eje X ───────────
export function getProjectionFillingChartUrl(measurements: Measurement[], capacity: number) {
  const sorted = [...measurements].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  const lastRecord = sorted[sorted.length - 1];
  if (!lastRecord) return enc({ type: 'bar', data: { labels: ['Sin datos'], datasets: [{ data: [0] }] } });

  const currentLiters = lastRecord.liters;
  const currentPct = lastRecord.percentage;
  const flowLpm = (lastRecord.flow_lpm ?? lastRecord.caudal_lts_min ?? 0) as number;
  const baseTime = new Date(lastRecord.recorded_at);

  const points: { label: string; pct: number; color: string }[] = [
    { label: format(baseTime, 'HH:mm dd/MM'), pct: +currentPct.toFixed(1), color: '#3b82f6' }
  ];

  if (flowLpm < 0) {
    const targets  = [60, 40, 30, 20, 0];
    const colors   = ['#fbbf24', '#f97316', '#ef4444', '#dc2626', '#991b1b'];
    targets.forEach((t, i) => {
      const targetL = (t / 100) * capacity;
      if (targetL < currentLiters) {
        const mins = (currentLiters - targetL) / Math.abs(flowLpm);
        if (mins > 0 && mins < 20160) {
          points.push({ label: format(addMinutes(baseTime, mins), 'HH:mm dd/MM'), pct: t, color: colors[i] });
        }
      }
    });
  } else if (flowLpm > 0) {
    const targets = [50, 60, 80, 90, 100];
    const colors  = ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'];
    targets.forEach((t, i) => {
      const targetL = (t / 100) * capacity;
      if (targetL > currentLiters) {
        const mins = (targetL - currentLiters) / flowLpm;
        if (mins > 0 && mins < 20160) {
          points.push({ label: format(addMinutes(baseTime, mins), 'HH:mm dd/MM'), pct: t, color: colors[i] });
        }
      }
    });
  } else {
    // estable: mostrar línea plana con etiquetas de tiempo +6h, +12h, +24h
    [0, 6*60, 12*60, 24*60].forEach(mins => {
      points.push({ label: format(addMinutes(baseTime, mins), 'HH:mm dd/MM'), pct: +currentPct.toFixed(1), color: '#94a3b8' });
    });
  }

  const isVaciar = flowLpm < 0;
  const title = flowLpm > 0 ? 'Proyección de Llenado (fechas estimadas)'
    : flowLpm < 0 ? 'Proyección de Vaciado (fechas estimadas)'
    : 'Nivel Estable — Sin variación significativa';

  return enc({
    type: 'line',
    data: {
      labels: points.map(p => p.label),
      datasets: [{
        label: isVaciar ? 'Nivel estimado vaciado (%)' : 'Nivel estimado llenado (%)',
        data: points.map(p => p.pct),
        borderColor: isVaciar ? '#ef4444' : '#22c55e',
        backgroundColor: isVaciar ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        borderWidth: 3, pointRadius: 6,
        pointBackgroundColor: points.map(p => p.color),
        tension: 0.2, fill: true
      }]
    },
    options: {
      plugins: { title: { display: true, text: title } },
      scales: { y: { title: { display: true, text: '% Nivel' }, min: 0, max: 100 } }
    }
  });
}

// ── 12. Caudal en L/h ─────────────────────────────────────────────────────────
export function getCaudalHoraChartUrl(measurements: Measurement[]) {
  const data = lastN(measurements, 20);
  return enc({
    type: 'line',
    data: {
      labels: data.map(m => format(new Date(m.recorded_at), 'dd/MM HH:mm')),
      datasets: [{ label: 'Caudal (L/h)', data: data.map(m => +(((m.caudal_lts_hora ?? 0) || (m.flow_lpm ?? 0) * 60)).toFixed(1)), borderColor: '#8b5cf6', borderWidth: 3, pointRadius: 3 }]
    },
    options: { plugins: { title: { display: true, text: 'Caudal en Litros por Hora' } } }
  });
}

// ── 13. Histórico mensual consumo + llenado (últimos 6 meses) ─────────────────
export function getHistoricoMensualChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const labels: string[] = [];
  const dataConsumo: number[] = [];
  const dataLlenado: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const mStart = startOfMonth(subMonths(now, i));
    const mEnd   = startOfMonth(subMonths(now, i - 1));
    labels.push(format(mStart, 'MMM yyyy', { locale: es }));
    const monthMs = measurements.filter(m => {
      const t = new Date(m.recorded_at);
      return t >= mStart && t < mEnd;
    });
    let c = 0, l = 0;
    monthMs.forEach(m => { const v = getVar(m); if (v < 0) c += Math.abs(v); else if (v > 0) l += v; });
    dataConsumo.push(Math.round(c));
    dataLlenado.push(Math.round(l));
  }
  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Consumo (L)', data: dataConsumo, backgroundColor: '#ef4444' },
        { label: 'Llenado (L)',  data: dataLlenado, backgroundColor: '#22c55e' }
      ]
    },
    options: { plugins: { title: { display: true, text: 'Histórico Mensual — Consumo y Llenado (6 meses)' } } }
  });
}


// ── NUEVOS GRÁFICOS ──────────────────────────────────────────────────────────

// N1. Consumo/Llenado Sábados y Domingos últimas 5 semanas (litros) ───────────
export function getWeekendLitrosChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const labels: string[] = [];
  const dataSabCons: (number | null)[] = [];
  const dataSabLlen: (number | null)[] = [];
  const dataDomCons: (number | null)[] = [];
  const dataDomLlen: (number | null)[] = [];

  for (let w = 4; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const sabStr = format(addDays(weekStart, 5), 'yyyy-MM-dd');
    const domStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    labels.push(`Sem ${format(weekStart, 'dd/MM')}`);

    const dayStats = (dayStr: string) => {
      const ms = measurements.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr);
      let cons = 0, llen = 0;
      ms.forEach(m => { const v = getVar(m); if (v < 0) cons += Math.abs(v); else if (v > 0) llen += v; });
      return ms.length > 0 ? { cons: Math.round(cons), llen: Math.round(llen) } : null;
    };

    const sab = dayStats(sabStr);
    const dom = dayStats(domStr);
    dataSabCons.push(sab ? sab.cons : null);
    dataSabLlen.push(sab ? sab.llen : null);
    dataDomCons.push(dom ? dom.cons : null);
    dataDomLlen.push(dom ? dom.llen : null);
  }

  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Sáb Consumo',  data: dataSabCons, backgroundColor: '#ef4444' },
        { label: 'Sáb Llenado',  data: dataSabLlen, backgroundColor: '#22c55e' },
        { label: 'Dom Consumo',  data: dataDomCons, backgroundColor: '#f97316' },
        { label: 'Dom Llenado',  data: dataDomLlen, backgroundColor: '#86efac' },
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Consumo/Llenado Sáb-Dom — Últimas 5 Semanas (L)' } },
      scales: { y: { title: { display: true, text: 'Litros' } } }
    }
  });
}

// N2. Semana actual vs semana anterior por día (Lun-Dom) ──────────────────────
export function getSemanaActualVsAnteriorChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const weekConsumo = (weekOffset: number) => {
    const weekStart = startOfWeek(subWeeks(now, weekOffset), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, d) => {
      const dayStr = format(addDays(weekStart, d), 'yyyy-MM-dd');
      const ms = measurements.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr);
      const cons = ms.reduce((a, m) => { const v = getVar(m); return a + (v < 0 ? Math.abs(v) : 0); }, 0);
      return ms.length > 0 ? Math.round(cons) : null;
    });
  };

  return enc({
    type: 'bar',
    data: {
      labels: DIAS,
      datasets: [
        { label: 'Semana actual',   data: weekConsumo(0), backgroundColor: '#3b82f6' },
        { label: 'Semana anterior', data: weekConsumo(1), backgroundColor: '#94a3b8' },
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Consumo por Día — Semana Actual vs Anterior (L)' } },
      scales: { y: { title: { display: true, text: 'Litros consumidos' } } }
    }
  });
}

// N3. Variación en puntos % sábados y domingos últimas 5 semanas ──────────────
export function getWeekendVariacionPctChartUrl(measurements: Measurement[]) {
  const now = new Date();
  const labels: string[] = [];
  const dataSab: (number | null)[] = [];
  const dataDom: (number | null)[] = [];

  for (let w = 4; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const sabStr = format(addDays(weekStart, 5), 'yyyy-MM-dd');
    const domStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    labels.push(`Sem ${format(weekStart, 'dd/MM')}`);

    const dayVar = (dayStr: string) => {
      const ms = measurements
        .filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr)
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      if (ms.length < 2) return null;
      return +(ms[ms.length - 1].percentage - ms[0].percentage).toFixed(1);
    };

    dataSab.push(dayVar(sabStr));
    dataDom.push(dayVar(domStr));
  }

  return enc({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Sábado (Δ%)',  data: dataSab, backgroundColor: dataSab.map(v => v == null ? '#94a3b8' : v >= 0 ? '#22c55e' : '#ef4444') },
        { label: 'Domingo (Δ%)', data: dataDom, backgroundColor: dataDom.map(v => v == null ? '#94a3b8' : v >= 0 ? '#86efac' : '#f97316') },
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Variación en Puntos % Sáb-Dom — Últimas 5 Semanas' } },
      scales: { y: { title: { display: true, text: 'Puntos %' } } }
    }
  });
}

// N4. Consumo promedio por franja horaria (0-6h, 6-12h, 12-18h, 18-24h) ──────
export function getConsumoFranjaHorariaChartUrl(measurements: Measurement[]) {
  // Bloques de 4 horas: 0-4, 4-8, 8-12, 12-16, 16-20, 20-24
  const franjas = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];
  const NUM = 6;
  const now = new Date();
  const cutoffSemana = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const cutoffMes    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const sumsS  = Array(NUM).fill(0), cntS = Array(NUM).fill(0);
  const sumsM  = Array(NUM).fill(0), cntM = Array(NUM).fill(0);

  measurements.forEach(m => {
    const v = getVar(m);
    if (v >= 0) return; // solo consumo (negativo)
    const t = new Date(m.recorded_at);
    const idx = Math.min(Math.floor(t.getHours() / 4), NUM - 1);
    const abs = Math.abs(v);
    if (t >= cutoffSemana) { sumsS[idx] += abs; cntS[idx]++; }
    if (t >= cutoffMes)    { sumsM[idx] += abs; cntM[idx]++; }
  });

  const avgS = sumsS.map((s, i) => cntS[i] > 0 ? Math.round(s / cntS[i]) : 0);
  const avgM = sumsM.map((s, i) => cntM[i] > 0 ? Math.round(s / cntM[i]) : 0);

  return enc({
    type: 'bar',
    data: {
      labels: franjas,
      datasets: [
        { label: 'Última semana (L prom)',   data: avgS, backgroundColor: '#3b82f6' },
        { label: 'Último mes (L prom)',       data: avgM, backgroundColor: '#94a3b8' },
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Consumo Promedio por Franja Horaria — Última Semana vs Mes' } },
      scales: { y: { title: { display: true, text: 'Litros promedio' } } }
    }
  });
}

// ── Exporta todos los gráficos ────────────────────────────────────────────────
export function getAllImprovedCharts(measurements: Measurement[], tankCapacity: number = 169000) {
  const pct = [...measurements].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  const lastPct = pct[pct.length - 1]?.percentage ?? 0;
  return {
    gaugeChart:             getGaugeChartUrl(lastPct),
    caudalChart:            getCaudalChartUrl(measurements),
    combinadoChart:         getCombinadoChartUrl(measurements),
    variationChart:         getDailyVariationChartUrl(measurements),
    thresholdChart:         getThresholdChartUrl(measurements, tankCapacity),
    nightlyLitrosChart:     getNightlyLitrosChartUrl(measurements),
    last4WeeksChart:        getLast4WeeksChartUrl(measurements),
    dayOfWeekChart:         getDayOfWeekChartUrl(measurements),
    weekendChart:           getWeekendChartUrl(measurements),
    projectionFillingChart: getProjectionFillingChartUrl(measurements, tankCapacity),
    caudalHoraChart:        getCaudalHoraChartUrl(measurements),
    consumoSemanalDoughnut: getConsumoSemanalDoughnutUrl(measurements),
    historicoMensualChart:  getHistoricoMensualChartUrl(measurements),
    weekendLitrosChart:     getWeekendLitrosChartUrl(measurements),
    semanaVsAnteriorChart:  getSemanaActualVsAnteriorChartUrl(measurements),
    weekendVariacionChart:  getWeekendVariacionPctChartUrl(measurements),
    franjaHorariaChart:     getConsumoFranjaHorariaChartUrl(measurements),
  };
}
