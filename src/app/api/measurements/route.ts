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
import { buildReportEmailHtml, buildAnomalyEmailHtml } from '@/lib/server/email-templates';

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

    // 2. Validar límites de almacenamiento según plan (Basado en TIEMPO)
    const plan = (building.subscription_plan || building.subscription_status || 'prueba').toLowerCase();
    
    // Definir días máximos según plan
    let maxDays = 90; // Default Básico / Prueba (3 meses)
    if (plan === 'profesional') maxDays = 120;
    if (plan === 'premium') maxDays = 365; // 12 meses
    if (plan === 'ia' || plan === 'activo') maxDays = 730; // 24 meses

    // Obtener la fecha de la medición más antigua
    const { data: oldestRecord } = await supabase
      .from('measurements')
      .select('recorded_at')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: true })
      .limit(1)
      .single();

    const now = new Date(recorded_at || new Date());
    const oldestDate = oldestRecord ? new Date(oldestRecord.recorded_at) : now;
    const diffTime = Math.abs(now.getTime() - oldestDate.getTime());
    const currentSpanDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const storageUsagePct = (currentSpanDays / maxDays) * 100;

    // --- LÓGICA DE ALERTA ALMACENAMIENTO ---
    // Alerta 90% (ej: mes 11 de 12)
    if (storageUsagePct >= 90 && storageUsagePct < 100 && !building.notified_90_storage) {
      const adminAndDev = [building.admin_email, 'correojago@gmail.com'].filter(Boolean);
      const storageAlertHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #f59e0b;">⚠️ Alerta de Almacenamiento: 90% alcanzado</h2>
          <p>El edificio <b>${building.name}</b> ha alcanzado el 90% de su límite de tiempo de almacenamiento (${currentSpanDays} de ${maxDays} días).</p>
          <p>Este es un aviso preventivo cuando le falta aproximadamente un 10% para llegar al tope de su plan.</p>
          <p>Si desea más capacidad, puede aumentar su plan. Si continúa en el mismo, al llegar al límite los registros más antiguos se sobreescribirán (FIFO) para dar espacio a los nuevos.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Sistema aGuaSaaS — Monitoreo Inteligente</p>
        </div>
      `;
      await sendEmailViaGmail(adminAndDev, `⚠️ Alerta 90% Tiempo Almacenamiento — ${building.name}`, storageAlertHtml, building_id, 'limit_90_storage');
      try {
        await supabase.from('buildings').update({ notified_90_storage: true }).eq('id', building_id);
      } catch (err) {
        console.error('Error actualizando notified_90_storage:', err);
      }
    }

    // Alerta 100% (Límite alcanzado)
    if (storageUsagePct >= 100 && !building.notified_100_storage) {
      const adminAndDev = [building.admin_email, 'correojago@gmail.com'].filter(Boolean);
      const storageAlertHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626;">🚨 Límite de Almacenamiento Alcanzado</h2>
          <p>El edificio <b>${building.name}</b> ha alcanzado el 100% de su límite de tiempo de almacenamiento (${maxDays} días).</p>
          <p>A partir de este momento, el sistema continuará funcionando normalmente pero aplicará una política <b>FIFO (First In, First Out)</b>: cada nueva medición registrada eliminará la medición más antigua de su base de datos para mantenerse dentro del plazo de ${maxDays} días contratados.</p>
          <p>Usted no recibirá más avisos por email sobre el límite de almacenamiento para este ciclo.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Sistema aGuaSaaS — Monitoreo Inteligente</p>
        </div>
      `;
      await sendEmailViaGmail(adminAndDev, `🚨 Límite Almacenamiento Alcanzado — ${building.name}`, storageAlertHtml, building_id, 'limit_100_storage');
      try {
        await supabase.from('buildings').update({ notified_100_storage: true }).eq('id', building_id);
      } catch (err) {
        console.error('Error actualizando notified_100_storage:', err);
      }
    }

    // --- LÓGICA FIFO (Sobre-escritura basada en TIEMPO) ---
    if (currentSpanDays >= maxDays) {
      // Eliminar registros que excedan los maxDays
      const limitDate = new Date(now.getTime() - (maxDays * 24 * 60 * 60 * 1000));
      const { data: toDelete } = await supabase
        .from('measurements')
        .select('id')
        .eq('building_id', building_id)
        .lt('recorded_at', limitDate.toISOString());
      
      if (toDelete && toDelete.length > 0) {
        const idsToDelete = toDelete.map(d => d.id);
        await supabase.from('measurements').delete().in('id', idsToDelete);
        await logAudit({ 
          req: request, 
          building_id, 
          user_email: 'SYSTEM', 
          operation: 'DELETE', 
          entity_type: 'measurement', 
          data_after: { message: `FIFO: ${toDelete.length} registros antiguos eliminados por exceder ${maxDays} días` } 
        });
      }
    }

    const { data: historyDesc } = await supabase
      .from('measurements')
      .select('*')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: false })
      .limit(2000);
    
    const history = (historyDesc || []).reverse();
    const lastM = history.length > 0 ? history[history.length - 1] : null;

    let isAnomaly = false;
    let variationPercentage = 0;
    // 3. REGISTRAR MEDICIÓN
    const var_lts = lastM ? liters - lastM.liters : null;
    const dbEmail = email || 'anonimo@aguasaas.com';

    // Aseguramos que recorded_at sea un ISO string válido o null
    let finalRecordedAt = recorded_at;
    if (recorded_at && !recorded_at.includes('T')) {
      // Si viene de datetime-local (YYYY-MM-DDTHH:mm), lo convertimos a un Date local y luego a ISO
      // pero el servidor puede estar en UTC. Para mantener la hora LOCAL enviada por el usuario:
      finalRecordedAt = new Date(recorded_at).toISOString();
    } else if (!recorded_at) {
      finalRecordedAt = new Date().toISOString();
    }

    if (lastM && lastM.liters > 0) {
      variationPercentage = Math.abs((liters - lastM.liters) / lastM.liters * 100);
      const { data: set } = await supabase.from('building_settings').select('alert_threshold_percentage, enable_anomaly_alerts').eq('building_id', building_id).single();
      const threshold = set?.alert_threshold_percentage ?? 30;
      if (variationPercentage > threshold) {
        isAnomaly = true;
        if (set?.enable_anomaly_alerts && building.admin_email) {
          const aHtml = buildAnomalyEmailHtml(building, liters, percentage, lastM.liters, lastM.percentage, variationPercentage, finalRecordedAt, collaborator_name || email || 'Anónimo', threshold);
          await sendEmailViaGmail([building.admin_email], `⚠️ Anomalía — ${building.name}`, aHtml, building_id, 'anomaly_alert');
        }
      }
    }

    const { data: meas, error: insErr } = await supabase.from('measurements').insert([{
      building_id, 
      liters, 
      percentage, 
      email: dbEmail,
      collaborator_name: collaborator_name || 'Anónimo',
      recorded_at: finalRecordedAt, 
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

    // Volvemos a consultar el historial LATEST INCLUYENDO la recién creada
    const { data: rawUpdHistoryDesc } = await supabase
      .from('measurements')
      .select('*')
      .eq('building_id', building_id)
      .order('recorded_at', { ascending: false })
      .limit(2000);

    // Reversamos para que sea ascendente para las gráficas y cálculos
    let updHistory = (rawUpdHistoryDesc || []).reverse();
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
