"use client";

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, subMonths, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#1e293b'];

// ── 1. Participación por Usuario (Pie) ──────────────────────────────────
export const UserParticipationPieChart = ({ measurements }: { measurements: any[] }) => {
  const counts: Record<string, number> = {};
  
  measurements.forEach(m => {
    const user = m.collaborator_name || 'Anónimo';
    counts[user] = (counts[user] || 0) + 1;
  });

  const data = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          label={({ name, percent }) => `${(name || 'Anónimo').slice(0, 10)} ${((percent || 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: any) => [`${value} reportes`, 'Cantidad']} />
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── 2. Volumen de Mediciones por Mes (Bar) ───────────────────────────────
export const MonthlyReportsBarChart = ({ measurements }: { measurements: any[] }) => {
  const now = new Date();
  const data = [];

  for (let i = 11; i >= 0; i--) {
    const month = subMonths(now, i);
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    
    const count = measurements.filter(m => {
      const d = new Date(m.recorded_at);
      return d >= mStart && d <= mEnd;
    }).length;

    data.push({
      name: format(month, 'MMM', { locale: es }).toUpperCase(),
      cantidad: count
    });
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          itemStyle={{ color: '#fff' }}
        />
        <Bar dataKey="cantidad" fill="#10b981" radius={[4, 4, 0, 0]} name="Mediciones" />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── 3. Emails Enviados Diariamente (Bar) ────────────────────────────────
export const DailyEmailsBarChart = ({ logs }: { logs: any[] }) => {
  const now = new Date();
  const data = [];

  // Filtrar solo logs de email exitosos
  const emailLogs = logs.filter(l => l.entity_type === 'email' && l.operation === 'SUCCESS');

  for (let i = 29; i >= 0; i--) {
    const day = subDays(now, i);
    const count = emailLogs.filter(l => isSameDay(new Date(l.created_at), day)).length;

    data.push({
      name: format(day, 'dd/MM'),
      emails: count
    });
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          itemStyle={{ color: '#fff' }}
        />
        <Bar dataKey="emails" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Emails" />
      </BarChart>
    </ResponsiveContainer>
  );
};
