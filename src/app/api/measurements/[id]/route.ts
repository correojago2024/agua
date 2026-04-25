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
  // En Next.js 15, params es una promesa
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'ID de medición requerido' }, { status: 400 });
  }

  // IMPORTANTE: auth: { persistSession: false } para entorno servidor
  // Intentamos usar SERVICE_ROLE para saltar RLS, si no, ANON_KEY fallará si no hay política de DELETE
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log(`[API_DELETE] 🗑️ Intentando eliminar medición: ${id}`);

    // 1. Obtener datos antes de borrar para la auditoría y verificar existencia
    const { data: before, error: fetchError } = await supabaseAdmin
      .from('measurements')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !before) {
      console.error(`[API_DELETE] ❌ Registro no encontrado o error:`, fetchError?.message);
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // 2. Ejecutar borrado REAL
    // Si supabaseKey es la ANON_KEY, esto fallará con 403 si no hay política de DELETE habilitada
    const { error: deleteError, data: deletedData } = await supabaseAdmin
      .from('measurements')
      .delete()
      .eq('id', id)
      .select();

    if (deleteError) {
      console.error('[API_DELETE] ❌ Error de Supabase al borrar:', deleteError.message);
      return NextResponse.json({ 
        error: 'Error de base de datos: ' + deleteError.message,
        details: 'Verifique si la tabla measurements permite DELETE mediante RLS.'
      }, { status: 500 });
    }

    // Verificar si realmente se borró (si RLS bloquea, deletedData vendrá vacío pero sin error)
    if (!deletedData || deletedData.length === 0) {
      console.error(`[API_DELETE] ⚠️ No se borró ninguna fila. Probablemente bloqueado por RLS.`);
      return NextResponse.json({ 
        error: 'No se pudo eliminar el registro.',
        details: 'El servidor no tiene permisos suficientes para borrar esta fila. Configure una política DELETE en Supabase.'
      }, { status: 403 });
    }

    // 3. Registrar éxito en auditoría
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

    console.log(`[API_DELETE] ✅ Registro ${id} eliminado con éxito.`);
    return NextResponse.json({ success: true, message: 'Registro eliminado correctamente' });

  } catch (err: any) {
    console.error('[API_DELETE] ❌ Error inesperado:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor: ' + err.message }, { status: 500 });
  }
}
