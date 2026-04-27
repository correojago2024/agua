/**
 * ARCHIVO: route.ts (API de Envío de Emails - VERSIÓN FINAL UNIFICADA)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { buildReportEmailHtml, buildAnomalyEmailHtml } from '@/lib/server/email-templates';
import { supabase } from '@/lib/supabase';

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

    // Obtener host para links dinámicos
    const host = request.headers.get('host') || 'agua-rust.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

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
          subject = `[PRUEBA] 🎉 Bienvenido a aGuaSaaS — ${b.name}`;
          html = `<div style="font-family:sans-serif;padding:30px;"><h1>¡Bienvenido Admin!</h1><p>Su edificio ha sido registrado.</p></div>`;
          break;
        case 'anomaly_alert':
          subject = `[PRUEBA] ⚠️ ALERTA: Anomalía detectada en ${b.name}`;
          html = buildAnomalyEmailHtml(b, 85000, 50, 120000, 71, 15.5, new Date().toISOString(), "Prueba", 15);
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
          subject = `[PRUEBA] 💧 Bienvenido al Sistema de Control del Agua`;
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
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden; background-color:#ffffff; color:#1e293b; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
          <div style="background:linear-gradient(135deg, #4f46e5, #3730a3); padding:40px; text-align:center; color:white;">
            <h1 style="margin:0; font-size:24px;">¡Bienvenido a la Junta de Condominio!</h1>
            <p style="opacity:0.9; margin-top:10px;">Acceso al Panel de Control aGuaSaaS</p>
          </div>
          <div style="padding:35px; line-height:1.6;">
            <p style="font-size:16px;">Hola <strong>${member.name || 'Miembro'}</strong>,</p>
            <p>Has sido agregado como miembro de la junta para el edificio <strong>${building.name}</strong> en el sistema de monitoreo hídrico <strong>aGuaSaaS</strong>.</p>
            
            <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:16px; padding:25px; margin:25px 0; text-align:center;">
              <p style="margin:0; color:#64748b; font-size:13px; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em;">Tu Clave Temporal de Acceso:</p>
              <p style="margin:10px 0 0; color:#4f46e5; font-size:32px; font-weight:900; letter-spacing:4px;">123456</p>
            </div>

            <h3 style="color:#1e293b; font-size:18px; margin-top:30px;">🚀 Pasos para empezar:</h3>
            <ol style="padding-left:20px; color:#475569;">
              <li style="margin-bottom:10px;">Haz clic en el enlace del portal abajo.</li>
              <li style="margin-bottom:10px;">Ingresa con tu correo: <strong>${member.email}</strong> y la clave temporal.</li>
              <li style="margin-bottom:10px;">El sistema te pedirá crear tu propia contraseña de usuario por seguridad.</li>
              <li>¡Listo! Podrás ver los gráficos, reportes y configurar alertas.</li>
            </ol>

            <div style="margin:40px 0; text-align:center;">
              <a href="${baseUrl}/edificio-admin/${building.slug}" style="background:#4f46e5; color:#ffffff; padding:16px 32px; text-decoration:none; border-radius:12px; font-weight:bold; display:inline-block; font-size:15px; box-shadow:0 4px 6px -1px rgba(79, 70, 229, 0.4);">Acceder al Portal Administrativo</a>
            </div>
            
            <p style="font-size:12px; color:#94a3b8; text-align:center; margin-top:40px; border-top:1px solid #f1f5f9; padding-top:20px;">2026 aGuaSaaS — Tecnología para su Comunidad</p>
          </div>
        </div>`.trim();
      const res = await sendEmailViaGmail([member.email], `💧 Bienvenido al Sistema de Control del Agua — ${building.name}`, juntaHtml, building.id, 'junta_welcome');
      return NextResponse.json({ success: res.success, error: res.error });
    }

    if (type === 'welcome') {
      const welcomeHtml = `<h1>Bienvenido ${building.name}</h1><p>Tu edificio ha sido activado.</p>`;
      const res = await sendEmailViaGmail([building.admin_email], `🎉 Bienvenido a aGuaSaaS — ${building.name}`, welcomeHtml, building.id, 'welcome');
      return NextResponse.json({ success: res.success });
    }

    if (type === 'recover') {
      const recoverHtml = `<h3>Recuperación de Clave</h3><p>Tu clave para ${building.name} es: <strong>${building.password}</strong></p>`;
      const res = await sendEmailViaGmail([building.admin_email], `🔑 Clave de Acceso — ${building.name}`, recoverHtml, building.id, 'recover');
      return NextResponse.json({ success: res.success });
    }

    if (type === 'password_changed') {
      const ip = request.headers.get('x-forwarded-for') || 'Desconocida';
      const userAgent = body.metadata?.userAgent || 'Desconocido';
      const localTime = body.metadata?.localTime || new Date().toLocaleString();

      const pcHtml = `
        <div style="font-family:sans-serif; max-width:500px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; padding:30px; color:#1e293b;">
          <div style="text-align:center; margin-bottom:20px;">
            <div style="background:#f0f7ff; width:60px; height:60px; line-height:60px; border-radius:50%; display:inline-block; font-size:30px;">🔒</div>
          </div>
          <h2 style="color:#0d6efd; margin-top:0; text-align:center;">Seguridad Actualizada</h2>
          <p>Hola,</p>
          <p>Te informamos que la contraseña de tu cuenta en <strong>aGuaSaaS</strong> ha sido cambiada exitosamente para el edificio <strong>${building.name}</strong>.</p>
          
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin:20px 0;">
            <h3 style="margin-top:0; font-size:14px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Detalles de la Actividad:</h3>
            <table style="width:100%; font-size:13px; color:#334155;">
              <tr><td style="padding:5px 0; color:#64748b;">Fecha/Hora:</td><td style="padding:5px 0; font-weight:bold;">${localTime}</td></tr>
              <tr><td style="padding:5px 0; color:#64748b;">Dirección IP:</td><td style="padding:5px 0; font-weight:bold;">${ip}</td></tr>
              <tr><td style="padding:5px 0; color:#64748b;">Navegador:</td><td style="padding:5px 0; font-weight:bold; font-size:11px;">${userAgent}</td></tr>
            </table>
          </div>

          <p style="font-size:12px; color:#dc2626; background:#fef2f2; padding:10px; border-radius:8px; border:1px solid #fee2e2;">
            <strong>¿No fuiste tú?</strong> Si no realizaste este cambio, por favor contacta de inmediato al administrador del sistema para proteger tu cuenta.
          </p>
          
          <p style="margin-top:25px; border-top:1px solid #eee; padding-top:20px; font-size:13px; color:#94a3b8; text-align:center;">
            Atentamente,<br><strong>Equipo de Seguridad aGuaSaaS</strong>
          </p>
        </div>`.trim();
      const res = await sendEmailViaGmail([member.email], `🔒 Seguridad: Tu contraseña ha sido cambiada — aGuaSaaS`, pcHtml, building.id, 'password_changed');
      return NextResponse.json({ success: res.success });
    }

    if (type === 'plan_change_request') {
      const { currentPlan, requestedPlan, reason, metadata } = body.data;
      const ip = request.headers.get('x-forwarded-for') || 'Desconocida';
      const userAgent = request.headers.get('user-agent') || 'Desconocido';
      const localTime = metadata?.localTime || new Date().toLocaleString();

      const adminHtml = `
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; padding:30px; color:#1e293b;">
          <h2 style="color:#2563eb;">🚀 Nueva Solicitud de Cambio de Plan</h2>
          <p>El edificio <strong>${building.name}</strong> ha solicitado un cambio de plan.</p>
          
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin:20px 0;">
            <h3 style="margin-top:0; font-size:14px; color:#64748b; text-transform:uppercase;">Detalles del Edificio:</h3>
            <p><strong>Edificio:</strong> ${building.name} (${building.slug})</p>
            <p><strong>Solicitante:</strong> ${member?.name || 'Administrador'} (${member?.email || building.admin_email})</p>
            <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;">
            <p><strong>Plan Actual:</strong> <span style="text-transform:uppercase;">${currentPlan}</span></p>
            <p><strong>Plan Solicitado:</strong> <span style="text-transform:uppercase; color:#2563eb; font-weight:bold;">${requestedPlan}</span></p>
            <p><strong>Motivo:</strong> ${reason || 'No especificado'}</p>
          </div>

          <div style="background:#f1f5f9; padding:15px; border-radius:8px; font-size:11px; color:#64748b;">
            <p style="margin:0 0 5px 0; font-weight:bold; text-transform:uppercase;">Metadatos de la solicitud:</p>
            <p style="margin:2px 0;"><strong>IP:</strong> ${ip}</p>
            <p style="margin:2px 0;"><strong>Hora Local:</strong> ${localTime}</p>
            <p style="margin:2px 0;"><strong>Navegador:</strong> ${userAgent}</p>
          </div>
        </div>
      `.trim();

      const userHtml = `
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:16px; padding:30px; color:#1e293b;">
          <h2 style="color:#2563eb;">✅ Solicitud Recibida</h2>
          <p>Hola <strong>${member?.name || 'Administrador'}</strong>,</p>
          <p>Hemos recibido exitosamente tu solicitud para cambiar el plan del edificio <strong>${building.name}</strong> al plan <strong><span style="text-transform:uppercase;">${requestedPlan}</span></strong>.</p>
          <p>Nuestro equipo revisará la solicitud y se pondrá en contacto contigo a la brevedad posible para finalizar el proceso.</p>
          
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin:20px 0;">
            <p style="margin:0;"><strong>Resumen de tu solicitud:</strong></p>
            <ul style="margin:10px 0 0; padding-left:20px; font-size:14px; color:#475569;">
              <li>Plan solicitado: ${requestedPlan.toUpperCase()}</li>
              <li>Fecha de solicitud: ${localTime}</li>
            </ul>
          </div>

          <p style="font-size:13px; color:#64748b; margin-top:30px; text-align:center;">Gracias por confiar en <strong>aGuaSaaS</strong>.</p>
        </div>
      `.trim();

      // Enviar a correojago
      await sendEmailViaGmail(['correojago@gmail.com'], `🚀 Solicitud de Cambio de Plan — ${building.name}`, adminHtml, building.id, 'plan_change_admin');
      
      // Enviar confirmación al usuario
      const res = await sendEmailViaGmail([member?.email || building.admin_email], `✅ Solicitud de Cambio de Plan Recibida — ${building.name}`, userHtml, building.id, 'plan_change_user');
      
      return NextResponse.json({ success: res.success });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });

  } catch (error: any) {
    console.error('[API-EMAIL-ERROR]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
