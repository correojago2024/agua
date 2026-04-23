"use client";

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { format, startOfWeek, addDays, subWeeks, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Measurement } from '@/lib/calculations';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

interface ChartProps {
  data: Measurement[];
  capacity?: number;
}

const getVar = (m: Measurement): number => m.variation_lts ?? m.variacion_lts ?? 0;

// ── 1. Status Indicator (Alarm) ───────────────────────────────────────────
export const StatusIndicator = ({ percentage }: { percentage: number }) => {
  const getStatus = (p: number) => {
    if (p > 60) return { label: 'ÓPTIMO', color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-100', icon: '✅' };
    if (p > 30) return { label: 'REGULAR', color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-100', icon: '⚠️' };
    return { label: 'CRÍTICO', color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-100', icon: '🚨' };
  };

  const status = getStatus(percentage);

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-2xl ${status.bg} border-2 border-white shadow-sm h-full`}>
      <span className="text-4xl mb-2">{status.icon}</span>
      <span className={`text-sm font-bold tracking-widest uppercase ${status.text}`}>{status.label}</span>
      <span className="text-5xl font-black text-gray-900 my-2">{Math.round(percentage)}%</span>
      <div className="w-full bg-gray-200 rounded-full h-3 mt-4 overflow-hidden">
        <div 
          className={`h-full ${status.color} transition-all duration-1000 ease-out`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ── 2. Tank Level Gauge (Semi-Circle) ─────────────────────────────────────
export const TankLevelGauge = ({ percentage }: { percentage: number }) => {
  const data = [
    { name: 'Nivel', value: percentage },
    { name: 'Vacío', value: 100 - percentage },
  ];

  const getColor = (p: number) => {
    if (p > 60) return '#10b981';
    if (p > 30) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="h-[250px] w-full flex flex-col items-center justify-center bg-white p-4 rounded-xl border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-tight">Nivel Actual</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="80%"
            startAngle={180}
            endAngle={0}
            innerRadius={80}
            outerRadius={120}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={getColor(percentage)} />
            <Cell fill="#f3f4f6" />
          </Pie>
          <text
            x="50%"
            y="70%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-4xl font-bold fill-gray-900"
          >
            {`${Math.round(percentage)}%`}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 3. Combined Trend Chart ────────────────────────────────────────────────
export const CombinedTrendChart = ({ data }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-20);
  const formattedData = chartData.map(m => ({
    fecha: format(new Date(m.recorded_at), 'dd/MM HH:mm'),
    nivel: Math.round(m.percentage),
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Evolución del Nivel (%)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id="colorNivel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip />
          <Area type="monotone" dataKey="nivel" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNivel)" name="Nivel %" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 4. Day of Week Consumption ──────────────────────────────────────────────
export const DayOfWeekConsumptionChart = ({ data }: ChartProps) => {
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  
  data.forEach(m => {
    const v = getVar(m);
    if (v < 0) {
      const d = new Date(m.recorded_at).getDay();
      sums[d] += Math.abs(v);
      counts[d]++;
    }
  });

  const chartData = DIAS.map((label, i) => ({
    name: label,
    consumo: counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Consumo Promedio por Día</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Bar dataKey="consumo" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Litros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 5. Last 4 Weeks Trend ──────────────────────────────────────────────────
export const LastWeeksTrendChart = ({ data }: ChartProps) => {
  const now = new Date();
  const diasLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const datasets: { name: string; data: (number | null)[] }[] = [];

  for (let w = 3; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const weekData = diasLabels.map((_, d) => {
      const dayStr = format(addDays(weekStart, d), 'yyyy-MM-dd');
      const dayMs = data.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr);
      return dayMs.length > 0 ? Math.round(dayMs.reduce((a, m) => a + m.percentage, 0) / dayMs.length) : null;
    });
    datasets.push({ name: w === 0 ? 'Esta Sem' : `Sem -${w}`, data: weekData });
  }

  const chartData = diasLabels.map((label, i) => {
    const row: any = { name: label };
    datasets.forEach(ds => { row[ds.name] = ds.data[i]; });
    return row;
  });

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Tendencia Últimas 4 Semanas (%)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          {datasets.map((ds, i) => (
            <Line key={ds.name} type="monotone" dataKey={ds.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{r: 3}} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 6. Weekend Consumption (5 Weeks) ───────────────────────────────────────
export const WeekendConsumptionChart = ({ data }: ChartProps) => {
  const now = new Date();
  const chartData: { name: string; Sabado: number; Domingo: number }[] = [];

  for (let w = 4; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(now, w), { weekStartsOn: 1 });
    const sabStr = format(addDays(weekStart, 5), 'yyyy-MM-dd');
    const domStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    
    const getDayCons = (dayStr: string) => {
      const ms = data.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr);
      return Math.round(ms.reduce((a, m) => a + Math.abs(Math.min(0, getVar(m))), 0));
    };

    chartData.push({
      name: format(weekStart, 'dd/MM'),
      Sabado: getDayCons(sabStr),
      Domingo: getDayCons(domStr)
    });
  }

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Consumo Fines de Semana (5 Sem)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          <Bar dataKey="Sabado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Domingo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 7. Monthly History (Consumed vs Filled) ────────────────────────────────
export const MonthlyHistoryChart = ({ data }: ChartProps) => {
  const now = new Date();
  const chartData: { name: string; Consumo: number; Llenado: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const mStart = startOfMonth(subMonths(now, i));
    const mEnd = startOfMonth(subMonths(now, i - 1));
    const monthMs = data.filter(m => {
      const t = new Date(m.recorded_at);
      return t >= mStart && t < mEnd;
    });

    let cons = 0, llen = 0;
    monthMs.forEach(m => {
      const v = getVar(m);
      if (v < 0) cons += Math.abs(v);
      else if (v > 0) llen += v;
    });

    chartData.push({
      name: format(mStart, 'MMM', { locale: es }),
      Consumo: Math.round(cons),
      Llenado: Math.round(llen)
    });
  }

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Histórico Mensual (Litros)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          <Bar dataKey="Consumo" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Llenado" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 8. AGREGADO: Flow Comparison Chart ──────────────────────────────────────
export const FlowComparisonChart = ({ data }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-15);
  const formattedData = chartData.map(m => {
    const flow = (m.flow_lpm ?? m.caudal_lts_min ?? 0) as number;
    return {
      fecha: format(new Date(m.recorded_at), 'dd/MM'),
      llenado: flow > 0 ? Number(flow.toFixed(1)) : 0,
      consumo: flow < 0 ? Number(Math.abs(flow).toFixed(1)) : 0,
    };
  });

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Caudal Llenado vs Consumo (L/min)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          <Bar dataKey="llenado" fill="#10b981" radius={[4, 4, 0, 0]} name="Llenado" />
          <Bar dataKey="consumo" fill="#ef4444" radius={[4, 4, 0, 0]} name="Consumo" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 9. AGREGADO: Thresholds Chart ───────────────────────────────────────────
export const ThresholdsChart = ({ data, capacity = 169000 }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-30);
  const formattedData = chartData.map(m => ({
    fecha: format(new Date(m.recorded_at), 'dd/MM'),
    litros: Math.round(m.liters),
    u60: Math.round(capacity * 0.6),
    u40: Math.round(capacity * 0.4),
    u20: Math.round(capacity * 0.2),
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Nivel con Umbrales (Litros)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          <Area type="monotone" dataKey="litros" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} name="Litros" />
          <Line type="monotone" dataKey="u60" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="60%" />
          <Line type="monotone" dataKey="u40" stroke="#f97316" strokeDasharray="5 5" dot={false} name="40%" />
          <Line type="monotone" dataKey="u20" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="20%" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 11. AGREGADO: Consumo Nocturno (Litros) ──────────────────────────────────
export const NightlyConsumptionChart = ({ data }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-15);
  const formattedData = chartData.map(m => ({
    name: format(new Date(m.recorded_at), 'dd/MM HH:mm'),
    litros: getVar(m) < 0 ? Math.abs(getVar(m)) : 0
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Consumo Nocturno (Litros)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 9}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Bar dataKey="litros" fill="#1e293b" radius={[4, 4, 0, 0]} name="Litros" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 12. AGREGADO: Comparativa Semana Actual vs Anterior ───────────────────────
export const WeeklyComparisonChart = ({ data }: ChartProps) => {
  const now = new Date();
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const getWeekData = (offset: number) => {
    const weekStart = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 });
    return DIAS.map((_, d) => {
      const dayStr = format(addDays(weekStart, d), 'yyyy-MM-dd');
      const ms = data.filter(m => format(new Date(m.recorded_at), 'yyyy-MM-dd') === dayStr);
      return Math.round(ms.reduce((a, m) => a + Math.abs(Math.min(0, getVar(m))), 0));
    });
  };

  const currentWeek = getWeekData(0);
  const previousWeek = getWeekData(1);

  const chartData = DIAS.map((day, i) => ({
    name: day,
    Actual: currentWeek[i],
    Anterior: previousWeek[i]
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Semana Actual vs Anterior (L)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip cursor={{fill: '#f8fafc'}} />
          <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}} />
          <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 10. AGREGADO: Hourly Consumption Pattern ───────────────────────────────
export const HourlyConsumptionChart = ({ data }: ChartProps) => {
  const bins = ['00-04h', '04-08h', '08-12h', '12-16h', '16-20h', '20-24h'];
  const sums = Array(6).fill(0), counts = Array(6).fill(0);

  data.forEach(m => {
    const v = getVar(m);
    if (v < 0) {
      const hour = new Date(m.recorded_at).getHours();
      const idx = Math.floor(hour / 4);
      sums[idx] += Math.abs(v);
      counts[idx]++;
    }
  });

  const chartData = bins.map((label, i) => ({
    name: label,
    promedio: counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0
  }));

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase">Patrón de Consumo por Hora</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
          <Tooltip />
          <Area type="monotone" dataKey="promedio" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} name="Lts Promedio" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};


