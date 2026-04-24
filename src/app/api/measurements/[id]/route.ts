import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Usamos la Service Role Key para tener permisos de borrado

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'ID de medición requerido' }, { status: 400 });
  }

  // Creamos un cliente con privilegios de administrador para asegurar el borrado
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { error } = await supabaseAdmin
      .from('measurements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API_DELETE] ❌ Error en Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API_DELETE] ✅ Registro ${id} eliminado exitosamente.`);
    return NextResponse.json({ success: true, message: 'Registro eliminado' });

  } catch (err: any) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
