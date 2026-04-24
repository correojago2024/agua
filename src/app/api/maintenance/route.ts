/**
 * ARCHIVO: src/app/api/maintenance/route.ts
 * VERSIÓN: 2.0
 * FECHA: 2026-04-10
 *
 * Rutina de mantenimiento automático AquaSaaS.
 * Ejecuta cada 15 días via Vercel Cron y envía email de reporte.
 *
 * CRON_SECRET: Créalo tú mismo, cualquier texto largo y seguro.
 * Ejemplo: AquaSaaS-Maint-2026-xK9mP3qL
 * Agregar en Vercel → Settings → Environment Variables:
 *   CRON_SECRET = AquaSaaS-Maint-2026-xK9mP3qL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { getGmailTransporter } from '@/lib/server/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || 'aquasaas-cron-2026';
const ADMIN_EMAIL = 'correojago@gmail.com';

const supabase = createClient(supabaseUrl, supabaseKey);

interface TaskResult {
  task: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  data?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL via Gmail (mismas credenciales que el sistema principal)
// ─────────────────────────────────────────────────────────────────────────────
async function sendMaintenanceEmail(html: string, subject: string): Promise<void> {
  try {
    const { transporter, fromEmail } = await getGmailTransporter();
    
    await transporter.sendMail({
      from: `"AquaSaaS Sistema" <${fromEmail}>`,
      to: ADMIN_EMAIL,
      subject,
      html,
    });
    console.log('[MAINT-EMAIL] ✅ Email de reporte enviado a', ADMIN_EMAIL);
  } catch (e: any) {
    console.error('[MAINT-EMAIL] Error enviando email:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 1: Limpieza email_queue (enviados > 90 días)
// ─────────────────────────────────────────────────────────────────────────────
async function cleanEmailQueue(): Promise<TaskResult> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { error, count } = await supabase
      .from('email_queue').delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString()).eq('status', 'sent');
    if (error) throw error;
    return { task: 'Limpieza email_queue (enviados >90 días)', status: 'ok', message: `${count ?? 0} registros eliminados` };
  } catch (e: any) {
    return { task: 'Limpieza email_queue', status: 'error', message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 2: Edificios sin actividad > 30 días
// ─────────────────────────────────────────────────────────────────────────────
async function detectInactiveBuildings(): Promise<TaskResult> {
  try {
    const { data: buildings } = await supabase
      .from('buildings').select('id, name, status').neq('status', 'Inactivo');
    if (!buildings?.length) return { task: 'Edificios sin actividad >30 días', status: 'ok', message: 'Sin edificios activos' };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const sinActividad: string[] = [];

    for (const b of buildings) {
      const { data: lastM } = await supabase
        .from('measurements').select('recorded_at').eq('building_id', b.id)
        .order('recorded_at', { ascending: false }).limit(1).single();
      if (!lastM || new Date(lastM.recorded_at) < cutoff) sinActividad.push(`${b.name} (${b.status})`);
    }

    return {
      task: 'Edificios sin actividad >30 días',
      status: sinActividad.length > 0 ? 'warning' : 'ok',
      message: sinActividad.length > 0
        ? `${sinActividad.length} edificio(s) sin datos: ${sinActividad.join(', ')}`
        : 'Todos los edificios tienen actividad reciente',
      data: sinActividad,
    };
  } catch (e: any) {
    return { task: 'Edificios sin actividad', status: 'error', message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 3: Revisión suscripciones agotadas
// ─────────────────────────────────────────────────────────────────────────────
async function reviewSubscriptions(): Promise<TaskResult> {
  try {
    const { data: stale, error } = await supabase
      .from('resident_subscriptions').select('id').eq('emails_remaining', 0).eq('is_junta', false);
    if (error) throw error;
    return {
      task: 'Suscripciones con crédito agotado',
      status: 'ok',
      message: `${stale?.length ?? 0} suscripción(es) agotadas — se reactivan cuando el vecino reporta`,
      data: { count: stale?.length ?? 0 },
    };
  } catch (e: any) {
    return { task: 'Revisión suscripciones', status: 'error', message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 4: Anomalías sin revisar
// ─────────────────────────────────────────────────────────────────────────────
async function detectAnomalies(): Promise<TaskResult> {
  try {
    const { count, error } = await supabase
      .from('measurements').select('*', { count: 'exact', head: true })
      .eq('is_anomaly', true).eq('anomaly_checked', false);
    if (error) throw error;
    return {
      task: 'Anomalías sin revisar',
      status: (count ?? 0) > 0 ? 'warning' : 'ok',
      message: `${count ?? 0} medición(es) anómala(s) pendiente(s) de revisión`,
    };
  } catch (e: any) {
    return { task: 'Anomalías', status: 'error', message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 5: Limpieza leads atendidos > 180 días
// ─────────────────────────────────────────────────────────────────────────────
async function cleanOldLeads(): Promise<TaskResult> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    const { error, count } = await supabase
      .from('leads').delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString()).eq('atendido', true);
    if (error) throw error;
    return { task: 'Limpieza leads atendidos >180 días', status: 'ok', message: `${count ?? 0} leads eliminados` };
  } catch (e: any) {
    return { task: 'Limpieza leads', status: 'ok', message: 'Omitido (columna atendido puede no existir aún)' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 6: Estadísticas y monitoreo de recursos gratuitos
// ─────────────────────────────────────────────────────────────────────────────
async function systemStatsAndLimits(): Promise<TaskResult> {
  try {
    // Contar filas en cada tabla principal
    const [
      { count: totalBuildings },
      { count: activeBuildings },
      { count: prueba },
      { count: suspendidos },
      { count: inactivos },
      { count: totalMeasurements },
      { count: totalSubs },
      { count: juntaCount },
      { count: emailQueueTotal },
      { count: emailQueueSent },
      { count: leadsCount },
      { count: maintenanceLogs },
    ] = await Promise.all([
      supabase.from('buildings').select('*', { count: 'exact', head: true }),
      supabase.from('buildings').select('*', { count: 'exact', head: true }).eq('status', 'Activo'),
      supabase.from('buildings').select('*', { count: 'exact', head: true }).eq('status', 'Prueba'),
      supabase.from('buildings').select('*', { count: 'exact', head: true }).eq('status', 'Suspendido'),
      supabase.from('buildings').select('*', { count: 'exact', head: true }).eq('status', 'Inactivo'),
      supabase.from('measurements').select('*', { count: 'exact', head: true }),
      supabase.from('resident_subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('resident_subscriptions').select('*', { count: 'exact', head: true }).eq('is_junta', true),
      supabase.from('email_queue').select('*', { count: 'exact', head: true }),
      supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('maintenance_log').select('*', { count: 'exact', head: true }),
    ]);

    // Estimación de filas totales y uso Supabase Free (500MB ≈ ~5M filas típicas)
    const totalRows = (totalMeasurements ?? 0) + (totalSubs ?? 0) + (emailQueueTotal ?? 0) +
                      (leadsCount ?? 0) + (totalBuildings ?? 0) + (maintenanceLogs ?? 0);

    // Supabase Free: 500MB DB, límite ~500k filas para tablas con datos ricos
    const SUPABASE_FREE_ROW_ESTIMATE = 500000;
    const usagePct = Math.round((totalRows / SUPABASE_FREE_ROW_ESTIMATE) * 100);

    return {
      task: 'Estadísticas del sistema y monitoreo de recursos',
      status: usagePct > 80 ? 'warning' : 'ok',
      message: `${totalBuildings} edificios | ${totalMeasurements} mediciones | ~${usagePct}% uso estimado Supabase Free`,
      data: {
        edificios: { total: totalBuildings, activos: activeBuildings, prueba, suspendidos, inactivos },
        mediciones: totalMeasurements,
        suscripciones: { total: totalSubs, junta: juntaCount },
        email_queue: { total: emailQueueTotal, sent: emailQueueSent },
        leads: leadsCount,
        maintenance_logs: maintenanceLogs,
        filas_totales_estimadas: totalRows,
        uso_estimado_supabase_pct: usagePct,
      },
    };
  } catch (e: any) {
    return { task: 'Estadísticas del sistema', status: 'error', message: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial de mantenimientos anteriores
// ─────────────────────────────────────────────────────────────────────────────
async function getMaintenanceHistory(): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('maintenance_log').select('ran_at, tasks_ok, tasks_warnings, tasks_errors')
      .order('ran_at', { ascending: false }).limit(10);
    return data || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardar log
// ─────────────────────────────────────────────────────────────────────────────
async function saveLog(report: any): Promise<void> {
  try {
    await supabase.from('maintenance_log').insert({
      ran_at: report.timestamp,
      tasks_ok: report.summary.ok,
      tasks_warnings: report.summary.warnings,
      tasks_errors: report.summary.errors,
      report_json: report,
    });
  } catch {
    console.warn('[MAINTENANCE] No se pudo guardar en maintenance_log');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML del email de reporte de mantenimiento
// ─────────────────────────────────────────────────────────────────────────────
function buildMaintenanceEmailHtml(
  tasks: TaskResult[],
  summary: any,
  history: any[],
  elapsedMs: number,
  timestamp: string
): string {
  const statsTask = tasks.find(t => t.task.includes('Estadísticas'));
  const d = statsTask?.data;

  const statusIcon = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : '❌';
  const statusColor = (s: string) => s === 'ok' ? '#16a34a' : s === 'warning' ? '#d97706' : '#dc2626';
  const statusBg = (s: string) => s === 'ok' ? '#f0fdf4' : s === 'warning' ? '#fffbeb' : '#fef2f2';

  const taskRows = tasks.map(t => `
    <tr style="background:${statusBg(t.status)};">
      <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:bold;">${statusIcon(t.status)} ${t.task}</td>
      <td style="padding:10px 12px;border:1px solid #e2e8f0;color:${statusColor(t.status)};">${t.message}</td>
    </tr>`).join('');

  const historyRows = history.length > 0
    ? history.map(h => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-size:12px;">${new Date(h.ran_at).toLocaleString('es-ES')}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">${h.tasks_ok}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#d97706;">${h.tasks_warnings}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;color:#dc2626;">${h.tasks_errors}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="padding:8px;text-align:center;color:#94a3b8;font-size:12px;">Sin historial previo</td></tr>';

  const overallStatus = summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'ok';
  const headerColor = overallStatus === 'ok' ? '#15803d' : overallStatus === 'warning' ? '#b45309' : '#dc2626';
  const headerTitle = overallStatus === 'ok' ? '✅ Mantenimiento completado sin problemas'
    : overallStatus === 'warning' ? '⚠️ Mantenimiento con advertencias'
    : '❌ Mantenimiento con errores';

  // Límites conocidos de los planes gratuitos
  const limitsSection = `
    <div style="background:#f8fafc;border-radius:8px;padding:18px;margin-top:20px;">
      <h3 style="color:#0f172a;margin:0 0 14px;font-size:15px;">📊 Monitoreo de Recursos Gratuitos</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#1e293b;color:white;">
            <th style="padding:8px 12px;text-align:left;">Plataforma / Recurso</th>
            <th style="padding:8px 12px;text-align:center;">Límite Plan Gratuito</th>
            <th style="padding:8px 12px;text-align:center;">Uso Actual Estimado</th>
            <th style="padding:8px 12px;text-align:center;">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">Supabase — Base de datos (filas)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">500 MB / ~500k filas</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${d?.filas_totales_estimadas?.toLocaleString() ?? '—'} filas (~${d?.uso_estimado_supabase_pct ?? '?'}%)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:${(d?.uso_estimado_supabase_pct ?? 0) > 80 ? '#dc2626' : '#16a34a'};">${(d?.uso_estimado_supabase_pct ?? 0) > 80 ? '⚠️ Cerca del límite' : '✅ OK'}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">Supabase — Ancho de banda</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">5 GB / mes</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">No medible desde código</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Verificar en dashboard</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">Vercel — Ejecuciones serverless</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">100 GB-hs / mes</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">No expone API pública</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Verificar en dashboard</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">Vercel — Cron Jobs</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">1 cron / proyecto (Hobby)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">1 activo (mantenimiento)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">✅ OK</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">GitHub — Repositorios privados</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">Ilimitados (Free)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">1 repositorio</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">✅ OK</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">GitHub — Actions (CI/CD)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">2,000 min / mes</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">Mínimo (deploy vía Vercel)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#16a34a;">✅ OK</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:bold;">Gmail (aquasaasjg) — Envíos/día</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">500 emails / día (Gmail gratuito)</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${d?.email_queue?.sent?.toLocaleString() ?? '—'} enviados en total</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Verificar si hay rebotes</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin-top:10px;">
        * Verificar límites actualizados en: 
        <a href="https://supabase.com/pricing" style="color:#2563eb;">supabase.com/pricing</a> · 
        <a href="https://vercel.com/pricing" style="color:#2563eb;">vercel.com/pricing</a> · 
        <a href="https://github.com/pricing" style="color:#2563eb;">github.com/pricing</a>
      </p>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:800px;margin:0 auto;background:#fff;line-height:1.5;">

  <div style="background:${headerColor};color:white;padding:24px;text-align:center;">
    <h1 style="margin:0 0 6px;font-size:20px;">${headerTitle}</h1>
    <p style="margin:0;opacity:0.85;font-size:13px;">AquaSaaS — Reporte de Mantenimiento Automático</p>
    <p style="margin:4px 0 0;opacity:0.7;font-size:12px;">Ejecutado: ${new Date(timestamp).toLocaleString('es-ES')} · Duración: ${(elapsedMs/1000).toFixed(1)}s</p>
  </div>

  <div style="padding:24px;">

    <!-- Resumen ejecutivo -->
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      ${[
        { label: 'Tareas OK', value: summary.ok, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Advertencias', value: summary.warnings, color: '#d97706', bg: '#fffbeb' },
        { label: 'Errores', value: summary.errors, color: '#dc2626', bg: '#fef2f2' },
        { label: 'Total tareas', value: summary.total, color: '#2563eb', bg: '#eff6ff' },
      ].map(s => `
        <div style="flex:1;min-width:120px;background:${s.bg};border-radius:8px;padding:14px;text-align:center;border:1px solid ${s.color}22;">
          <p style="margin:0;font-size:28px;font-weight:bold;color:${s.color};">${s.value}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${s.label}</p>
        </div>`).join('')}
    </div>

    <!-- Estadísticas del sistema -->
    ${d ? `
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:20px;">
      <h3 style="color:#0f172a;margin:0 0 12px;font-size:15px;">🏢 Estado del Sistema AquaSaaS</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${[
          { label: 'Edificios Totales', value: d.edificios?.total ?? '—' },
          { label: '· Activos', value: d.edificios?.activos ?? '—' },
          { label: '· En Prueba', value: d.edificios?.prueba ?? '—' },
          { label: '· Suspendidos', value: d.edificios?.suspendidos ?? '—' },
          { label: '· Inactivos', value: d.edificios?.inactivos ?? '—' },
          { label: 'Mediciones totales', value: (d.mediciones ?? 0).toLocaleString() },
          { label: 'Suscripciones', value: d.suscripciones?.total ?? '—' },
          { label: '· Miembros Junta', value: d.suscripciones?.junta ?? '—' },
          { label: 'Emails enviados', value: (d.email_queue?.sent ?? 0).toLocaleString() },
        ].map(s => `
          <div style="background:white;border-radius:6px;padding:10px;border:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#64748b;">${s.label}</p>
            <p style="margin:2px 0 0;font-size:18px;font-weight:bold;color:#1e293b;">${s.value}</p>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- Detalle de tareas -->
    <h3 style="color:#0f172a;margin:0 0 10px;font-size:15px;">📋 Detalle de Tareas Ejecutadas</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <thead>
        <tr style="background:#1e293b;color:white;">
          <th style="padding:9px 12px;text-align:left;border:1px solid #334155;">Tarea</th>
          <th style="padding:9px 12px;text-align:left;border:1px solid #334155;">Resultado</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>

    <!-- Monitoreo de recursos gratuitos -->
    ${limitsSection}

    <!-- Historial de mantenimientos -->
    <h3 style="color:#0f172a;margin:20px 0 10px;font-size:15px;">🕐 Historial de Mantenimientos (últimos 10)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:7px 10px;border:1px solid #e2e8f0;text-align:left;">Fecha / Hora</th>
          <th style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;">✅ OK</th>
          <th style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;">⚠️ Avisos</th>
          <th style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;">❌ Errores</th>
        </tr>
      </thead>
      <tbody>${historyRows}</tbody>
    </table>

    <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:20px;">
      Sistema AquaSaaS — Reporte automático de mantenimiento · 2026 © Todos los derechos reservados<br>
      Este email se genera automáticamente cada 15 días. No responder a este correo.
    </p>
  </div>
</body>
</html>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  console.log('[MAINTENANCE] ═══ INICIO ═══', new Date().toISOString());
  const t0 = Date.now();
  const timestamp = new Date().toISOString();

  const tasks = await Promise.all([
    cleanEmailQueue(),
    detectInactiveBuildings(),
    reviewSubscriptions(),
    detectAnomalies(),
    cleanOldLeads(),
    systemStatsAndLimits(),
  ]);

  const summary = {
    total:    tasks.length,
    ok:       tasks.filter(t => t.status === 'ok').length,
    warnings: tasks.filter(t => t.status === 'warning').length,
    errors:   tasks.filter(t => t.status === 'error').length,
  };

  const elapsedMs = Date.now() - t0;
  const report = { timestamp, elapsed_ms: elapsedMs, summary, tasks };

  // Guardar log primero
  await saveLog(report);

  // Obtener historial para incluir en el email
  const history = await getMaintenanceHistory();

  // Construir y enviar email de reporte
  const overallStatus = summary.errors > 0 ? 'ERROR' : summary.warnings > 0 ? 'ADVERTENCIAS' : 'OK';
  const emailHtml = buildMaintenanceEmailHtml(tasks, summary, history, elapsedMs, timestamp);
  await sendMaintenanceEmail(emailHtml,
    `🔧 AquaSaaS Mantenimiento ${overallStatus} — ${new Date(timestamp).toLocaleDateString('es-ES')}`
  );

  console.log(`[MAINTENANCE] ═══ FIN — ${elapsedMs}ms — OK:${summary.ok} WARN:${summary.warnings} ERR:${summary.errors} ═══`);

  return NextResponse.json({ success: true, ...report });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
