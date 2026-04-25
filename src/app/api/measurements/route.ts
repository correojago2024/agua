/**
 * ARCHIVO: app/api/measurements/route.ts
 * VERSION: 6.0
 * FECHA: 2026-04-24
 * CAMBIOS v6.0:
 * - Corrección de error de sintaxis Turbopack (código huérfano fuera de templates)
 * - Email 100% responsivo para móviles (max-width 600px, fuentes ajustadas)
 * - Eliminación de duplicidad de funciones
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateIndicators, Indicators } from '@/lib/calculations';
import { getAllImprovedCharts } from '@/lib/charts';
import { sendEmailViaGmail } from '@/lib/server/email';
import { logAudit } from '@/lib/audit';
import { checkWaterLevelThresholds } from '@/lib/server/whatsapp';
import { buildReportEmailHtml } from '@/lib/server/email-templates';

// ════════════════════════════════════════════════════════════════════════════
// HTML Alerta de Anomalía
// ════════════════════════════════════════════════════════════════════════════
function buildAnomalyEmailHtml(building: any, newLiters: number, newPercentage: number, prevLiters: number, prevPercentage: number, variationPct: number, recordedAt: string, reportedBy: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1e293b;"><div style="background:#dc2626;color:white;padding:15px;border-radius:8px 8px 0 0;text-align:center;"><h2 style="margin:0;font-size:18px;">⚠️ Anomalía detectada — ${building.name}</h2></div><div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;"><p style="font-size:14px;">Se detectó una variación de <strong>${variationPct.toFixed(1)}%</strong>.</p><ul style="font-size:13px;line-height:1.8;"><li><strong>Fecha:</strong> ${new Date(recordedAt).toLocaleString('es-ES')}</li><li><strong>Nivel:</strong> ${Math.round(newLiters).toLocaleString()} L (${Number(newPercentage).toFixed(1)}%)</li><li><strong>Reportado por:</strong> ${reportedBy}</li></ul><p style="font-size:11px;color:#94a3b8;margin-top:20px;">Sistema AquaSaaS.</p></div></body></html>`.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Registrar medición y enviar reporte
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { building_id, liters, percentage, email, collaborator_name, recorded_at } = body;

    if (!building_id) return NextResponse.json({ error: 'building_id es requerido' }, { status: 400 });

    // 1. Log de recepción
    await logAudit({ 
      req: request, 
      building_id, 
      user_email: email || collaborator_name || 'Anónimo', 
      operation: 'INFO', 
      entity_type: 'measurement', 
      data_after: { message: 'Reporte recibido en API', body } 
    });

    const { data: building, error: bErr } = await supabase.from('buildings').select('*').eq('id', building_id).single();
    if (bErr || !building) {
      await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'ERROR', entity_type: 'measurement', data_after: { error: 'Edificio no encontrado', details: bErr } });
      return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
    }

    // 2. Validar límites de almacenamiento según plan
    const plan = building.subscription_status?.toLowerCase() || 'prueba';
    let maxStorage = 200; // Esencial
    if (plan === 'profesional') maxStorage = 1000;
    if (plan === 'premium') maxStorage = 5000;
    if (plan === 'ia' || plan === 'activo') maxStorage = 50000;

    const { count: currentCount } = await supabase
      .from('measurements')
      .select('*', { count: 'exact', head: true })
      .eq('building_id', building_id);

    if ((currentCount || 0) >= maxStorage) {
      await logAudit({ 
        req: request, 
        building_id, 
        user_email: email || 'SYSTEM', 
        operation: 'WARNING', 
        entity_type: 'measurement', 
        data_after: { message: 'Límite de almacenamiento alcanzado', count: currentCount, plan } 
      });
      return NextResponse.json({ 
        error: `Límite de almacenamiento alcanzado para el Plan ${plan.toUpperCase()} (${maxStorage} registros). Por favor, limpie su historial o actualice su plan.` 
      }, { status: 403 });
    }

    const { data: history } = await supabase.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true });
    const lastM = history && history.length > 0 ? history[history.length - 1] : null;

    let isAnomaly = false;
    let variationPercentage = 0;
    if (lastM && lastM.liters > 0) {
      variationPercentage = Math.abs((liters - lastM.liters) / lastM.liters * 100);
      const { data: set } = await supabase.from('building_settings').select('alert_threshold_percentage, enable_anomaly_alerts').eq('building_id', building_id).single();
      if (variationPercentage > (set?.alert_threshold_percentage ?? 30)) {
        isAnomaly = true;
        if (set?.enable_anomaly_alerts && building.admin_email) {
          const aHtml = buildAnomalyEmailHtml(building, liters, percentage, lastM.liters, lastM.percentage, variationPercentage, recorded_at, collaborator_name || email || 'Anónimo');
          await sendEmailViaGmail([building.admin_email], `⚠️ Anomalía — ${building.name}`, aHtml, building_id, 'anomaly_alert');
        }
      }
    }

    const var_lts = lastM ? liters - lastM.liters : null;
    
    // CORRECCIÓN: Asegurar que email no sea null porque la tabla tiene restricción NOT NULL
    const dbEmail = email || 'anonimo@aquasaas.com';

    const { data: meas, error: insErr } = await supabase.from('measurements').insert([{
      building_id, 
      liters, 
      percentage, 
      email: dbEmail,
      collaborator_name: collaborator_name || 'Anónimo',
      recorded_at, 
      is_anomaly: isAnomaly, 
      anomaly_checked: true,
      variation_lts: var_lts,
    }]).select().single();

    if (insErr) {
      console.error('[DATABASE INSERT ERROR]', insErr);
      await logAudit({ 
        req: request, 
        building_id, 
        user_email: dbEmail, 
        operation: 'ERROR', 
        entity_type: 'measurement', 
        data_after: { message: 'Error insertando en measurements', error: insErr } 
      });
      // A pesar del error de inserción, si el usuario proporcionó email, intentaremos enviarle algo o al menos retornar error
      return NextResponse.json({ error: 'Error al registrar medición en base de datos: ' + insErr.message }, { status: 500 });
    }

    if (meas) {
      await logAudit({ 
        req: request, 
        building_id, 
        user_email: dbEmail, 
        operation: 'INSERT', 
        entity_type: 'measurement', 
        entity_id: meas.id, 
        data_after: meas 
      });
    }
    // --- INTEGRACIÓN WHATSAPP ---
    // Verificar umbrales de nivel y enviar alertas si es necesario
    try {
      await checkWaterLevelThresholds(building_id, building.name, percentage, liters);
    } catch (waErr: any) {
      console.error('[WHATSAPP ALERT ERROR]', waErr.message);
    }
    // ----------------------------

    // Volvemos a consultar el historial completo INCLUYENDO la recién creada
    const { data: rawUpdHistory } = await supabase
      .from('measurements')
      .select('*')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: true });

    // Si por algún retraso de replicación no viene en rawUpdHistory, la agregamos manualmente si tenemos meas
    let updHistory = rawUpdHistory || [];
    if (meas && !updHistory.find(m => m.id === meas.id)) {
      updHistory.push(meas);
      updHistory.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    }

    const indicators: Indicators = calculateIndicators(updHistory, building.tank_capacity_liters) || {
      lastFlow: 0, balance24h: { consumed: 0, filled: 0, net: 0 }, avgFlow24h: 0,
      projection11pm: percentage, projectedLiters11pm: liters, timeEstimate: 'Pendiente', estimateDate: 'N/A',
      filledToday: 0, filledLastWeek: 0, slotMax: { range: 'N/A', avg: 0 }, trends: { current: 0, previous: 0 },
      lastUpdate: new Date().toLocaleString('es-ES'), reportDate: new Date().toLocaleString('es-ES'),
    };

    const { data: bSettings } = await supabase.from('building_settings').select('*').eq('building_id', building_id).single();
    const emailsLimit = bSettings?.emails_on_subscription ?? 5;

    if (email) {
      const { data: exSub } = await supabase.from('resident_subscriptions').select('id, emails_remaining').eq('building_id', building_id).eq('email', email).single();
      if (!exSub) await supabase.from('resident_subscriptions').insert({ building_id, email, emails_remaining: emailsLimit });
    }

    const { data: subs } = await supabase.from('resident_subscriptions').select('email, id, emails_remaining').eq('building_id', building_id).gt('emails_remaining', 0);
    const recipientEmails = subs?.map(s => s.email) || [];
    if (building.admin_email && !recipientEmails.includes(building.admin_email)) recipientEmails.push(building.admin_email);

    if (recipientEmails.length > 0) {
      await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'INFO', entity_type: 'email', entity_id: meas?.id || 'N/A', data_after: { message: 'Iniciando envío de reporte', recipients: recipientEmails } });
      
      const chartUrls = getAllImprovedCharts(updHistory || [], building.tank_capacity_liters, {
        prevention_threshold: bSettings?.prevention_threshold,
        rationing_threshold: bSettings?.rationing_threshold
      });
      const emailHtml = buildReportEmailHtml(building, updHistory || [], indicators, liters, percentage, isAnomaly, variationPercentage, chartUrls, {
        emails_on_subscription: emailsLimit,
        prevention_threshold: bSettings?.prevention_threshold,
        rationing_threshold: bSettings?.rationing_threshold
      });
      const res = await sendEmailViaGmail(recipientEmails, `💧 Reporte de Agua: ${Math.round(percentage)}% actual — ${building.name}`, emailHtml, building_id, 'measurement_report');
      
      if (res.success) {
        await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'SUCCESS', entity_type: 'email', entity_id: meas?.id || 'N/A', data_after: { message: 'Emails enviados correctamente', messageId: res.messageId } });
        if (subs) {
          for (const s of subs) await supabase.from('resident_subscriptions').update({ emails_remaining: s.emails_remaining - 1 }).eq('id', s.id);
        }
      } else {
        await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'ERROR', entity_type: 'email', entity_id: meas?.id || 'N/A', data_after: { message: 'Error enviando emails', error: res.error } });
      }
    } else {
      await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'WARNING', entity_type: 'email', entity_id: meas?.id || 'N/A', data_after: { message: 'No hay destinatarios con suscripciones activas' } });
    }

    return NextResponse.json({ success: true, measurementId: meas?.id, indicators, anomalyDetected: isAnomaly, variationPercentage: variationPercentage.toFixed(1), emailsSent: recipientEmails.length });
  } catch (err: any) {
    console.error('[ERROR] POST /api/measurements:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
