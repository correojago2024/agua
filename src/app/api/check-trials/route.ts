/**
 * ARCHIVO: route.ts
 * API de Verificación de Edificios con Período de Prueba Por Vencer
 * Se ejecuta automáticamente o manualmente para:
 * - Notificar 3 días antes del fin de prueba
 * - Suspender edificios cuando vence el período
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SYSTEM_ADMIN_EMAIL = 'correojago@gmail.com';

interface EmailNotification {
  buildingId: string;
  buildingName: string;
  adminEmail: string;
  trialEndDate: string;
  daysRemaining: number;
}

async function sendEmail(to: string, subject: string, body: string) {
  const transporter = require('nodemailer').createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'agua.sistema2024@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: '"AquaSaaS Sistema" <agua.sistema2024@gmail.com>',
    to,
    subject,
    html: body.replace(/\n/g, '<br>'),
  });
}

function getTemplate(templateName: string, building: any): { subject: string; body: string } {
  const templates: Record<string, { subject: string; body: string }> = {
    trial_3days: {
      subject: `⚠️ Tu período de prueba termina en 3 días - ${building.name}`,
      body: `Estimado administrador,

Tu período de prueba del sistema AquaSaaS para ${building.name} termina el ${building.trial_end_date}.

Te esperamos que hayas disfrutado del servicio. Recuerda que te quedan 3 días de uso gratuito para decidir si deseas continuar.

Para activar tu edificio y seguir usando el sistema, contacta al administrador: correojago@gmail.com

Saludos,
Equipo AquaSaaS`,
    },
    trial_expired: {
      subject: `📅 Período de prueba terminado - ${building.name}`,
      body: `Estimado administrador,

El período de prueba de tu edificio ${building.name} ha terminado.

El sistema ha sido pausado. Para renovar el servicio, contacta a: correojago@gmail.com

Saludos,
Equipo AquaSaaS`,
    },
    building_suspended: {
      subject: `🚫 Edificio pausado - ${building.name}`,
      body: `Estimado administrador,

Tu edificio ${building.name} ha sido pausado y no recibirá más datos de mediciones hasta tanto se solucione la situación de renovación/pago.

Para reactivar tu edificio, contacta al administrador: correojago@gmail.com

Saludos,
Equipo AquaSaaS`,
    },
  };
  return templates[templateName] || templates.trial_3days;
}

export async function POST(request: Request) {
  try {
    const { action, building_id, template_name } = await request.json();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ACCIÓN 1: Check automático de edificios por vencer
    if (action === 'check') {
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);

      // Buscar edificios en prueba que vencen en 3 días
      const { data: expiringBuildings, error: fetchError } = await supabase
        .from('buildings')
        .select('*')
        .eq('subscription_status', 'Prueba')
        .lte('trial_end_date', threeDaysFromNow.toISOString().split('T')[0])
        .gte('trial_end_date', today.toISOString().split('T')[0])
        .eq('notification_3days_sent', false);

      if (fetchError) throw fetchError;

      const notifications: EmailNotification[] = [];

      // Enviar email a cada edificio próximo a vencer
      for (const building of expiringBuildings || []) {
        try {
          const template = getTemplate('trial_3days', building);
          await sendEmail(building.admin_email, template.subject, template.body);
          
          // Notificar al admin del sistema
          await sendEmail(
            SYSTEM_ADMIN_EMAIL,
            `📊 Edificio próximo a vencer: ${building.name}`,
            `El edificio "${building.name}" tiene 3 días de prueba restantes.`
          );

          // Marcar como notificado
          await supabase
            .from('buildings')
            .update({ 
              notification_3days_sent: true,
              last_notification_sent: today.toISOString().split('T')[0]
            })
            .eq('id', building.id);

          notifications.push({
            buildingId: building.id,
            buildingName: building.name,
            adminEmail: building.admin_email,
            trialEndDate: building.trial_end_date,
            daysRemaining: 3,
          });
        } catch (emailError) {
          console.error('Error enviando email:', emailError);
        }
      }

      // Buscar edificios ya vencidos para suspender
      const { data: expiredBuildings, error: expiredError } = await supabase
        .from('buildings')
        .select('*')
        .eq('subscription_status', 'Prueba')
        .lt('trial_end_date', today.toISOString().split('T')[0]);

      if (expiredError) throw expiredError;

      // Suspender edificios vencidos
      for (const building of expiredBuildings || []) {
        await supabase
          .from('buildings')
          .update({ 
            subscription_status: 'Suspendido',
            status: 'Suspendido'
          })
          .eq('id', building.id);

        // Enviar email de edificio vencido
        try {
          const template = getTemplate('trial_expired', building);
          await sendEmail(building.admin_email, template.subject, template.body);
        } catch (emailError) {
          console.error('Error enviando email de vencimiento:', emailError);
        }
      }

      return NextResponse.json({
        success: true,
        expiringNotifications: notifications,
        expiredSuspended: expiredBuildings?.length || 0,
      });
    }

    // ACCIÓN 2: Enviar email manual a un edificio
    if (action === 'send' && building_id && template_name) {
      const { data: building, error: buildingError } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', building_id)
        .single();

      if (buildingError) throw buildingError;

      const template = getTemplate(template_name, building);
      await sendEmail(building.admin_email, template.subject, template.body);

      return NextResponse.json({
        success: true,
        message: `Email enviado a ${building.admin_email}`,
      });
    }

    // ACCIÓN 3: Cambiar estatus de edificio
    if (action === 'set_status' && building_id) {
      const { new_status } = await request.json();
      
      const { data: building, error: buildingError } = await supabase
        .from('buildings')
        .select('*')
        .eq('id', building_id)
        .single();

      if (buildingError) throw buildingError;

      // Actualizar status
      await supabase
        .from('buildings')
        .update({ 
          subscription_status: new_status,
          status: new_status === 'Suspendido' ? 'Suspendido' : 
                 new_status === 'Activo' ? 'Activo' : 'Prueba'
        })
        .eq('id', building_id);

      // Si se suspende, enviar email
      if (new_status === 'Suspendido') {
        const template = getTemplate('building_suspended', building);
        await sendEmail(building.admin_email, template.subject, template.body);
      }

      return NextResponse.json({
        success: true,
        message: `Estado actualizado a ${new_status}`,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: any) {
    console.error('Error en check-trials:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Obtener estatísticas de pruebas
  const today = new Date();
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);

  const { data: trialsExpiring } = await supabase
    .from('buildings')
    .select('id, name, trial_end_date, admin_email')
    .eq('subscription_status', 'Prueba')
    .lte('trial_end_date', threeDaysFromNow.toISOString().split('T')[0])
    .gte('trial_end_date', today.toISOString().split('T')[0]);

  const { data: trialsActive } = await supabase
    .from('buildings')
    .select('id, name, trial_end_date, subscription_status')
    .eq('subscription_status', 'Prueba');

  const { data: trialsSuspended } = await supabase
    .from('buildings')
    .select('id, name, subscription_status')
    .eq('subscription_status', 'Suspendido');

  return NextResponse.json({
    trialsExpiring: trialsExpiring || [],
    trialsActiveCount: trialsActive?.length || 0,
    trialsSuspendedCount: trialsSuspended?.length || 0,
  });
}