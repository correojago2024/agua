
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
      const { building_id, date_range, created_by, custom_instructions } = body;
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
Actúa como un ingeniero hidráulico experto senior de nivel mundial.
Tu misión es redactar un INFORME TÉCNICO DE INTELIGENCIA HÍDRICA impecable.

📊 ESTADÍSTICAS REALES (Usa estos números exactos, prohibido inventar o dejar en cero):
- Edificio: ${building.name}
- Capacidad: ${building.tank_capacity_liters} Litros
- Consumo Diario Real: ${Math.round(consDiarioProm).toLocaleString()} L/día
- Autonomía Actual: ${(autonomiaEstimada / 24).toFixed(1)} días
- Nivel Promedio: ${avgLevel.toFixed(1)}%

🌍 BENCHMARKS DE REFERENCIA (Úsalos para comparar):
- Estándar Mundial: 200 Litros por persona al día.
- Para este edificio de ${building.apartments_count || 43} aptos (est. 150 personas), el consumo ideal sería: ${((building.apartments_count || 43) * 3.5 * 200).toLocaleString()} L/día.
- Si el consumo real (${Math.round(consDiarioProm).toLocaleString()} L/día) es menor al ideal, felicita a la comunidad por su ahorro o menciona posible sub-registro.

${custom_instructions ? `📝 INSTRUCCIONES ADICIONALES DEL USUARIO (Síguelas estrictamente):\n${custom_instructions}\n` : ''}

🚫 REGLAS DE ORO:
- PROHIBIDO usar símbolos como "$0", "0" o guiones para datos faltantes. Si no tienes un dato, usa "Dato no disponible" o "Pendiente de medición".
- PROHIBIDO usar placeholders como "[Tu Nombre]".
- OBLIGATORIO: Usa tablas Markdown para los KPIs y el Balance Hídrico.
- TONO: Técnico, preciso, ejecutivo y propositivo.

🎯 ESTRUCTURA OBLIGATORIA DEL INFORME:
# INFORME DE INTELIGENCIA HÍDRICA
**PARA:** Junta de Condominio Residencias ${building.name}
**DE:** IA aGuaSaaS
**ASUNTO:** Diagnóstico de Eficiencia hídrica y Gestión de Reservas

1. RESUMEN EJECUTIVO (Con tabla de KPIs principales)
2. ANÁLISIS DE EFICIENCIA (Compara el consumo real vs el estándar internacional calculado arriba)
3. BALANCE HÍDRICO (Tabla de Consumo vs Llenado y diagnóstico de sostenibilidad)
4. HALLAZGOS Y ANOMALÍAS (Basado en la data adjunta)
5. RECOMENDACIONES TÉCNICAS (Mínimo 5 acciones numeradas y priorizadas)

Atentamente,

Sistema aGuaSaaS
*Inteligencia para la Gestión de fluidos*
`;

      const aiText = await generateWaterAnalysis(prompt, currentSettings?.ia_api_key);
      let htmlReport = formatAiReportToHtml(aiText);

      // Añadir AVISO Y EXENCIÓN DE RESPONSABILIDAD
      const disclaimer = `
        <div style="margin-top: 40px; padding: 20px; border: 1px solid #fcd34d; background-color: #fffbeb; border-radius: 12px; font-size: 12px; color: #92400e; line-height: 1.5;">
          <strong>⚠️ AVISO Y EXENCIÓN DE RESPONSABILIDAD:</strong><br>
          Este reporte es informativo. El análisis se basa en datos históricos y no garantiza resultados. 
          La información obtenida por la IA es el resultado de un sistema de inteligencia artificial, 
          por lo que aGuaSaaS no se hace responsable de las opiniones e información emitida en la toma de decisiones del usuario. 
          La IA puede cometer errores. Revise y chequee la información suministrada. 
          El usuario es responsable de sus decisiones.
        </div>
      `;
      
      const lastDivIndex = htmlReport.lastIndexOf('</div>');
      if (lastDivIndex !== -1) {
        htmlReport = htmlReport.substring(0, lastDivIndex) + disclaimer + htmlReport.substring(lastDivIndex);
      }

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
