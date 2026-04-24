import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function logAudit({
  req,
  building_id,
  user_email,
  operation,
  entity_type,
  entity_id,
  data_before = null,
  data_after = null,
  status = 'SUCCESS'
}: {
  req?: Request | NextRequest;
  building_id?: string;
  user_email?: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'SECURITY' | 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'MANUAL_SEND';
  entity_type: string;
  entity_id?: string;
  data_before?: any;
  data_after?: any;
  status?: 'SUCCESS' | 'ERROR';
}) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    let ip = 'unknown';
    let userAgent = 'unknown';

    if (req) {
      const forwarded = req.headers.get('x-forwarded-for');
      ip = forwarded ? forwarded.split(',')[0] : (req.headers.get('x-real-ip') || 'unknown');
      userAgent = req.headers.get('user-agent') || 'unknown';
    }

    const { error } = await supabaseAdmin.from('audit_logs').insert([{
      building_id,
      user_email: user_email || 'sistema@aquasaas.com',
      ip_address: ip,
      operation,
      entity_type,
      entity_id,
      data_before,
      data_after,
      status,
      user_agent: userAgent
    }]);

    if (error) console.error('[AUDIT_LOG_ERROR] ❌:', error.message);
  } catch (err) {
    console.error('[AUDIT_CRITICAL_FAIL] ❌:', err);
  }
}
