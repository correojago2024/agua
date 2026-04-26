/**
 * ARCHIVO: src/app/api/buildings/daily-report/route.ts
 * VERSION: 1.0
 * DESCRIPCIÓN: Cron Job diario para enviar reportes automáticos a edificios que lo tengan activado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateIndicators } from '@/lib/calculations';
import { getAllImprovedCharts } from '@/lib/charts';
import { sendEmailViaGmail } from '@/lib/server/email';
import { buildReportEmailHtml } from '@/lib/server/email-templates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CRON_SECRET = process.env.CRON_SECRET || 'aquasaas-cron-2026';

const supabase = createClient(supabaseUrl, supabaseKey);

async function logSystemAlert(building_id: string, type: string, message: string, status: string, details: any = {}) {
  try {
    await supabase.from('audit_logs').insert({
      building_id,
      operation: type,
      entity_type: 'daily_report_cron',
      entity_id: building_id,
      user_email: 'SYSTEM_CRON',
      status,
      data_after: { message, ...details },
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error guardando log de alerta:', e);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const now = new Date();
  console.log('[DAILY-REPORT-CRON] Iniciando ejecución:', now.toISOString());
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('[DAILY-REPORT-CRON] No autorizado. Header:', authHeader ? 'Presente' : 'Ausente');
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  console.log('[DAILY-REPORT-CRON] Autorización exitosa');
  
  try {
    // 1. Buscar edificios con reporte diario activado
    console.log('[DAILY-REPORT-CRON] Buscando edificios con daily_report_enabled=true y status=Activo');
    const { data: buildings, error: bError } = await supabase
      .from('buildings')
      .select('*')
      .eq('daily_report_enabled', true)
      .eq('status', 'Activo');

    if (bError) {
      console.error('[DAILY-REPORT-CRON] Error crítico buscando edificios:', bError);
      return NextResponse.json({ error: bError.message }, { status: 500 });
    }

    if (!buildings || buildings.length === 0) {
      console.log('[DAILY-REPORT-CRON] No se encontraron edificios para procesar (daily_report_enabled=true).');
      return NextResponse.json({ success: true, message: 'No buildings with daily_report_enabled=true' });
    }

    console.log(`[DAILY-REPORT-CRON] Edificios encontrados: ${buildings.length} [${buildings.map(b => b.name).join(', ')}]`);

    const results = [];

    for (const building of buildings) {
      console.log(`[DAILY-REPORT-CRON] >>> Procesando edificio: ${building.name} (${building.id})`);
      try {
        // 2. Obtener miembros de la junta para destinatarios
        const { data: members, error: mError } = await supabase
          .from('building_members')
          .select('email, enable_email')
          .eq('building_id', building.id)
          .eq('is_junta', true);

        if (mError) {
          console.error(`[DAILY-REPORT-CRON] [${building.name}] Error buscando miembros:`, mError);
          await logSystemAlert(building.id, 'DAILY_REPORT_ERROR', `Error buscando miembros: ${mError.message}`, 'ERROR');
          results.push({ building: building.name, status: 'error', reason: 'db_error_members' });
          continue;
        }

        const recipients = members?.filter(m => m.enable_email !== false).map(m => m.email).filter(Boolean) || [];
        console.log(`[DAILY-REPORT-CRON] [${building.name}] Destinatarios encontrados: ${recipients.length}`);

        if (recipients.length === 0) {
          console.warn(`[DAILY-REPORT-CRON] [${building.name}] Saltando: No hay destinatarios habilitados en la junta.`);
          await logSystemAlert(building.id, 'DAILY_REPORT_SKIP', 'No hay destinatarios (junta con email habilitado)', 'WARNING');
          results.push({ building: building.name, status: 'skipped', reason: 'no recipients' });
          continue;
        }

        // 3. Obtener historial de mediciones
        const { data: history, error: hError } = await supabase
          .from('measurements')
          .select('*')
          .eq('building_id', building.id)
          .order('recorded_at', { ascending: true });

        if (hError) {
          console.error(`[DAILY-REPORT-CRON] [${building.name}] Error buscando mediciones:`, hError);
          await logSystemAlert(building.id, 'DAILY_REPORT_ERROR', `Error buscando mediciones: ${hError.message}`, 'ERROR');
          results.push({ building: building.name, status: 'error', reason: 'db_error_measurements' });
          continue;
        }

        if (!history || history.length === 0) {
          console.warn(`[DAILY-REPORT-CRON] [${building.name}] Saltando: No hay mediciones en el historial.`);
          await logSystemAlert(building.id, 'DAILY_REPORT_SKIP', 'No hay mediciones para generar reporte', 'WARNING');
          results.push({ building: building.name, status: 'skipped', reason: 'no measurements' });
          continue;
        }

        console.log(`[DAILY-REPORT-CRON] [${building.name}] Mediciones en historial: ${history.length}`);

        // 4. Calcular indicadores y gráficas
        console.log(`[DAILY-REPORT-CRON] [${building.name}] Calculando indicadores y gráficas...`);
        const indicators = calculateIndicators(history, building.tank_capacity_liters);
        const lastRecord = history[history.length - 1];
        
        // Verificar si la última medición es "reciente" (opcional, pero el usuario quiere reporte diario)
        // Por ahora lo enviamos siempre si está activo el cron.

        const chartUrls = getAllImprovedCharts(history, building.tank_capacity_liters);

        // 5. Generar y enviar email
        console.log(`[DAILY-REPORT-CRON] [${building.name}] Construyendo HTML y enviando vía Gmail...`);
        const emailHtml = buildReportEmailHtml(
          building,
          history,
          indicators!,
          lastRecord.liters,
          lastRecord.percentage,
          false,
          0,
          chartUrls
        );

        const sendRes = await sendEmailViaGmail(
          recipients,
          `💧 Reporte Diario Automático: ${Math.round(lastRecord.percentage)}% — ${building.name}`,
          emailHtml,
          building.id,
          'daily_report_cron'
        );

        if (sendRes.success) {
          console.log(`[DAILY-REPORT-CRON] [${building.name}] EXITO: Reporte enviado correctamente.`);
          await logSystemAlert(building.id, 'DAILY_REPORT_SUCCESS', `Reporte enviado a ${recipients.length} miembros`, 'SUCCESS', { recipients });
          results.push({ building: building.name, status: 'success' });
        } else {
          console.error(`[DAILY-REPORT-CRON] [${building.name}] FALLO: Error al enviar email.`, sendRes.error);
          await logSystemAlert(building.id, 'DAILY_REPORT_ERROR', `Error enviando email: ${sendRes.error}`, 'ERROR', { error: sendRes.error });
          results.push({ building: building.name, status: 'error', error: sendRes.error });
        }

      } catch (innerError: any) {
        console.error(`[DAILY-REPORT-CRON] [${building.name}] ERROR CRITICO en loop:`, innerError);
        await logSystemAlert(building.id, 'DAILY_REPORT_CRITICAL_ERROR', innerError.message, 'ERROR');
        results.push({ building: building.name, status: 'critical_error', error: innerError.message });
      }
    }

    console.log('[DAILY-REPORT-CRON] Ejecución finalizada.', { total: buildings.length, results });
    return NextResponse.json({ success: true, processed: results.length, details: results });

  } catch (error: any) {
    console.error('[DAILY-REPORT-CRON] ERROR GENERAL FUERA DEL LOOP:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
