"use client";

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Measurement } from '@/lib/calculations';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

interface ChartProps {
  data: Measurement[];
  capacity?: number;
}

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

// ── 3. Combined Trend Chart (Line + Area) ──────────────────────────────────
export const CombinedTrendChart = ({ data }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-20);
  
  const formattedData = chartData.map(m => ({
    fecha: format(new Date(m.recorded_at), 'dd/MM HH:mm'),
    nivel: Math.round(m.percentage),
    litros: Math.round(m.liters),
  }));

  return (
    <div className="h-[350px] w-full bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Evolución del Nivel (%)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id="colorNivel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="fecha" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={{stroke: '#e2e8f0'}}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{fontSize: 12, fill: '#64748b'}} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Area 
            type="monotone" 
            dataKey="nivel" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorNivel)" 
            name="Nivel (%)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 4. Flow Comparison Chart (Bar) ──────────────────────────────────────────
export const FlowComparisonChart = ({ data }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-20);
  
  const formattedData = chartData.map(m => {
    const flow = (m.flow_lpm ?? m.caudal_lts_min ?? 0) as number;
    return {
      fecha: format(new Date(m.recorded_at), 'dd/MM HH:mm'),
      llenado: flow > 0 ? Number(flow.toFixed(2)) : 0,
      consumo: flow < 0 ? Number(Math.abs(flow).toFixed(2)) : 0,
    };
  });

  return (
    <div className="h-[350px] w-full bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Caudal (L/min) — Llenado vs Consumo</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="fecha" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={{stroke: '#e2e8f0'}}
            tickLine={false}
          />
          <YAxis 
            tick={{fontSize: 12, fill: '#64748b'}} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            cursor={{fill: '#f8fafc'}}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend iconType="circle" />
          <Bar dataKey="llenado" fill="#10b981" radius={[4, 4, 0, 0]} name="Llenado (L/min)" />
          <Bar dataKey="consumo" fill="#ef4444" radius={[4, 4, 0, 0]} name="Consumo (L/min)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── 5. Thresholds Chart ─────────────────────────────────────────────────────
export const ThresholdsChart = ({ data, capacity = 169000 }: ChartProps) => {
  const chartData = [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).slice(-30);
  
  const formattedData = chartData.map(m => ({
    fecha: format(new Date(m.recorded_at), 'dd/MM HH:mm'),
    litros: Math.round(m.liters),
    u60: Math.round(capacity * 0.6),
    u40: Math.round(capacity * 0.4),
    u20: Math.round(capacity * 0.2),
  }));

  return (
    <div className="h-[350px] w-full bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Nivel con Umbrales (Litros)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="fecha" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={{stroke: '#e2e8f0'}}
            tickLine={false}
          />
          <YAxis 
            tick={{fontSize: 12, fill: '#64748b'}} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend iconType="circle" />
          <Area type="monotone" dataKey="litros" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={3} name="Litros" />
          <Line type="monotone" dataKey="u60" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="Umbral 60%" />
          <Line type="monotone" dataKey="u40" stroke="#f97316" strokeDasharray="5 5" dot={false} name="Umbral 40%" />
          <Line type="monotone" dataKey="u20" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Umbral 20%" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
