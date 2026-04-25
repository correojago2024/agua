/**
 * ARCHIVO: route.ts (API de Envío de Emails via Gmail + Supabase - VERSIÓN CLAVE PÚBLICA)
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';

/**
 * Obtiene la URL base del sitio
 */
const getSiteUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
};

// Función para generar HTML de email de bienvenida (Responsivo 600px)
function generateWelcomeEmailHtml(building: any, siteUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width: 600px; margin: 0 auto; padding: 15px; background-color: #f8fafc; color: #1e293b;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 25px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; line-height: 1.2;">¡Bienvenido a AquaSaaS!</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Gestión Inteligente de Agua</p>
    </div>

    <div style="padding: 20px;">
      <p style="margin-top: 0; font-size: 15px;">Hola <strong>${building.admin_name || 'Administrador'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6;">Es un placer darte la bienvenida. Tu edificio <strong>${building.name}</strong> ha sido registrado exitosamente y ahora eres el <strong>Administrador Principal</strong> del sistema para tu comunidad.</p>

      <div style="background: #f1f5f9; border-radius: 12px; padding: 15px; margin: 20px 0; font-size: 13px;">
        <p style="margin: 0 0 5px;"><strong>Tu Identificador:</strong> ${building.slug}</p>
        <p style="margin: 0;"><strong>Capacidad del Tanque:</strong> ${building.tank_capacity_liters?.toLocaleString() || '169000'} Litros</p>
      </div>

      <h3 style="font-size: 16px; color: #2563eb; border-bottom: 2px solid #eff6ff; pb: 5px;">🚀 Próximos pasos recomendados:</h3>
      
      <div style="margin: 15px 0;">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">1. Invita a tu Junta de Condominio</p>
        <p style="font-size: 13px; line-height: 1.5; color: #475569;">
          En tu portal, dirígete a la pestaña <strong>"Mi Junta"</strong>. Allí podrás agregar los correos de los demás miembros. 
          Puedes registrarlos como <strong>Administradores</strong> (tienen control total) o como <strong>Miembros</strong> (solo visualización), para que todos estén al tanto del nivel del tanque en tiempo real.
        </p>
      </div>

      <div style="margin: 15px 0;">
        <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">2. Empoderar a los Vecinos</p>
        <p style="font-size: 13px; line-height: 1.5; color: #475569;">
          El éxito de AquaSaaS se basa en la colaboración. Publica el <strong>Link de Reporte para Vecinos</strong> en el chat de WhatsApp de tu edificio o en carteleras físicas. 
          Cualquier persona con el link puede registrar un dato; esto alimentará tus estadísticas e informes históricos, permitiéndoles tomar mejores decisiones sobre el suministro de agua.
        </p>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
        <p style="color: #1e40af; font-weight: bold; font-size: 14px; margin: 0 0 8px;">🏢 Tu Panel Administrativo</p>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 10px;">Accede aquí para ver gráficos avanzados, bitácora de eventos y gestionar a la junta:</p>
        <a href="${siteUrl}/edificio-admin/${building.slug}" style="color: #2563eb; font-size: 13px; font-weight: bold; word-break: break-all;">${siteUrl}/edificio-admin/${building.slug}</a>
      </div>

      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <p style="color: #166534; font-weight: bold; font-size: 14px; margin: 0 0 8px;">💧 Link Público de Reporte (Para los vecinos)</p>
        <p style="font-size: 12px; color: #64748b; margin-bottom: 10px;">Comparte este link para que los vecinos ayuden a alimentar la data:</p>
        <a href="${siteUrl}/edificio/${building.slug}" style="color: #16a34a; font-size: 13px; font-weight: bold; word-break: break-all;">${siteUrl}/edificio/${building.slug}</a>
      </div>

      <p style="font-size: 13px; line-height: 1.6; background: #fffbeb; padding: 10px; border-radius: 8px; border: 1px solid #fef3c7;">
        <strong>💡 Tip:</strong> Cuantos más datos registren los vecinos, más precisas serán las proyecciones de consumo y las alertas de anomalías.
      </p>

      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">2026 AquaSaaS - Control Hídrico Profesional</p>
    </div>
  </div>
</body>
</html>`.trim();
}

// Función para generar HTML de email de bienvenida para miembros de junta
function generateJuntaWelcomeEmailHtml(member: any, building: any, siteUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width: 600px; margin: 0 auto; padding: 15px; background-color: #f8fafc; color: #1e293b;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 25px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; line-height: 1.2;">¡Bienvenido a la Junta de Condominio!</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Acceso al Panel de Control AquaSaaS</p>
    </div>

    <div style="padding: 20px;">
      <p style="margin-top: 0; font-size: 15px;">Hola <strong>${member.name || 'Miembro de Junta'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6;">Has sido agregado como miembro de la junta para el edificio <strong>${building.name}</strong> en el sistema de monitoreo hídrico AquaSaaS.</p>

      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; border: 1px dashed #cbd5e1;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Tu Clave Temporal de Acceso:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 0; color: #1e293b;">123456</p>
      </div>

      <div style="background: #fdf2f8; border-left: 4px solid #db2777; padding: 15px; margin: 20px 0;">
        <p style="color: #9d174d; font-weight: bold; font-size: 14px; margin: 0 0 8px;">🚀 Pasos para empezar:</p>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #1e293b;">
          <li>Haz clic en el enlace del portal abajo.</li>
          <li>Ingresa con tu correo: <strong>${member.email}</strong> y la clave temporal.</li>
          <li>El sistema te pedirá crear tu propia contraseña de usuario por seguridad.</li>
          <li>¡Listo! Podrás ver los gráficos, reportes y configurar alertas.</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${siteUrl}/edificio-admin/${building.slug}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Acceder al Portal Administrativo</a>
      </div>

      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">2026 AquaSaaS - Tecnología para su Comunidad</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, building, member } = body;
    const siteUrl = getSiteUrl();

    if (type === 'welcome') {
      const htmlContent = generateWelcomeEmailHtml(building, siteUrl);
      const result = await sendEmailViaGmail([building.admin_email], `Bienvenido a AquaSaaS - ${building.name}`, htmlContent, building.id || null, 'welcome_email');
      return NextResponse.json({ success: result.success });
    }

    if (type === 'superadmin_notification') {
      const superAdminHtml = `
        <div style="font-family:sans-serif; max-width:600px; padding:20px; border:2px solid #3b82f6; border-radius:16px; background:#f8fafc;">
          <h2 style="color:#1d4ed8; margin-top:0;">🚀 ¡NUEVO REGISTRO RECIBIDO!</h2>
          <p style="font-size:16px;">Se ha registrado un nuevo edificio en el sistema AquaSaaS.</p>
          
          <div style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; margin:20px 0;">
            <p style="margin:5px 0;"><strong>🏢 Edificio:</strong> ${building.name}</p>
            <p style="margin:5px 0;"><strong>🔑 Slug/ID:</strong> ${building.slug}</p>
            <p style="margin:5px 0;"><strong>👤 Admin:</strong> ${building.admin_name}</p>
            <p style="margin:5px 0;"><strong>📧 Email:</strong> ${building.admin_email}</p>
            <p style="margin:5px 0;"><strong>📞 Teléfono:</strong> ${building.admin_phone || 'N/A'}</p>
            <p style="margin:5px 0;"><strong>🚰 Capacidad:</strong> ${building.tank_capacity_liters.toLocaleString()} L</p>
          </div>
          
          <p style="font-size:12px; color:#64748b;">Este es un aviso automático enviado a correojago@gmail.com</p>
        </div>
      `;
      const result = await sendEmailViaGmail(['correojago@gmail.com'], `NUEVO REGISTRO: ${building.name}`, superAdminHtml, building.id || null, 'superadmin_alert');
      return NextResponse.json({ success: result.success });
    }

    if (type === 'junta_welcome') {
      const htmlContent = generateJuntaWelcomeEmailHtml(member, building, siteUrl);
      const result = await sendEmailViaGmail([member.email], `Acceso al Panel Administrativo - ${building.name}`, htmlContent, building.id || null, 'junta_welcome_email');
      return NextResponse.json({ success: result.success });
    }

    if (type === 'recover') {
       const recoverHtml = `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:12px;">
         <h2 style="color:#1e40af;">Recuperación de Clave</h2>
         <p>Edificio: <strong>${building.name}</strong></p>
         <div style="background:#f1f5f9; padding:20px; border-radius:8px; text-align:center; margin:20px 0;">
           <p style="color:#64748b; font-size:12px; margin:0;">SU CLAVE DE ACCESO:</p>
           <p style="font-size:24px; font-weight:bold; letter-spacing:2px; margin:10px 0;">${building.password}</p>
         </div>
         <p style="font-size:12px; color:#94a3b8;">Si no solicitó este cambio, ignore este mensaje.</p>
       </div>`;
       const result = await sendEmailViaGmail([building.admin_email], `Clave de Acceso - ${building.name}`, recoverHtml, building.id || null, 'recover_email');
       return NextResponse.json({ success: result.success });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
