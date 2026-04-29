
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 

export async function POST(request: Request) {
  try {
    // 1. Extraer los datos del body de una vez para evitar errores de "Body already read"
    const body = await request.json();
    const { building_id, building_name, action, created_by, fileName } = body;

    if (!building_id && action !== 'list') {
      return NextResponse.json({ error: 'building_id es requerido' }, { status: 400 });
    }

    // Usar el cliente administrativo para todas las operaciones de backup/restore
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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
        supabaseAdmin.from('buildings').select('*').eq('id', building_id).single(),
        supabaseAdmin.from('measurements').select('*').eq('building_id', building_id).order('recorded_at', { ascending: true }),
        supabaseAdmin.from('building_settings').select('*').eq('building_id', building_id).single(),
        supabaseAdmin.from('building_ia_settings').select('*').eq('building_id', building_id).single(),
        supabaseAdmin.from('building_whatsapp_settings').select('*').eq('building_id', building_id).single(),
        supabaseAdmin.from('resident_subscriptions').select('*').eq('building_id', building_id)
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
      const newFileName = `${building_id}/${new Date().getTime()}_backup.json`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('backups')
        .upload(newFileName, JSON.stringify(backupData), {
          contentType: 'application/json',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Registrar en bitácora
      await supabaseAdmin.from('audit_logs').insert({
        building_id,
        user_email: created_by || 'SYSTEM',
        operation: 'BACKUP',
        entity_type: 'system',
        entity_id: building_id,
        data_after: { file: newFileName },
        status: 'SUCCESS'
      });

      return NextResponse.json({ success: true, fileName: newFileName });
    }

    if (action === 'restore') {
      if (!fileName) return NextResponse.json({ error: 'fileName es requerido' }, { status: 400 });

      // 1. Descargar el archivo
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('backups')
        .download(`${building_id}/${fileName}`);

      if (downloadError) throw downloadError;

      const backupText = await fileData.text();
      const backup = JSON.parse(backupText);

      if (!backup.data) throw new Error('Formato de respaldo inválido');

      const { building, measurements, settings, ia_settings, whatsapp_settings, junta } = backup.data;

      // 2. Ejecutar Upserts (Restauración)
      const results = await Promise.allSettled([
        building ? supabaseAdmin.from('buildings').upsert(building) : Promise.resolve(),
        settings ? supabaseAdmin.from('building_settings').upsert(settings) : Promise.resolve(),
        ia_settings ? supabaseAdmin.from('building_ia_settings').upsert(ia_settings) : Promise.resolve(),
        whatsapp_settings ? supabaseAdmin.from('building_whatsapp_settings').upsert(whatsapp_settings) : Promise.resolve(),
        junta && junta.length > 0 ? supabaseAdmin.from('resident_subscriptions').upsert(junta) : Promise.resolve(),
        measurements && measurements.length > 0 ? supabaseAdmin.from('measurements').upsert(measurements) : Promise.resolve(),
      ]);

      const errors = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any)?.error));
      if (errors.length > 0) {
        console.error('Restore errors:', errors);
        return NextResponse.json({ error: 'Algunas tablas no pudieron restaurarse completamente', details: errors }, { status: 500 });
      }

      // 3. Registrar en bitácora
      await supabaseAdmin.from('audit_logs').insert({
        building_id,
        user_email: created_by || 'ADMIN',
        operation: 'RESTORE',
        entity_type: 'system',
        entity_id: building_id,
        data_after: { file: fileName },
        status: 'SUCCESS'
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'list') {
      const { data, error } = await supabaseAdmin.storage
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
      if (!fileName) return NextResponse.json({ error: 'fileName es requerido' }, { status: 400 });
      const { data, error } = await supabaseAdmin.storage
        .from('backups')
        .createSignedUrl(`${building_id}/${fileName}`, 60, {
          download: true
        });

      if (error) throw error;
      return NextResponse.json({ success: true, signedUrl: data.signedUrl });
    }

    if (action === 'delete') {
      if (!fileName) return NextResponse.json({ error: 'fileName es requerido' }, { status: 400 });
      const { error } = await supabaseAdmin.storage.from('backups').remove([`${building_id}/${fileName}`]);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error: any) {
    console.error('Backup Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
