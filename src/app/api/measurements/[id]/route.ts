import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // Usamos el cliente con la clave disponible
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

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
    console.error('[API_DELETE] ❌ Error inesperado:', err.message);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
