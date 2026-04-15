/**
 * ARCHIVO: route.ts (API de Envío de Emails via Gmail + Supabase - VERSIÓN CLAVE PÚBLICA)
 * VERSION: 2.1
 * PROYECTO: AquaSaaS
 */

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Usamos las variables que YA TIENES configuradas en Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Creamos el cliente con la clave Anon (Pública)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

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

/**
 * Obtiene las credenciales de Gmail desde variables de entorno
 * (más seguro que almacenar en la base de datos)
 */
async function getGmailTransporter() {
  // Try environment variables first
  const emailUser = process.env.GMAIL_USER;
  const emailPassword = process.env.GMAIL_APP_PASSWORD;

  if (emailUser && emailPassword) {
    console.log('Usando credenciales de variables de entorno');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
    return transporter;
  }

  // Fallback: Try Supabase table (for backwards compatibility)
  console.log('Variables de entorno no encontradas, intentando Supabase...');
  
  try {
    let { data, error } = await supabaseClient
      .from('email_credentials')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      const { data: anyData } = await supabaseClient
        .from('email_credentials')
        .select('*')
        .limit(1)
        .single();
      data = anyData;
    }

    if (!data) {
      throw new Error('No se encontraron credenciales de email.');
    }

    console.log('Usuario de Gmail:', data.email_user);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: data.email_user,
        pass: data.email_password,
      },
    });
    return transporter;
  } catch (err) {
    console.error('Error configurando Gmail Transporter:', err);
    throw err;
  }
}

