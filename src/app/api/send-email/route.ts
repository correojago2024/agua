/**
 * ARCHIVO: route.ts (API de Envío de Emails - VERSIÓN FINAL IDÉNTICA A PRODUCCIÓN)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { buildReportEmailHtml } from '@/lib/server/email-templates';

// Función Maestra de Anomalías (Idéntica a producción)
function buildAnomalyEmailHtml(building: any, newLiters: number, newPercentage: number, prevLiters: number, prevPercentage: number, variationPct: number, recordedAt: string, reportedBy: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1e293b;"><div style="background:#dc2626;color:white;padding:15px;border-radius:8px 8px 0 0;text-align:center;"><h2 style="margin:0;font-size:18px;">⚠️ Anomalía detectada — ${building.name}</h2></div><div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;"><p style="font-size:14px;">Se detectó una variación de <strong>${variationPct.toFixed(1)}%</strong>.</p><ul style="font-size:13px;line-height:1.8;"><li><strong>Fecha:</strong> ${new Date(recordedAt).toLocaleString('es-ES')}</li><li><strong>Nivel:</strong> ${Math.round(newLiters).toLocaleString()} L (${Number(newPercentage).toFixed(1)}%)</li><li><strong>Reportado por:</strong> ${reportedBy}</li></ul><p style="font-size:11px;color:#94a3b8;margin-top:20px;">Sistema AquaSaaS.</p></div></body></html>`.trim();
}

// Generador de datos simulados realistas para las pruebas de admin
function getProductionMockData() {
  const building = {
    name: "Residencias El Faro (DEMO)",
    tank_capacity_liters: 169000,
    slug: "el-faro-demo"
  };

  const now = new Date();
  const mockHistory = [
    { recorded_at: new Date(now.getTime() - 86400000 * 3).toISOString(), liters: 150000, percentage: 88, variation_lts: 0 },
    { recorded_at: new Date(now.getTime() - 86400000 * 2).toISOString(), liters: 135000, percentage: 79, variation_lts: -15000 },
    { recorded_at: new Date(now.getTime() - 86400000 * 1).toISOString(), liters: 120000, percentage: 71, variation_lts: -15000 },
    { recorded_at: now.toISOString(), liters: 105000, percentage: 62, variation_lts: -15000 }
  ];

  const indicators = {
    reportDate: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    balance24h: { consumed: 15000, filled: 0, net: -15000 },
    avgFlow24h: -625,
    projection11pm: 58.2,
    projectedLiters11pm: 98000,
    timeEstimate: "3.2 días",
    estimateDate: formatRelativeDate(3.2),
    filledToday: 0,
    heatmapData: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 100)))
  };

  const chartUrls = {
    combinadoChart: "https://quickchart.io/chart?c={type:'line',data:{labels:['D-3','D-2','D-1','Hoy'],datasets:[{label:'Nivel',data:[88,79,71,62],borderColor:'blue',fill:true}]}}",
    caudalChart: "https://quickchart.io/chart?c={type:'bar',data:{labels:['D-3','D-2','D-1','Hoy'],datasets:[{label:'Consumo',data:[0,-15000,-15000,-15000],backgroundColor:'red'}]}}",
    dayOfWeekChart: "https://quickchart.io/chart?c={type:'bar',data:{labels:['L','M','X','J','V','S','D'],datasets:[{data:[10,12,15,11,18,25,20],backgroundColor:'blue'}]}}"
  };

  return { building, mockHistory, indicators, chartUrls };
}

function formatRelativeDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template, to } = body;
    const targetEmail = to || ['correojago@gmail.com'];
    const { building, mockHistory, indicators, chartUrls } = getProductionMockData();

    let html = '';
    let subject = '';

    switch (template) {
      case 'measurement_report':
        subject = `💧 Reporte de Agua: 62% — ${building.name}`;
        html = buildReportEmailHtml(building, mockHistory, indicators as any, 105000, 62, false, -9, chartUrls);
        break;

      case 'welcome':
        subject = `🎉 Bienvenido a AquaSaaS — ${building.name}`;
        html = `
          <div style="font-family:sans-serif; max-width:600px; margin:0 auto; background-color:#f8fafc; color:#1e293b; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
            <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8); padding:40px; text-align:center; color:white;">
              <h1 style="margin:0; font-size:24px;">¡Bienvenido a AquaSaaS!</h1>
              <p style="opacity:0.9; margin-top:10px;">Gestión Inteligente de Agua para su Edificio</p>
            </div>
            <div style="padding:30px; line-height:1.6;">
              <p>Hola <strong>Administrador</strong>,</p>
              <p>Es un placer darle la bienvenida. Su edificio ha sido registrado exitosamente en nuestra plataforma.</p>
              <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:20px; margin:25px 0; border-radius:0 12px 12px 0;">
                <p style="color:#1e40af; font-weight:bold; margin:0; font-size:16px;">🏢 Su Panel Administrativo</p>
                <p style="font-size:14px; color:#1e3a8a; margin:8px 0;">Acceda para visualizar estadísticas en tiempo real, bitácora de eventos y gestión de miembros.</p>
                <a href="#" style="color:#2563eb; font-weight:bold; text-decoration:none; font-size:14px;">Ingresar al Panel →</a>
              </div>
              <p style="font-size:12px; color:#64748b; text-align:center; margin-top:40px; border-top:1px solid #f1f5f9; pt-20">2026 AquaSaaS — Control Hídrico Profesional</p>
            </div>
          </div>`;
        break;

      case 'anomaly_alert':
        subject = `⚠️ ALERTA: Anomalía detectada en ${building.name}`;
        html = buildAnomalyEmailHtml(building, 85000, 50, 120000, 71, 15.5, new Date().toISOString(), "Colaborador de Prueba");
        break;

      case 'limit_90_storage':
        subject = `⚠️ Alerta Almacenamiento (90%) — ${building.name}`;
        html = `
          <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #f59e0b; border-radius:16px; overflow:hidden;">
            <div style="background:#fffbeb; border-bottom:1px solid #fef3c7; padding:20px; text-align:center;">
              <h2 style="margin:0; color:#92400e;">📦 Alerta de Almacenamiento</h2>
            </div>
            <div style="padding:30px; line-height:1.6; color:#1e293b;">
              <p>El edificio <strong>${building.name}</strong> ha alcanzado el <strong>90%</strong> de su límite de almacenamiento de registros.</p>
              <p>Uso actual: <strong>180</strong> de <strong>200</strong>.</p>
              <p style="background:#fff7ed; padding:15px; border-radius:12px; font-size:13px; color:#c2410c;">
                <strong>Nota:</strong> Al alcanzar el 100%, el sistema aplicará la política FIFO, eliminando los registros más antiguos para permitir la entrada de nuevos datos.
              </p>
            </div>
          </div>`;
        break;

      case 'limit_90_emails':
        subject = `📧 Alerta Cuota Emails (90%) — ${building.name}`;
        html = `
          <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #3b82f6; border-radius:16px; overflow:hidden;">
            <div style="background:#eff6ff; border-bottom:1px solid #dbeafe; padding:20px; text-align:center;">
              <h2 style="margin:0; color:#1e40af;">📧 Alerta de Envío de Emails</h2>
            </div>
            <div style="padding:30px; line-height:1.6; color:#1e293b;">
              <p>El edificio <strong>${building.name}</strong> ha alcanzado el <strong>90%</strong> de su cuota mensual de correos.</p>
              <p>Enviados: <strong>90</strong> de <strong>100</strong>.</p>
              <p style="background:#f0f9ff; padding:15px; border-radius:12px; font-size:13px; color:#0369a1;">
                <strong>Aviso:</strong> Una vez alcanzado el límite, los datos se seguirán guardando pero las notificaciones por email se pausarán hasta el próximo ciclo mensual.
              </p>
            </div>
          </div>`;
        break;

      default:
        return NextResponse.json({ error: `Plantilla no reconocida: ${template}` }, { status: 400 });
    }

    const result = await sendEmailViaGmail(targetEmail, `[PRUEBA SISTEMA] ${subject}`, html, null, 'admin_test_real');
    return NextResponse.json({ success: result.success, error: result.error });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
