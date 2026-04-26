/**
 * ARCHIVO: route.ts (API de Envío de Emails - VERSIÓN FINAL UNIFICADA)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { buildReportEmailHtml } from '@/lib/server/email-templates';
import { supabase } from '@/lib/supabase';

// Función Maestra de Anomalías
function buildAnomalyEmailHtml(building: any, newLiters: number, newPercentage: number, prevLiters: number, prevPercentage: number, variationPct: number, recordedAt: string, reportedBy: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;color:#1e293b;"><div style="background:#dc2626;color:white;padding:15px;border-radius:8px 8px 0 0;text-align:center;"><h2 style="margin:0;font-size:18px;">⚠️ Anomalía detectada — ${building.name}</h2></div><div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;"><p style="font-size:14px;">Se detectó una variación de <strong>${variationPct.toFixed(1)}%</strong>.</p><ul style="font-size:13px;line-height:1.8;"><li><strong>Fecha:</strong> ${new Date(recordedAt).toLocaleString('es-ES')}</li><li><strong>Nivel:</strong> ${Math.round(newLiters).toLocaleString()} L (${Number(newPercentage).toFixed(1)}%)</li><li><strong>Reportado por:</strong> ${reportedBy}</li></ul><p style="font-size:11px;color:#94a3b8;margin-top:20px;">Sistema AquaSaaS.</p></div></body></html>`.trim();
}

// Datos simulados realistas para las pruebas de admin
function getProductionMockData() {
  const building = { name: "Residencias El Faro (DEMO)", tank_capacity_liters: 169000, slug: "el-faro-demo" };
  const now = new Date();
  const mockHistory = [
    { recorded_at: new Date(now.getTime() - 86400000 * 3).toISOString(), liters: 150000, percentage: 88 },
    { recorded_at: now.toISOString(), liters: 105000, percentage: 62 }
  ];
  const indicators = {
    reportDate: now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    balance24h: { consumed: 15000, filled: 0, net: -15000 },
    avgFlow24h: -625, projection11pm: 58.2, projectedLiters11pm: 98000, timeEstimate: "3.2 días",
    estimateDate: "30 de Abril", filledToday: 0,
    heatmapData: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 100)))
  };
  const chartUrls = { combinadoChart: "", caudalChart: "", dayOfWeekChart: "" };
  return { building, mockHistory, indicators, chartUrls };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, template, building, member, to, building_id } = body;
    const targetTemplate = template || type;

    // 1. SI ES UNA PRUEBA REAL DESDE EL PANEL ADMIN (Galería)
    if (body.template) {
      const { building: b, mockHistory, indicators, chartUrls } = getProductionMockData();
      let html = '';
      let subject = '';

      switch (targetTemplate) {
        case 'measurement_report':
          subject = `[PRUEBA] 💧 Reporte de Agua: 62% — ${b.name}`;
          html = buildReportEmailHtml(b, mockHistory, indicators as any, 105000, 62, false, -9, chartUrls);
          break;
        case 'welcome':
          subject = `[PRUEBA] 🎉 Bienvenido a AquaSaaS — ${b.name}`;
          html = `<div style="font-family:sans-serif;padding:30px;"><h1>¡Bienvenido Admin!</h1><p>Su edificio ha sido registrado.</p></div>`;
          break;
        case 'anomaly_alert':
          subject = `[PRUEBA] ⚠️ ALERTA: Anomalía detectada en ${b.name}`;
          html = buildAnomalyEmailHtml(b, 85000, 50, 120000, 71, 15.5, new Date().toISOString(), "Prueba");
          break;
        case 'limit_90_storage':
          subject = `[PRUEBA] 📦 Alerta Almacenamiento (90%)`;
          html = `<h3>Almacenamiento al 90%</h3><p>Uso actual: 180 de 200 registros.</p>`;
          break;
        case 'limit_90_emails':
          subject = `[PRUEBA] 📧 Alerta Cuota Emails (90%)`;
          html = `<h3>Emails al 90%</h3><p>Enviados: 90 de 100.</p>`;
          break;
        case 'junta_welcome':
          subject = `[PRUEBA] 🏛️ Bienvenida Junta`;
          html = `<h3>Bienvenido a la Junta</h3><p>Usted ha sido invitado a supervisar el edificio.</p>`;
          break;
        case 'recover':
          subject = `[PRUEBA] 🔐 Recuperación de Clave`;
          html = `<h3>Recuperación de Clave</h3><p>Su clave maestra es: 123456</p>`;
          break;
        default:
          html = `<h3>Prueba de Mensaje: ${targetTemplate}</h3><p>Este es un mensaje de prueba genérico.</p>`;
          subject = `[PRUEBA] Mensaje del Sistema: ${targetTemplate}`;
      }
      const res = await sendEmailViaGmail(to || ['correojago@gmail.com'], subject, html, null, 'admin_test');
      return NextResponse.json({ success: res.success });
    }

    // 2. FLUJOS DE PRODUCCIÓN REALES (Registro de Miembros, Bienvenida, etc.)
    if (type === 'junta_welcome') {
      const juntaHtml = `
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
          <div style="background:#4f46e5; padding:30px; text-align:center; color:white;">
            <h1 style="margin:0; font-size:20px;">🏛️ Invitación a la Junta de Condominio</h1>
          </div>
          <div style="padding:25px; line-height:1.6; color:#1e293b;">
            <p>Hola <strong>${member.name || 'Miembro'}</strong>,</p>
            <p>Has sido invitado a formar parte del panel de supervisión de <strong>${building.name}</strong> en AquaSaaS.</p>
            <p>Desde tu panel podrás visualizar gráficos de consumo, historial y recibir informes automáticos.</p>
            <div style="margin:25px 0; text-align:center;">
              <a href="https://agua-rust.vercel.app/edificio-admin/${building.slug}" style="background:#4f46e5; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold; display:inline-block;">Acceder a mi Panel</a>
            </div>
          </div>
        </div>`.trim();
      const res = await sendEmailViaGmail([member.email], `🏛️ Acceso al Panel Administrativo — ${building.name}`, juntaHtml, building.id, 'junta_welcome');
      return NextResponse.json({ success: res.success });
    }

    if (type === 'welcome') {
      const welcomeHtml = `<h1>Bienvenido ${building.name}</h1><p>Tu edificio ha sido activado.</p>`;
      const res = await sendEmailViaGmail([building.admin_email], `🎉 Bienvenido a AquaSaaS — ${building.name}`, welcomeHtml, building.id, 'welcome');
      return NextResponse.json({ success: res.success });
    }

    if (type === 'recover') {
      const recoverHtml = `<h3>Recuperación de Clave</h3><p>Tu clave para ${building.name} es: <strong>${building.password}</strong></p>`;
      const res = await sendEmailViaGmail([building.admin_email], `🔑 Clave de Acceso — ${building.name}`, recoverHtml, building.id, 'recover');
      return NextResponse.json({ success: res.success });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });

  } catch (error: any) {
    console.error('[API-EMAIL-ERROR]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
