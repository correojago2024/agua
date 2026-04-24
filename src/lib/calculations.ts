/**
 * ARCHIVO: src/lib/calculations.ts
 * VERSIÓN: 1.7
 * FECHA: 2026-04-09
 * FIX: balance24h calcula desde el último registro hacia atrás 24h,
 *      no desde "ahora" (que daría 0 si el último dato no es de hoy)
 */

import { differenceInMinutes, subDays, startOfDay, format, addMinutes } from 'date-fns';

export interface Measurement {
  id?: string;
  building_id?: string;
  recorded_at: string;
  liters: number;
  percentage: number;
  height?: number | null;
  email: string;
  collaborator_name?: string | null;
  variation_lts?: number | null;
  flow_lpm?: number | null;
  created_at?: string | null;
  is_anomaly?: boolean | null;
  anomaly_checked?: boolean | null;
  altura_m?: number | null;
  variacion_lts?: number | null;
  variacion_puntos_pct?: number | null;
  tiempo_min_entre_mediciones?: number | null;
  caudal_lts_min?: number | null;
  caudal_lts_hora?: number | null;
  lts_faltantes_para_llenar?: number | null;
  tiempo_estimado_llenar_min?: number | null;
  tiempo_estimado_vaciar_min?: number | null;
  dia_semana?: string | null;
  mes?: string | null;
  caudal_consumo_estimado_lts_hora?: number | null;
  caudal_entrada_estimado_lts_hora?: number | null;
}

