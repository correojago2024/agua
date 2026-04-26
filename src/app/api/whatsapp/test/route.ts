/**
 * API: /api/whatsapp/test
 * Envía un mensaje de prueba para verificar la configuración.
 */

import { NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/server/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { building_id, phone, service } = body;

    if (!building_id || !phone) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const message = `🧪 *Prueba de Conexión aGuaSaaS*\n\n¡Felicidades! Tu configuración de WhatsApp para el servicio *${service}* funciona correctamente.\n\n📅 Fecha: ${new Date().toLocaleString()}`;

    const result = await sendWhatsApp(building_id, phone, message, service);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
