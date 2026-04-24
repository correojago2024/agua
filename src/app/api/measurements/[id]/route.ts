import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID de medición requerido' }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Obtener datos antes de borrar para la auditoría
    const { data: before } = await supabaseAdmin
      .from('measurements')
      .select('*')
      .eq('id', id)
      .single();

    // 2. Ejecutar borrado
    const { error } = await supabaseAdmin
      .from('measurements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API_DELETE] ❌ Error en Supabase:', error.message);
      
      await logAudit({
        req: request,
        operation: 'DELETE',
        entity_type: 'measurement',
        entity_id: id,
        status: 'ERROR'
      });

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Registrar éxito en auditoría
    if (before) {
      await logAudit({
        req: request,
        building_id: before.building_id,
        user_email: before.email || 'admin@sistema.com',
        operation: 'DELETE',
        entity_type: 'measurement',
        entity_id: id,
        data_before: before,
        status: 'SUCCESS'
      });
    }

    console.log(`[API_DELETE] ✅ Registro ${id} eliminado exitosamente.`);
    return NextResponse.json({ success: true, message: 'Registro eliminado' });

  } catch (err: any) {
    console.error('[API_DELETE] ❌ Error inesperado:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
