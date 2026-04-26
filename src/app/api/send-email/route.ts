/**
 * ARCHIVO: route.ts (API de Envío de Emails - GENERADOR DE PRUEBAS REALES)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { buildReportEmailHtml } from '@/lib/server/email-templates';

// Función para generar datos simulados idénticos a un caso real
function getMockData() {
  const building = {
    name: "Residencias El Faro (PRUEBA)",
    tank_capacity_liters: 169000,
    slug: "el-faro-demo"
  };

  const now = new Date();
  const mockMeasurements = [
    { recorded_at: new Date(now.getTime() - 3600000 * 24).toISOString(), liters: 120000, percentage: 71, variation_lts: 5000, flow_lpm: 1.2, collaborator_name: "Admin" },
    { recorded_at: new Date(now.getTime() - 3600000 * 5).toISOString(), liters: 110000, percentage: 65, variation_lts: -10000, flow_lpm: -2.5, collaborator_name: "Carlos Pérez" },
    { recorded_at: now.toISOString(), liters: 105000, percentage: 62, variation_lts: -5000, flow_lpm: -1.8, collaborator_name: "María García" }
  ];

  const indicators = {
    reportDate: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    balance24h: { consumed: 15000, filled: 5000, net: -10000 },
    avgFlow24h: -416.6,
    projection11pm: 58.5,
    projectedLiters11pm: 98000,
    timeEstimate: "1.5 días",
    estimateDate: "28 de Abril",
    filledToday: 0,
    heatmapData: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.random() > 0.7 ? 100 : 0))
  };

  const chartUrls = {
    combinadoChart: "https://quickchart.io/chart?c={type:'line',data:{labels:['Lun','Mar','Mie','Jue','Vie'],datasets:[{label:'Nivel',data:[80,75,70,65,62],borderColor:'blue',fill:true}]}}",
    caudalChart: "https://quickchart.io/chart?c={type:'bar',data:{labels:['Lun','Mar','Mie','Jue','Vie'],datasets:[{label:'Consumo',data:[-500,-600,-400,-800,-500],backgroundColor:'red'}]}}",
    dayOfWeekChart: "https://quickchart.io/chart?c={type:'bar',data:{labels:['L','M','X','J','V','S','D'],datasets:[{data:[10,12,15,11,18,25,20],backgroundColor:'blue'}]}}"
  };

  return { building, mockMeasurements, indicators, chartUrls };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template, to } = body;
    const recipients = to || ['correojago@gmail.com'];
    const { building, mockMeasurements, indicators, chartUrls } = getMockData();

    let html = '';
    let subject = '';

    switch (template) {
      case 'measurement_report':
        subject = `💧 Reporte de Agua: 62% — ${building.name}`;
        html = buildReportEmailHtml(building, mockMeasurements, indicators as any, 105000, 62, false, -3, chartUrls);
        break;

      case 'welcome':
        subject = `🎉 Bienvenido a AquaSaaS — ${building.name}`;
        html = `
          <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
            <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8); padding:40px; text-align:center; color:white;">
              <h1 style="margin:0;">¡Bienvenido!</h1>
              <p>Tu edificio ha sido activado correctamente.</p>
            </div>
            <div style="padding:30px; line-height:1.6; color:#1e293b;">
              <p>Hola <strong>Admin</strong>,</p>
              <p>Este es el correo real que reciben los administradores al registrarse.</p>
              <a href="#" style="background:#2563eb; color:white; padding:12px 20px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:bold;">Acceder al Panel</a>
            </div>
          </div>`;
        break;

      case 'anomaly_alert':
        subject = `⚠️ ALERTA: Anomalía detectada en ${building.name}`;
        html = `
          <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:2px solid #dc2626; border-radius:16px; overflow:hidden;">
            <div style="background:#dc2626; color:white; padding:20px; text-align:center;"><h2>🚨 Variación Brusca Detectada</h2></div>
            <div style="padding:25px;">
              <p>Se detectó una caída del <strong>15%</strong> en menos de 1 hora.</p>
              <p>Por favor revise las válvulas o posibles fugas.</p>
            </div>
          </div>`;
        break;

      case 'limit_90_storage':
        subject = `⚠️ Alerta Almacenamiento (90%) — ${building.name}`;
        html = `<div style="padding:30px; border:1px solid #f59e0b; border-radius:12px; font-family:sans-serif;">
          <h2 style="color:#92400e;">Capacidad de Almacenamiento al 90%</h2>
          <p>Has alcanzado 180 de 200 registros. Al llegar al límite, los datos viejos se borrarán para dar paso a los nuevos.</p>
        </div>`;
        break;

      default:
        return NextResponse.json({ error: 'Plantilla no reconocida para prueba real' }, { status: 400 });
    }

    const result = await sendEmailViaGmail(recipients, `[PRUEBA REAL] ${subject}`, html, null, 'admin_test_real');
    return NextResponse.json({ success: result.success, error: result.error });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
