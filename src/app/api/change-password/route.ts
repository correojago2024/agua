/**
 * ARCHIVO: route.ts (API de Cambio de Contraseña)
 * VERSION: 1.0
 * PROYECTO: AquaSaaS
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  console.log('=== INICIO API /api/change-password ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const body = await request.json();
    const { email, buildingSlug, currentPassword, newPassword, action } = body;

    console.log('Acción:', action);
    console.log('Email:', email);

    // 1. Cambiar contraseña
    if (action === 'change') {
      if (!email || !buildingSlug || !currentPassword || !newPassword) {
        return NextResponse.json(
          { error: 'Datos incompletos para cambiar contraseña' },
          { status: 400 }
        );
      }

      // Find the building
      const { data: building, error: buildingError } = await supabaseClient
        .from('buildings')
        .select('*')
        .eq('slug', buildingSlug)
        .single();

      if (buildingError || !building) {
        return NextResponse.json(
          { error: 'Edificio no encontrado' },
          { status: 404 }
        );
      }

      // Find the member
      const { data: member, error: memberError } = await supabaseClient
        .from('resident_subscriptions')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('building_id', building.id)
        .single();

      if (memberError || !member) {
        return NextResponse.json(
          { error: 'Miembro no encontrado' },
          { status: 404 }
        );
      }

      // Verify current password (check either building password or member's stored password)
      const storedMemberPassword = member.password || '';
      const buildingPassword = building.password || building.admin_password || '';
      
      const passwordValid = (currentPassword === storedMemberPassword && storedMemberPassword) || 
                        (currentPassword === buildingPassword && buildingPassword);

      if (!passwordValid) {
        return NextResponse.json(
          { error: 'Contraseña actual incorrecta' },
          { status: 401 }
        );
      }

      // Update the password
      const { error: updateError } = await supabaseClient
        .from('resident_subscriptions')
        .update({ password: newPassword })
        .eq('id', member.id);

      if (updateError) {
        console.error('Error actualizando contraseña:', updateError);
        return NextResponse.json(
          { error: 'Error al actualizar contraseña' },
          { status: 500 }
        );
      }

      console.log('Contraseña actualizada exitosamente para:', email);
      console.log('=== FIN API /api/change-password (ÉXITO) ===');

      return NextResponse.json({
        success: true,
        message: 'Contraseña actualizada correctamente'
      });
    }

    // 2. Verificar si necesita cambiar contraseña (primer ingreso)
    if (action === 'check') {
      if (!email || !buildingSlug) {
        return NextResponse.json(
          { error: 'Datos incompletos' },
          { status: 400 }
        );
      }

      // Find the building
      const { data: building } = await supabaseClient
        .from('buildings')
        .select('*')
        .eq('slug', buildingSlug)
        .single();

      if (!building) {
        return NextResponse.json(
          { error: 'Edificio no encontrado' },
          { status: 404 }
        );
      }

      // Find the member
      const { data: member } = await supabaseClient
        .from('resident_subscriptions')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('building_id', building.id)
        .single();

      // If no member found or no password set, they need to use building password
      const needsPasswordChange = !member || !member.password;

      return NextResponse.json({
        needsPasswordChange,
        isAdmin: member?.is_admin || false,
        isJunta: member?.is_junta || false,
      });
    }

    return NextResponse.json(
      { error: 'Acción no reconocida' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('ERROR GENERAL en API /api/change-password:', error);
    console.error('Mensaje:', error.message);
    console.log('=== FIN API /api/change-password (ERROR) ===');

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}