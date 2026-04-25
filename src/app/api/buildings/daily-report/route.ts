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
  console.log('[DAILY-REPORT-CRON] Intento de ejecución:', new Date().toISOString());
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('[DAILY-REPORT-CRON] No autorizado. Header:', authHeader ? 'Presente' : 'Ausente');
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  console.log('[DAILY-REPORT-CRON] Inicio ejecución autorizada');
  
  try {
    // 1. Buscar edificios con reporte diario activado
    const { data: buildings, error: bError } = await supabase
      .from('buildings')
      .select('*')
      .eq('daily_report_enabled', true)
      .eq('status', 'Activo');

    if (bError) {
      console.error('[DAILY-REPORT-CRON] Error buscando edificios:', bError);
      throw bError;
    }

    if (!buildings || buildings.length === 0) {
      console.log('[DAILY-REPORT-CRON] No hay edificios con reportes activados o activos.');
      return NextResponse.json({ success: true, message: 'No buildings to process' });
    }

    console.log(`[DAILY-REPORT-CRON] Procesando ${buildings.length} edificios.`);

    const results = [];

    for (const building of buildings) {
      try {
        // 2. Obtener miembros de la junta para destinatarios
        const { data: members } = await supabase
          .from('building_members')
          .select('email')
          .eq('building_id', building.id)
          .eq('is_junta', true);

        const recipients = members?.map(m => m.email).filter(Boolean) || [];
        if (recipients.length === 0) {
          await logSystemAlert(building.id, 'DAILY_REPORT_SKIP', 'No hay destinatarios en la junta', 'WARNING');
          results.push({ building: building.name, status: 'skipped', reason: 'no recipients' });
          continue;
        }

        // 3. Obtener historial de mediciones
        const { data: history } = await supabase
          .from('measurements')
          .select('*')
          .eq('building_id', building.id)
          .order('recorded_at', { ascending: true });

        if (!history || history.length === 0) {
          await logSystemAlert(building.id, 'DAILY_REPORT_SKIP', 'No hay mediciones para reportar', 'WARNING');
          results.push({ building: building.name, status: 'skipped', reason: 'no measurements' });
          continue;
        }

        // 4. Calcular indicadores y gráficas
        const indicators = calculateIndicators(history, building.tank_capacity_liters);
        const lastRecord = history[history.length - 1];
        const chartUrls = getAllImprovedCharts(history, building.tank_capacity_liters);

        // 5. Generar y enviar email
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
          await logSystemAlert(building.id, 'DAILY_REPORT_SUCCESS', `Reporte enviado a ${recipients.length} miembros`, 'SUCCESS', { recipients });
          results.push({ building: building.name, status: 'success' });
        } else {
          await logSystemAlert(building.id, 'DAILY_REPORT_ERROR', 'Error enviando email', 'ERROR', { error: sendRes.error });
          results.push({ building: building.name, status: 'error', error: sendRes.error });
        }

      } catch (innerError: any) {
        console.error(`[DAILY-REPORT-CRON] Error procesando edificio ${building.name}:`, innerError);
        await logSystemAlert(building.id, 'DAILY_REPORT_CRITICAL_ERROR', innerError.message, 'ERROR');
        results.push({ building: building.name, status: 'critical_error', error: innerError.message });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, details: results });

  } catch (error: any) {
    console.error('[DAILY-REPORT-CRON] Error general:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
