import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
// Priorizamos SERVICE_ROLE_KEY que salta RLS. Si no está, usamos ANON_KEY.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID de medición requerido' }, { status: 400 });
  }

  // IMPORTANTE: auth: { persistSession: false } para entorno servidor
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    // 1. Obtener datos antes de borrar para la auditoría
    const { data: before } = await supabaseAdmin
      .from('measurements')
      .select('*')
      .eq('id', id)
      .single();

    // 2. Ejecutar borrado REAL con verificación de filas afectadas
    const { error, data: deletedRows } = await supabaseAdmin
      .from('measurements')
      .delete()
      .eq('id', id)
      .select(); // El select() aquí es clave para confirmar que se borró algo

    if (error) {
      console.error('[API_DELETE] ❌ Error en Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Si deletedRows está vacío, Supabase no borró nada (posiblemente por RLS)
    if (!deletedRows || deletedRows.length === 0) {
      console.error(`[API_DELETE] ⚠️ El registro ${id} NO fue eliminado de la DB. Revisa las políticas RLS.`);
      return NextResponse.json({ 
        error: 'No se pudo eliminar el registro. Verifique que la tabla measurements tenga habilitado el borrado en Supabase (Políticas RLS).' 
      }, { status: 403 });
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

    console.log(`[API_DELETE] ✅ Registro ${id} eliminado REALMENTE de la base de datos.`);
    return NextResponse.json({ success: true, message: 'Registro eliminado físicamente' });

  } catch (err: any) {
    console.error('[API_DELETE] ❌ Error inesperado:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
