
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateWaterAnalysis, formatAiReportToHtml } from '@/lib/server/ai';
import { sendEmailViaGmail } from '@/lib/server/email';
import { getAllImprovedCharts } from '@/lib/charts';
import { buildAiAnalysisEmailHtml } from '@/lib/server/email-templates';

export async function GET(request: Request) {
// ... (rest of GET)
  const { searchParams } = new URL(request.url);
  const buildingId = searchParams.get('building_id');

  if (!buildingId) {
    return NextResponse.json({ error: 'building_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ia_analysis_reports')
    .select('*')
    .eq('building_id', buildingId)
    .order('generated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // También obtener configuración
  const { data: settings } = await supabase
    .from('building_ia_settings')
    .select('*')
    .eq('building_id', buildingId)
    .single();

  return NextResponse.json({ reports: data, settings });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { building_id, action, settings, date_range, created_by } = body;

    if (!building_id) {
      return NextResponse.json({ error: 'building_id is required' }, { status: 400 });
    }

    // Acción 1: Guardar configuración
    if (action === 'save_settings') {
      const { error } = await supabase
        .from('building_ia_settings')
        .upsert({
          building_id,
          ...settings,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Acción: TEST de conexión
    if (action === 'test') {
      try {
        const testPrompt = 'Responde solo con la palabra OK si puedes leer esto.';
        const aiResponse = await generateWaterAnalysis(testPrompt);
        return NextResponse.json({ 
          success: true, 
          message: 'Conexión exitosa con Gemini',
          response: aiResponse
        });
      } catch (err: any) {
        return NextResponse.json({ 
          success: false, 
          error: err.message 
        }, { status: 500 });
      }
    }

    // Acción 2: Generar nuevo análisis
    if (action === 'generate') {
      const { data: building } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', building_id)
        .single();

      if (!building) throw new Error('Edificio no encontrado');

      // Obtener mediciones para el rango
      let query = supabase
        .from('measurements')
        .select('*')
        .eq('building_id', building_id)
        .order('recorded_at', { ascending: true });

      if (date_range?.start) query = query.gte('recorded_at', date_range.start);
      if (date_range?.end) query = query.lte('recorded_at', date_range.end);

      const { data: measurements } = await query;

      if (!measurements || measurements.length === 0) {
        return NextResponse.json({ error: 'No hay datos suficientes para el rango seleccionado' }, { status: 400 });
      }

      // Preparar datos para el prompt
      const csvData = measurements.map(m => 
        `${m.recorded_at},${m.liters},${m.percentage}%,${m.collaborator_name || 'Anónimo'}`
      ).join('\n');

      const prompt = `
Actúa como un ingeniero hidráulico / especialista en gestión de recursos hídricos en edificaciones residenciales.

Voy a proporcionarte un conjunto de datos reales del edificio "${building.name}" con ${building.apartments_count || 'xx'} apartamentos, capacidad de tanque de ${building.tank_capacity_liters}L.

🎯 OBJETIVO DEL ANÁLISIS
Realiza un informe técnico completo y profesional que incluya:
1. Resumen Ejecutivo
2. Validación y Calidad de Datos
3. Análisis Técnico del Consumo
4. Detección de Anomalías (fugas, consumos nocturnos)
5. Comparación con Referencias Estándar
6. Evaluación del Sistema de Almacenamiento
7. Hallazgos Principales
8. Recomendaciones Técnicas (Corto, mediano y largo plazo)
9. Conclusión Profesional

📊 DATOS DEL EDIFICIO
Nombre: ${building.name}
Capacidad Tanque: ${building.tank_capacity_liters} L
Total Registros: ${measurements.length}
Rango: ${date_range?.start || 'Inicio'} hasta ${date_range?.end || 'Fin'}

DATOS DE MEDICIONES (Fecha, Litros, Porcentaje, Colaborador):
${csvData}

📈 REQUERIMIENTOS ADICIONALES
Usa lenguaje técnico pero claro.
NO menciones a Gemini ni a Google.
Genera el informe listo para ser presentado.
`;

      const aiText = await generateWaterAnalysis(prompt);
      const htmlReport = formatAiReportToHtml(aiText);

      // Guardar el reporte
      const { data: newReport, error: repError } = await supabase
        .from('ia_analysis_reports')
        .insert({
          building_id,
          report_text: aiText,
          html_report: htmlReport,
          date_range_start: date_range?.start,
          date_range_end: date_range?.end,
          created_by,
          analysis_type: body.analysis_type || 'general'
        })
        .select()
        .single();

      if (repError) throw repError;

      // Actualizar last_analysis_at
      await supabase
        .from('building_ia_settings')
        .update({ last_analysis_at: new Date().toISOString() })
        .eq('building_id', building_id);

      return NextResponse.json({ success: true, report: newReport });
    }

    // Acción 3: Enviar por email
    if (action === 'send_email') {
      const { report_id, recipients } = body;
      const { data: report } = await supabase.from('ia_analysis_reports').select('*').eq('id', report_id).single();
      const { data: building } = await supabase.from('buildings').select('*').eq('id', building_id).single();

      if (!report || !building) throw new Error('Datos no encontrados');

      // Obtener mediciones para los gráficos (últimas 200)
      const { data: measurements } = await supabase
        .from('measurements')
        .select('*')
        .eq('building_id', building_id)
        .order('recorded_at', { ascending: false })
        .limit(200);

      let chartUrls = null;
      if (measurements && measurements.length > 0) {
        chartUrls = getAllImprovedCharts(measurements.reverse(), building.tank_capacity_liters);
      }

      const subject = `📊 Informe de Análisis IA - ${building.name}`;
      const emailHtml = buildAiAnalysisEmailHtml(building, report, chartUrls);

      const recipientList = recipients.split(',').map((e: string) => e.trim());
      await sendEmailViaGmail(recipientList, subject, emailHtml, building_id, 'ia_analysis');

      await supabase.from('ia_analysis_reports').update({ sent_to: recipients }).eq('id', report_id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