export interface Indicators {
  lastFlow: number;
  balance24h: { consumed: number; filled: number; net: number };
  avgFlow24h: number;
  projection11pm: number;
  projectedLiters11pm: number;
  timeEstimate: string;
  estimateDate: string;
  filledToday: number;
  filledLastWeek: number;
  slotMax: { range: string; avg: number };
  trends: { current: number; previous: number };
  lastUpdate: string;
  reportDate: string;
  heatmapData?: number[][]; // [dia][hora] -> consumo
  }

  /**
  * Calcula el consumo por día de la semana y hora (Heatmap)
  */
  export function calculateConsumptionHeatmap(measurements: Measurement[]): number[][] {
  // Inicializar matriz 7x24 con ceros
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  // Necesitamos al menos 2 mediciones para calcular variaciones (consumo)
  if (measurements.length < 2) return matrix;

  // Ordenar cronológicamente
  const sorted = [...measurements].sort((a, b) => 
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const diff = prev.liters - curr.liters; // Diferencia (consumo positivo)

    // Solo contamos consumos razonables (no llenados ni errores de sensor)
    if (diff > 0 && diff < 50000) {
      const date = new Date(curr.recorded_at);
      const day = date.getDay(); // 0 (Dom) - 6 (Sab)
      const hour = date.getHours(); // 0-23

      matrix[day][hour] += diff;
    }
  }

  return matrix;
  }

  export function calculateIndicators(measurements: Measurement[], capacity: number): Indicators | null {

  if (measurements.length < 2) return null;

  // Asegurar orden ascendente por recorded_at
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const now = new Date();
  const lastRecord = sorted[sorted.length - 1];
  const lastTime = new Date(lastRecord.recorded_at);

  // ── Balance 24h: desde el último registro hacia atrás 24 horas ───────────
  // Esto funciona incluso si el último registro no es de hoy
  const cutoff24h = new Date(lastTime.getTime() - 24 * 60 * 60 * 1000);
  const data24h = sorted.filter(m => new Date(m.recorded_at) >= cutoff24h);

  let consumed24h = 0;
  let filled24h   = 0;
  data24h.forEach((m, i) => {
    if (i === 0) return;
    const diff = m.liters - data24h[i - 1].liters;
    if (diff < 0) consumed24h += Math.abs(diff);
    else filled24h += diff;
  });

  // ── Llenado de hoy (desde medianoche del día del último registro) ─────────
  const startOfLastDay = startOfDay(lastTime);
  const todayMs = sorted.filter(m => new Date(m.recorded_at) >= startOfLastDay);
  const filledToday = todayMs.reduce((acc, m, i, arr) => {
    if (i === 0) return acc;
    const diff = m.liters - arr[i - 1].liters;
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  // ── Llenado última semana ─────────────────────────────────────────────────
  const startOfLastWeek = startOfDay(subDays(lastTime, 7));
  const weekMs = sorted.filter(m => new Date(m.recorded_at) >= startOfLastWeek);
  const filledLastWeek = weekMs.reduce((acc, m, i, arr) => {
    if (i === 0) return acc;
    const diff = m.liters - arr[i - 1].liters;
    return acc + (diff > 0 ? diff : 0);
  }, 0);

  // ── Caudal promedio 24h ──────────────────────────────────────────────────
  const hoursSpan = data24h.length >= 2
    ? Math.max(1, differenceInMinutes(
        new Date(data24h[data24h.length - 1].recorded_at),
        new Date(data24h[0].recorded_at)
      ) / 60)
    : 24;
  const avgFlowLtsH = (filled24h + consumed24h) > 0
    ? (filled24h - consumed24h) / hoursSpan
    : 0;

  // ── Flow actual: promedio de las últimas 3 mediciones para suavizar anomalías ──
  const lastFew = sorted.slice(-3);
  const avgFlow = lastFew.length >= 2
    ? lastFew.reduce((acc, m, i, arr) => {
        if (i === 0) return acc;
        const mins = differenceInMinutes(new Date(m.recorded_at), new Date(arr[i-1].recorded_at));
        return acc + (mins > 0 ? (m.liters - arr[i-1].liters) / mins : 0);
      }, 0) / (lastFew.length - 1)
    : (lastRecord.flow_lpm ?? lastRecord.caudal_lts_min ?? 0) as number;

  // Limitar el caudal a un máximo razonable (±500 L/min) para evitar proyecciones absurdas
  const MAX_FLOW = 500;
  const currentFlow = Math.max(-MAX_FLOW, Math.min(MAX_FLOW, avgFlow));

  // ── Proyección a las 11 PM del día del último registro ───────────────────
  const target11pm = new Date(
    lastTime.getFullYear(), lastTime.getMonth(), lastTime.getDate(), 23, 0, 0
  );
  const minutesUntil11 = Math.max(0, differenceInMinutes(target11pm, lastTime));
  const projectedLiters = Math.max(0, Math.min(
    capacity,
    lastRecord.liters + (currentFlow * minutesUntil11)
  ));
  const projectedPercentage = (projectedLiters / capacity) * 100;

  // ── Tiempo estimado vaciado/llenado ───────────────────────────────────────
  let timeEstimateText = 'Estable';
  let estimateDateText = 'N/A';
  // Usar caudal promedio suavizado para estimaciones de tiempo
  const rawFlow = (lastRecord.flow_lpm ?? lastRecord.caudal_lts_min ?? 0) as number;
  const flowForEstimate = Math.abs(rawFlow) > MAX_FLOW ? currentFlow : rawFlow;
  if (flowForEstimate < -0.1) {
    const mins = Math.abs(lastRecord.liters / flowForEstimate);
    if (mins > 0 && mins < 1440 * 365) {
      timeEstimateText = `Vaciado en ${(mins / 1440).toFixed(1)} días`;
      estimateDateText = format(addMinutes(lastTime, mins), 'dd/MM/yyyy HH:mm');
    }
  } else if (flowForEstimate > 0.1) {
    const mins = (tankCapacity - lastRecord.liters) / flowForEstimate;
    if (mins > 0 && mins < 1440 * 365) {
      timeEstimateText = `Llenado en ${(mins / 1440).toFixed(1)} días`;
      estimateDateText = format(addMinutes(lastTime, mins), 'dd/MM/yyyy HH:mm');
    }
  }

  return {
    lastFlow: currentFlow,
    balance24h: { consumed: consumed24h, filled: filled24h, net: filled24h - consumed24h },
    avgFlow24h: Math.abs(avgFlowLtsH),
    projection11pm: projectedPercentage,
    projectedLiters11pm: projectedLiters,
    timeEstimate: timeEstimateText,
    estimateDate: estimateDateText,
    filledToday,
    filledLastWeek,
    slotMax: { range: `${now.getHours()}:00 - ${now.getHours() + 1}:00`, avg: 0 },
    trends: { current: filled24h - consumed24h, previous: 0 },
    lastUpdate: format(lastTime, 'dd/MM/yyyy HH:mm'),
    reportDate: format(now, 'dd/MM/yyyy HH:mm'),
    heatmapData: calculateConsumptionHeatmap(measurements)
  };
}
