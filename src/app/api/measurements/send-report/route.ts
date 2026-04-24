/**
 * API: /api/measurements/send-report
 * Envía el reporte de agua actual manualmente.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateIndicators } from '@/lib/calculations';
import { getAllImprovedCharts } from '@/lib/charts';
import { sendEmailViaGmail } from '@/lib/server/email';
import { logAudit } from '@/lib/audit';
import { buildReportEmailHtml } from '@/lib/server/email-templates';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { building_id, recipients, sender_email } = body;

    if (!building_id || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const { data: building } = await supabase.from('buildings').select('*').eq('id', building_id).single();
    if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });

    const { data: history } = await supabase.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true });
    if (!history || history.length === 0) return NextResponse.json({ error: 'No hay mediciones para reportar' }, { status: 400 });

    const indicators = calculateIndicators(history, building.tank_capacity_liters);
    if (!indicators) return NextResponse.json({ error: 'No se pudieron calcular los indicadores' }, { status: 500 });

    const lastRecord = history[history.length - 1];
    const chartUrls = getAllImprovedCharts(history, building.tank_capacity_liters);
    
    // Log previo
    await logAudit({ req: request, building_id, user_email: sender_email || 'ADMIN', operation: 'MANUAL_SEND', entity_type: 'email', entity_id: building_id, data_after: { recipients } });

    // GENERAR HTML PROFESIONAL
    const emailHtml = buildReportEmailHtml(
      building, 
      history, 
      indicators, 
      lastRecord.liters, 
      lastRecord.percentage, 
      false, // No es anomalía por defecto en manual
      0, 
      chartUrls
    );

    const res = await sendEmailViaGmail(
      recipients, 
      `💧 Reporte de Agua — ${building.name}`, 
      emailHtml, 
      building_id, 
      'manual_report'
    );

    if (res.success) {
      await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'SUCCESS', entity_type: 'email', entity_id: building_id, data_after: { message: 'Reporte manual enviado' } });
      return NextResponse.json({ success: true });
    } else {
      await logAudit({ req: request, building_id, user_email: 'SYSTEM', operation: 'ERROR', entity_type: 'email', entity_id: building_id, data_after: { error: res.error } });
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
