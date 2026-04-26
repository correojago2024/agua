
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateWaterAnalysis, formatAiReportToHtml, testAiConnection } from '@/lib/server/ai';
import { sendEmailViaGmail } from '@/lib/server/email';
import { getAllImprovedCharts } from '@/lib/charts';
import { buildAiAnalysisEmailHtml } from '@/lib/server/email-templates';

export async function GET(request: Request) {
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

    // Obtener settings actuales para la API KEY si existe
    const { data: currentSettings } = await supabase
      .from('building_ia_settings')
      .select('*')
      .eq('building_id', building_id)
      .single();

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

    // Acción: TEST de conexión con Diagnóstico
    if (action === 'test') {
      try {
        const diagnostico = await testAiConnection(currentSettings?.ia_api_key);
        return NextResponse.json({ 
          success: true, 
          diagnostico
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // Acción: ELIMINAR reporte
    if (action === 'delete_report') {
      const { report_id } = body;
      const { error } = await supabase
        .from('ia_analysis_reports')
        .delete()
        .eq('id', report_id);
      
      if (error) throw error;
      return NextResponse.json({ success: true });
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

      // --- CÁLCULO DE ESTADÍSTICAS PREVIAS PARA LA IA ---
      const ltsVals = measurements.map(m => m.liters).filter(v => v > 0);
      const pcts = measurements.map(m => m.percentage);
      const variations = measurements.map(m => m.variation_lts || 0);
      
      const totalConsumed = Math.abs(variations.filter(v => v < 0).reduce((a, b) => a + b, 0));
      const totalFilled = variations.filter(v => v > 0).reduce((a, b) => a + b, 0);
      const avgLevel = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      
      const lastM = measurements[measurements.length - 1];
      const firstM = measurements[0];
      const daysDiff = Math.max(1, (new Date(lastM.recorded_at).getTime() - new Date(firstM.recorded_at).getTime()) / (1000 * 60 * 60 * 24));
      
      const consDiarioProm = totalConsumed / daysDiff;
      const autonomiaEstimada = lastM.liters / (consDiarioProm / 24 || 1);

      // Preparar datos para el prompt
      const csvData = measurements.slice(-100).map(m => 
        `${m.recorded_at},${Math.round(m.liters)}L,${Math.round(m.percentage)}%,${m.collaborator_name || 'Anónimo'}`
      ).join('\n');

      const prompt = `
Actúa como un ingeniero hidráulico experto senior en gestión de recursos hídricos para edificaciones residenciales.
Tu objetivo es generar un INFORME TÉCNICO DE GESTIÓN HÍDRICA de nivel ejecutivo.

📊 DATOS DEL EDIFICIO Y ESTADÍSTICAS CALCULADAS:
- Edificio: ${building.name}
- Apartamentos: ${building.apartments_count || '43'}
- Capacidad Tanque: ${building.tank_capacity_liters} Litros
- Periodo: ${new Date(firstM.recorded_at).toLocaleDateString()} al ${new Date(lastM.recorded_at).toLocaleDateString()}
- Registros: ${measurements.length}
- Nivel Promedio: ${avgLevel.toFixed(1)}%
- Consumo Total: ${Math.round(totalConsumed).toLocaleString()} L
- Llenado Total: ${Math.round(totalFilled).toLocaleString()} L
- Consumo Diario Promedio: ${Math.round(consDiarioProm).toLocaleString()} L/día
- Autonomía Actual: ${(autonomiaEstimada / 24).toFixed(1)} días

⚠️ NORMAS ESTRICTAS DE FORMATO Y CONTENIDO:
1. PROHIBICIÓN DE CEROS: Queda terminantemente prohibido usar placeholders como "$0", "0" o vacíos para datos que no tengas. Si no hay una comparativa, redacta un análisis cualitativo o usa "N/A".
2. COMPARATIVA ESTÁNDAR: Usa como referencia que una persona consume aprox. 200L/día. Para un edificio de ${building.apartments_count || '43'} aptos (promedio 3.5 personas/apto), el consumo esperado sería de aprox. ${((building.apartments_count || 43) * 3.5 * 200).toLocaleString()} L/día. Compara este estándar con el real de ${Math.round(consDiarioProm).toLocaleString()} L/día.
3. TABLAS OBLIGATORIAS: Genera tablas Markdown para el Resumen Ejecutivo (KPIs) y para el Balance Hídrico (Consumo vs Llenado).
4. FIRMA: Finaliza el informe con una firma profesional del "Departamento de Ingeniería aGuaSaaS".

🎯 ESTRUCTURA REQUERIDA:
# INFORME TÉCNICO DE GESTIÓN HÍDRICA
1. RESUMEN EJECUTIVO (Con tabla de KPIs)
2. CALIDAD DE LA DATA (Menciona si la frecuencia de reportes es suficiente)
3. ANÁLISIS DE BALANCE HÍDRICO (Tabla Comparativa y Conclusión sobre si el llenado es suficiente)
4. DETECCIÓN DE ANOMALÍAS (Analiza fugas nocturnas o picos atípicos en la data adjunta)
5. REFERENCIAS INTERNACIONALES (Compara con el estándar de 200L/persona/día)
6. RECOMENDACIONES TÉCNICAS (Mínimo 5 acciones priorizadas)

ÚLTIMOS REGISTROS PARA ANÁLISIS DE PATRONES:
${csvData}
`;

      const aiText = await generateWaterAnalysis(prompt, currentSettings?.ia_api_key);
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
