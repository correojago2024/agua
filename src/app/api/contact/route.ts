/**
 * ARCHIVO: route.ts (API de Envío de Emails de Contacto via Gmail)
 * VERSION: 3.0
 */

import { NextResponse } from 'next/server';
import { sendEmailViaGmail } from '@/lib/server/email';
import { sendWhatsApp } from '@/lib/server/whatsapp';

export async function POST(request: Request) {
  console.log('=== INICIO API /api/contact (v3.0) ===');
  
  try {
    const body = await request.json();
    const { nombre_apellido, nombre_edificio, rol, email, whatsapp, mensaje } = body;

    if (!nombre_apellido || !email || !mensaje) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const subject = 'Nuevo Mensaje de Contacto desde aGuaSaaS';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 20px;">🚀 Nuevo Contacto desde la Web</h1>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>Nombre:</strong> ${nombre_apellido}</p>
          <p><strong>Edificio:</strong> ${nombre_edificio || '—'}</p>
          <p><strong>Rol:</strong> ${rol || '—'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>WhatsApp:</strong> ${whatsapp || '—'}</p>
        </div>
        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p><strong>Mensaje:</strong></p>
          <p style="white-space: pre-wrap;">${mensaje}</p>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">aGuaSaaS CRM — 2026</p>
      </div>
    `;

    // 1. Envío de Email
    const result = await sendEmailViaGmail(
      ['correojago@gmail.com'],
      subject,
      htmlContent,
      null,
      'contact_form'
    );

    // 2. Envío de WhatsApp (Notificación a Admin)
    try {
      const waMessage = `🚀 *Nuevo Contacto aGuaSaaS*\n\n` +
        `👤 *Nombre:* ${nombre_apellido}\n` +
        `🏢 *Edificio:* ${nombre_edificio || '—'}\n` +
        `📧 *Email:* ${email}\n` +
        `📱 *WhatsApp:* ${whatsapp || '—'}\n\n` +
        `📝 *Mensaje:* ${mensaje.substring(0, 100)}${mensaje.length > 100 ? '...' : ''}`;
      
      // Reemplazar con el número del administrador del sistema
      // Usamos el servicio global (building_id = null)
      await sendWhatsApp('00000000-0000-0000-0000-000000000000', '573100000000', waMessage);
    } catch (waErr: any) {
      console.error('[WHATSAPP CONTACT ERROR]', waErr.message);
    }

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: result.error || 'Error enviando email' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('ERROR GENERAL en API /api/contact:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