// Función para generar HTML de email de bienvenida (Mantenido original)
function generateWelcomeEmailHtml(building: any, siteUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a AquaSaaS</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center;">
      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path>
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 15px 0 5px; font-size: 28px;">Bienvenido a AquaSaaS!</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 0;">Sistema de Monitoreo de Agua</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1e293b; margin-top: 0;">Hola ${building.admin_name || 'Administrador'},</h2>
      <p style="color: #475569; line-height: 1.6;">
        Felicitaciones! Tu edificio <strong>${building.name}</strong> ha sido registrado exitosamente en AquaSaaS.
      </p>

      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 16px;">Datos de tu Edificio</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Nombre:</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: bold; font-size: 14px;">${building.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Direccion:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${building.address || 'No especificada'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Capacidad del Tanque:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${building.tank_capacity_liters?.toLocaleString() || '169000'} Litros</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Identificador:</td>
            <td style="padding: 8px 0; color: #2563eb; font-weight: bold; font-size: 14px;">${building.slug}</td>
          </tr>
        </table>
      </div>

      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 16px;">🔗 Tus Enlaces Importantes</h3>

        <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <p style="color: #1e40af; font-weight: bold; font-size: 14px; margin: 0 0 6px;">🏢 Tu Portal de Administrador</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Accede aquí para ver el dashboard, gestionar la junta de condominio y generar reportes:</p>
          <a href="${siteUrl}/edificio-admin/${building.slug}" style="color: #2563eb; font-size: 14px; word-break: break-all; font-weight: bold;">${siteUrl}/edificio-admin/${building.slug}</a>
          <p style="color: #64748b; font-size: 12px; margin: 6px 0 0;">💡 También puedes ingresar desde <a href="${siteUrl}" style="color: #2563eb;">${siteUrl}</a> con tu identificador y clave.</p>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <p style="color: #166534; font-weight: bold; font-size: 14px; margin: 0 0 6px;">📋 Formulario de Registro de Agua (para vecinos)</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Comparte este link con los residentes para que reporten el nivel del tanque:</p>
          <a href="${siteUrl}/edificio/${building.slug}" style="color: #16a34a; font-size: 14px; word-break: break-all;">${siteUrl}/edificio/${building.slug}</a>
        </div>

        <div style="background: #fef9c3; border-radius: 8px; padding: 12px; margin: 10px 0;">
          <p style="color: #854d0e; font-weight: bold; font-size: 13px; margin: 0 0 4px;">🔐 Tus credenciales de acceso</p>
          <p style="color: #854d0e; font-size: 13px; margin: 0;">Identificador: <strong>${building.slug}</strong> &nbsp;|&nbsp; Clave: la que estableciste al registrarte</p>
          <p style="color: #854d0e; font-size: 12px; margin: 6px 0 0;">Guarda estos datos en un lugar seguro. Si olvidas tu clave, usa la opción "¿Olvidó su contraseña?" en el login.</p>
        </div>
      </div>

      <div style="margin: 25px 0;">
        <h3 style="color: #1e293b; margin-top: 0;">¿Cómo Funciona Nuestro Sistema?</h3>

        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
          AquaSaaS tiene <strong>dos areas de uso</strong> para tu edificio:
        </p>

        <div style="background: #eff6ff; border-left: 3px solid #2563eb; padding: 15px; margin: 12px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #1e40af; font-weight: bold; font-size: 14px; margin: 0 0 8px;">💧 Formulario de Registro de Datos (para vecinos y usted mismo)</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 6px; line-height: 1.5;">
            Cualquier vecino puede ingresar a <a href="${siteUrl}/edificio/${building.slug}" style="color: #2563eb;">${siteUrl}/edificio/${building.slug}</a> sin necesidad de usuario ni contraseña, y registrar el nivel actual del tanque en litros o porcentaje.
          </p>
          <p style="color: #475569; font-size: 13px; margin: 0; line-height: 1.5;">
            Cada vez que se registra un dato, el sistema envía automáticamente un reporte con estadísticas e indicadores a todos los suscriptores del edificio. Los vecinos que incluyan su email al reportar recibirán hasta <strong>5 reportes</strong> por ciclo; para continuar recibiéndolos, simplemente deben reportar nuevamente.
          </p>
        </div>

        <div style="background: #f0fdf4; border-left: 3px solid #16a34a; padding: 15px; margin: 12px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #166534; font-weight: bold; font-size: 14px; margin: 0 0 8px;">⚙️ Portal de Administrador (exclusivo para usted como administrador)</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 6px; line-height: 1.5;">
            Como administrador del edificio, tiene acceso a un portal exclusivo en <a href="${siteUrl}/edificio-admin/${building.slug}" style="color: #16a34a; font-weight: bold;">${siteUrl}/edificio-admin/${building.slug}</a> donde podrá:
          </p>
          <ul style="color: #475569; font-size: 13px; margin: 6px 0 0; padding-left: 18px; line-height: 2;">
            <li>📊 Ver el <strong>dashboard</strong> con el nivel actual del tanque, tendencias y alertas</li>
            <li>👥 <strong>Agregar, modificar o quitar miembros</strong> de su Junta de Condominio, quienes recibirán copia de <em>todos</em> los reportes sin límite de emails</li>
            <li>📈 Consultar <strong>estadísticas detalladas</strong> del consumo e histórico de mediciones</li>
            <li>📋 <strong>Generar reportes</strong> filtrables por fecha y exportarlos en formato CSV</li>
          </ul>
          <p style="color: #475569; font-size: 13px; margin: 8px 0 0; line-height: 1.5;">
            Para acceder, ingrese a <a href="${siteUrl}" style="color: #16a34a;">${siteUrl}</a>, coloque su identificador <strong>${building.slug}</strong> y su clave, y seleccione el botón <strong>⚙️ Administrador</strong>.
          </p>
        </div>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-weight: bold; margin: 0 0 5px;">🔐 Importante — Guarda tus credenciales:</p>
        <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
          Identificador: <strong>${building.slug}</strong><br>
          Clave: la que estableciste al registrarte<br>
          <span style="font-size: 12px;">Si olvidas tu clave, puedes recuperarla desde la página principal usando la opción <em>"¿Olvidó su contraseña?"</em></span>
        </p>
      </div>

      <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">2026 AquaSaaS - Todos los derechos reservados</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function POST(request: Request) {
  console.log('=== INICIO API /api/send-email (GMAIL ANON KEY VERSION) ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const body = await request.json();
    const { type, building } = body;

    console.log('Tipo de email:', type);
    console.log('Datos del edificio:', JSON.stringify(building, null, 2));

    const siteUrl = getSiteUrl();
    
    // 1. Configurar Transporter de Gmail (leyendo credenciales de Supabase con Anon Key)
    let transporter;
    let gmailUser;
    try {
      transporter = await getGmailTransporter();
      // Obtenemos el email usuario para usarlo en el campo 'from'
      const { data: creds } = await supabaseClient
        .from('email_credentials')
        .select('email_user')
        .eq('id', 1)
        .single();
      
      gmailUser = creds?.email_user || 'noreply@aquasaas.com';
    } catch (err: any) {
      console.error('Error crítico obteniendo configuración de email:', err);
      return NextResponse.json(
        { error: 'Error de configuración del servidor de correo' },
        { status: 500 }
      );
    }

    // 2. Procesar según el tipo de email
    if (type === 'welcome') {
      console.log('Procesando email de bienvenida...');
      
      if (!building || !building.admin_email) {
        console.error('ERROR: Datos del edificio incompletos para email de bienvenida');
        return NextResponse.json(
          { error: 'Datos incompletos para enviar email de bienvenida' },
          { status: 400 }
        );
      }

      const htmlContent = generateWelcomeEmailHtml(building, siteUrl);

      console.log('Enviando email a:', building.admin_email);

      try {
        const info = await transporter.sendMail({
          from: `"AquaSaaS" <${gmailUser}>`,
          to: building.admin_email,
          subject: `Bienvenido a AquaSaaS - ${building.name}`,
          html: htmlContent
        });

        console.log('Email enviado exitosamente! ID:', info.messageId);
        console.log('=== FIN API /api/send-email (ÉXITO) ===');

        return NextResponse.json({
          success: true,
          emailId: info.messageId,
          message: 'Email de bienvenida enviado correctamente'
        });

      } catch (sendError: any) {
        console.error('ERROR de Gmail/Nodemailer:', sendError);
        return NextResponse.json(
          { 
            error: 'Error al enviar email',
            details: sendError.message
          },
          { status: 500 }
        );
      }
    }

    // ── TYPE: recover ──
    if (type === 'recover') {
      console.log('Procesando email de recuperación de clave...');

      if (!building || !building.admin_email || !building.password) {
        console.error('ERROR: Datos incompletos para email de recuperación');
        return NextResponse.json(
          { error: 'Datos incompletos para enviar email de recuperación' },
          { status: 400 }
        );
      }

      const recoverHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Clave - AquaSaaS</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; text-align: center;">
      <div style="display: inline-block; background: rgba(59,130,246,0.2); padding: 15px; border-radius: 12px; margin-bottom: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path>
          <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 0 0 5px; font-size: 24px;">AquaSaaS</h1>
      <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 14px;">Recuperación de Clave de Acceso</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Hola ${building.admin_name || 'Administrador'},</h2>
      <p style="color: #475569; line-height: 1.6;">
        Recibimos una solicitud de recuperación de clave para el edificio <strong>${building.name}</strong>. 
        A continuación encontrarás los datos de acceso de tu cuenta.
      </p>

      <div style="background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Tu Clave de Acceso</p>
        <p style="color: #1e40af; font-size: 28px; font-weight: bold; margin: 0; font-family: monospace; letter-spacing: 0.1em;">${building.password}</p>
      </div>

      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 15px;">Datos de tu Edificio</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 40%;">Edificio:</td>
            <td style="padding: 6px 0; color: #1e293b; font-weight: bold; font-size: 13px;">${building.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Identificador:</td>
            <td style="padding: 6px 0; color: #2563eb; font-weight: bold; font-size: 13px;">${building.slug}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Email registrado:</td>
            <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${building.admin_email}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${siteUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
          Ir al Portal de Ingreso
        </a>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="color: #92400e; font-weight: bold; margin: 0 0 4px; font-size: 14px;">⚠️ Recomendación de seguridad</p>
        <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">Si no solicitaste esta recuperación, alguien podría estar intentando acceder a tu cuenta. Considera cambiar tu clave desde la opción "Establecer Nueva Clave".</p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">2026 AquaSaaS - Todos los derechos reservados</p>
    </div>
  </div>
</body>
</html>`.trim();

      console.log('Enviando email de recuperación a:', building.admin_email);

      try {
        const info = await transporter.sendMail({
          from: `"AquaSaaS" <${gmailUser}>`,
          to: building.admin_email,
          subject: `Recuperación de Clave - ${building.name} | AquaSaaS`,
          html: recoverHtml
        });

        console.log('Email de recuperación enviado. ID:', info.messageId);
        console.log('=== FIN API /api/send-email (ÉXITO - recover) ===');
        return NextResponse.json({
          success: true,
          emailId: info.messageId,
          message: 'Email de recuperación de clave enviado correctamente'
        });

      } catch (sendError: any) {
        console.error('EXCEPCIÓN al enviar email de recuperación:', sendError);
        return NextResponse.json(
          { error: 'Excepción al enviar email de recuperación', details: sendError.message },
          { status: 500 }
        );
      }
    }

    // ── TYPE: junta-welcome ── (Nuevo miembro de junta)
    if (type === 'junta-welcome') {
      console.log('Procesando email de bienvenida para nuevo miembro de junta...');

      if (!building || !building.memberEmail) {
        console.error('ERROR: Datos incompletos para email de nuevo miembro');
        return NextResponse.json(
          { error: 'Datos incompletos para enviar email de nuevo miembro' },
          { status: 400 }
        );
      }

      const memberEmail = building.memberEmail;
      const memberName = building.memberName || 'Nuevo Miembro';
      const memberRole = building.memberRole || 'Vocal';
      const isAdmin = building.isAdmin === true;
      const temporaryPassword = '123456';

      const juntaWelcomeHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a la Junta - AquaSaaS</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #7c3aed, #5b21b6); padding: 30px; text-align: center;">
      <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 15px; border-radius: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 15px 0 5px; font-size: 26px;">Bienvenido a la Junta!</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 0;">Has sido agregado como ${isAdmin ? 'Administrador' : 'Miembro'} de la Junta de Condominio</p>
    </div>

    <div style="padding: 30px;">
      <h2 style="color: #1e293b; margin-top: 0;">Hola ${memberName},</h2>
      <p style="color: #475569; line-height: 1.6;">
        Has sido agregado${isAdmin ? ' como <strong>Administrador</strong>' : ''} de la Junta de Condominio del edificio <strong>${building.name}</strong> en el sistema AquaSaaS.
      </p>

      <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 16px;">Tu Cuenta</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Edificio:</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: bold; font-size: 14px;">${building.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tu Email:</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${memberEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tu Cargo:</td>
            <td style="padding: 8px 0; color: #7c3aed; font-weight: bold; font-size: 14px;">${memberRole}${isAdmin ? ' (Administrador)' : ''}</td>
          </tr>
        </table>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; font-weight: bold; margin: 0 0 8px; font-size: 14px;">🔐 Credenciales de Acceso</p>
        <p style="color: #92400e; font-size: 13px; margin: 0 0 6px;">Tu contraseña temporal es: <strong style="font-family: monospace; font-size: 16px;">${temporaryPassword}</strong></p>
        <p style="color: #92400e; font-size: 12px; margin: 0; line-height: 1.5;">Por seguridad, al primer ingreso podrás crear tu propia contraseña personalizada.</p>
      </div>

      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1e293b; margin-top: 0; font-size: 16px;">🔗 Tus Enlaces Importantes</h3>
        
        <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <p style="color: #1e40af; font-weight: bold; font-size: 14px; margin: 0 0 6px;">🏢 Portal de Administrador</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Accede aquí para gestionar la junta y ver reportes:</p>
          <a href="${siteUrl}/edificio-admin/${building.slug}" style="color: #2563eb; font-size: 14px; word-break: break-all; font-weight: bold;">${siteUrl}/edificio-admin/${building.slug}</a>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <p style="color: #166534; font-weight: bold; font-size: 14px; margin: 0 0 6px;">📋 Formulario de Registro de Agua</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Para reportar el nivel del tanque:</p>
          <a href="${siteUrl}/edificio/${building.slug}" style="color: #16a34a; font-size: 14px; word-break: break-all;">${siteUrl}/edificio/${building.slug}</a>
        </div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 10px 0;">
          <p style="color: #475569; font-weight: bold; font-size: 14px; margin: 0 0 6px;">🏠 Página Principal del Sistema</p>
          <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">Para recuperar tu contraseña si la olvidas:</p>
          <a href="${siteUrl}" style="color: #64748b; font-size: 14px; word-break: break-all;">${siteUrl}</a>
        </div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${siteUrl}/edificio-admin/${building.slug}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
          Ingresar al Portal
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">2026 AquaSaaS - Todos los derechos reservados</p>
    </div>
  </div>
</body>
</html>`.trim();

      try {
        const info = await transporter.sendMail({
          from: `"AquaSaaS - ${building.name}" <${gmailUser}>`,
          to: memberEmail,
          subject: `Bienvenido a la Junta de ${building.name} - AquaSaaS`,
          html: juntaWelcomeHtml
        });

        console.log('Email de bienvenida de junta enviado. ID:', info.messageId);
        console.log('=== FIN API /api/send-email (ÉXITO - junta-welcome) ===');
        return NextResponse.json({
          success: true,
          emailId: info.messageId,
          message: 'Email de bienvenida para nuevo miembro enviado correctamente'
        });

      } catch (sendError: any) {
        console.error('EXCEPCIÓN al enviar email de junta:', sendError);
        return NextResponse.json(
          { error: 'Excepción al enviar email de nuevo miembro', details: sendError.message },
          { status: 500 }
        );
      }
    }

    // Tipo de email no reconocido
    console.error('ERROR: Tipo de email no reconocido:', type);
    return NextResponse.json(
      { error: 'Tipo de email no soportado' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('ERROR GENERAL en API /api/send-email:', error);
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    console.log('=== FIN API /api/send-email (ERROR) ===');

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
