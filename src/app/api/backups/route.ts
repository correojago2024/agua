
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Necesaria para bypass RLS en respaldos

export async function POST(request: Request) {
  try {
    const { building_id, building_name, action, created_by } = await request.json();

    if (!building_id) return NextResponse.json({ error: 'building_id es requerido' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'generate') {
      // 1. Obtener todos los datos relevantes del edificio
      const [
        { data: building },
        { data: measurements },
        { data: settings },
        { data: ia_settings },
        { data: whatsapp_settings },
        { data: junta }
      ] = await Promise.all([
        supabase.from('buildings').select('*').eq('id', building_id).single(),
        supabase.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true }),
        supabase.from('building_settings').select('*').eq('building_id', building_id).single(),
        supabase.from('building_ia_settings').select('*').eq('building_id', building_id).single(),
        supabase.from('building_whatsapp_settings').select('*').eq('building_id', building_id).single(),
        supabase.from('resident_subscriptions').select('*').eq('building_id', building_id)
      ]);

      const backupData = {
        metadata: {
          building_id,
          building_name,
          generated_at: new Date().toISOString(),
          created_by,
          version: '1.0'
        },
        data: {
          building,
          measurements,
          settings,
          ia_settings,
          whatsapp_settings,
          junta
        }
      };

      // 2. Guardar en Storage
      const fileName = `${building_id}/${new Date().getTime()}_backup.json`;
      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(fileName, JSON.stringify(backupData), {
          contentType: 'application/json',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Registrar en bitácora
      await supabase.from('audit_logs').insert({
        building_id,
        user_email: created_by || 'SYSTEM',
        operation: 'BACKUP',
        entity_type: 'system',
        entity_id: building_id,
        data_after: { file: fileName }
      });

      return NextResponse.json({ success: true, fileName });
    }

    if (action === 'list') {
      const { data, error } = await supabase.storage
        .from('backups')
        .list(building_id, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' }
        });

      if (error) throw error;
      return NextResponse.json({ success: true, backups: data });
    }

    if (action === 'get_url') {
      const { fileName } = await request.json();
      const { data, error } = await supabase.storage
        .from('backups')
        .createSignedUrl(`${building_id}/${fileName}`, 60);

      if (error) throw error;
      return NextResponse.json({ success: true, signedUrl: data.signedUrl });
    }

    if (action === 'delete') {
      const { fileName } = await request.json();
      const { error } = await supabase.storage.from('backups').remove([`${building_id}/${fileName}`]);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: any) {
    console.error('Backup Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
