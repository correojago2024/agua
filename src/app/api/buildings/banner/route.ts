import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
    const { building_id, banner_url, user_email } = body;

    console.log(`[VERCEL LOG] 🖼️ Intento de actualización de banner para edificio: ${building_id}`);
    console.log(`[VERCEL LOG] 🔗 Nueva URL: ${banner_url}`);

    if (!building_id || !banner_url) {
      return NextResponse.json({ error: 'Faltan parámetros: building_id y banner_url son obligatorios' }, { status: 400 });
    }

    // 1. Usar la banner_url enviada por el cliente (ya contiene la extensión correcta)
    //    en lugar de reconstruirla con una extensión hardcoded (.jpg)
    const publicUrl = banner_url;

    console.log(`[VERCEL LOG] 🛠️ URL Oficial recibida: ${publicUrl}`);

    // 2. Intentar actualizar en la base de datos
    const { data, error } = await supabase
      .from('buildings')
      .update({ banner_url: publicUrl })
      .eq('id', building_id)
      .select()
      .single();

    if (error) {
      console.error(`[VERCEL LOG] ❌ Error de Supabase: ${error.message}`);
      // ... (resto del logAudit igual)

      // Registrar error en la pestaña de Alertas/Auditoría
      await logAudit({
        req: request,
        building_id,
        user_email: user_email || 'admin@aquasaas.com',
        operation: 'ERROR',
        entity_type: 'banner',
        entity_id: building_id,
        data_after: { error: error.message, attempted_url: banner_url },
        status: 'ERROR'
      });

      return NextResponse.json({ error: `Error en BD: ${error.message}` }, { status: 500 });
    }

    console.log(`[VERCEL LOG] ✅ Banner actualizado con éxito en BD para ${building_id}`);

    // 2. Registrar éxito en la pestaña de Alertas/Auditoría
    await logAudit({
      req: request,
      building_id,
      user_email: user_email || 'admin@aquasaas.com',
      operation: 'UPDATE',
      entity_type: 'banner',
      entity_id: building_id,
      data_after: { banner_url },
      status: 'SUCCESS'
    });

    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error(`[VERCEL LOG] 💥 Error crítico en API de Banner: ${err.message}`);
    
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
