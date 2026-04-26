/**
 * ARCHIVO: admin/page.tsx (VERSIÓN RESTAURADA COMPLETA + GALERÍA DE EMAILS)
 * VERSIÓN: 4.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Building, Users, BarChart3, Settings, LogOut, Trash2, Edit,
  RefreshCw, Eye, ChevronDown, ChevronUp, Plus, Save, X, Wrench,
  Mail, Send, Clock, CreditCard, ShieldCheck, Search, Filter,
  FileJson, Shield, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { logAudit } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface BuildingRow {
  id: string; name: string; slug: string; admin_email: string;
  tank_capacity_liters: number; status: string; created_at: string;
  monthly_fee?: number; discount_pct?: number; payment_day?: number;
  last_payment_date?: string; last_payment_amount?: number; notes?: string;
  total_measurements?: number; total_subscribers?: number;
  last_measurement_at?: string; last_measurement_pct?: number;
  trial_start_date?: string; trial_end_date?: string;
  subscription_status?: string; custom_rate?: number;
  subscription_plan?: string;
  master_code?: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Activo': 'bg-green-500/20 text-green-400 border border-green-500/30',
  'Prueba': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Suspendido': 'bg-red-500/20 text-red-400 border border-red-500/30',
  'Inactivo': 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'buildings' | 'leads' | 'maintenance' | 'emails' | 'plans' | 'logs' | 'audit'>('buildings');
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState<string | null>(null);
  
  // Leads
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Mantenimiento
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintResult, setMaintResult] = useState<any>(null);

  // Auditoria
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({ building: '', operation: '' });

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setLoading(true);
    const { data: blds } = await supabase.from('buildings').select('*').order('created_at', { ascending: false });
    if (blds) {
      const enriched = await Promise.all(blds.map(async (b) => {
        const [{ count: mCount }] = await Promise.all([
          supabase.from('measurements').select('*', { count: 'exact', head: true }).eq('building_id', b.id),
        ]);
        return { ...b, total_measurements: mCount ?? 0 } as BuildingRow;
      }));
      setBuildings(enriched);
    }
    setLoading(false);
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLeadsLoading(false);
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    const { data } = await supabase.from('audit_logs').select('*, buildings(name)').order('created_at', { ascending: false }).limit(50);
    setAuditLogs(data || []);
    setAuditLoading(false);
  };

  const runMaintenance = async () => {
    setMaintLoading(true);
    try {
      const res = await fetch('/api/maintenance', { method: 'POST', headers: { 'Authorization': 'Bearer aquasaas-cron-2026' } });
      const data = await res.json();
      setMaintResult(data);
    } catch (e: any) { setMaintResult({ error: e.message }); }
    setMaintLoading(false);
  };

  const testEmailReal = async (templateName: string) => {
    setTestEmailLoading(templateName);
    setEmailMsg('');
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: ['correojago@gmail.com'], template: templateName })
      });
      const data = await res.json();
      if (data.success) setEmailMsg(`✅ Prueba enviada a correojago@gmail.com`);
      else setEmailMsg('❌ Error: ' + data.error);
    } catch (err: any) { setEmailMsg('❌ Error de red'); }
    setTestEmailLoading(null);
    setTimeout(() => setEmailMsg(''), 5000);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xl">Cargando datos maestros...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><Shield className="text-white w-6 h-6" /></div>
            <h1 className="text-xl font-bold text-white tracking-tight">SuperAdmin Portal</h1>
          </div>
          <nav className="flex flex-wrap justify-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
            {[
              { id: 'buildings', label: '🏢 Edificios' },
              { id: 'leads', label: '📬 Leads' },
              { id: 'emails', label: '✉️ Emails' },
              { id: 'maintenance', label: '🔧 Mantenimiento' },
              { id: 'plans', label: '💰 Planes' },
              { id: 'audit', label: '🛡️ Auditoría' },
            ].map(v => (
              <button key={v.id} onClick={() => {
                setActiveView(v.id as any);
                if (v.id === 'leads') loadLeads();
                if (v.id === 'audit') fetchAuditLogs();
              }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeView === v.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                {v.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {actionMsg && <div className="fixed top-20 right-6 z-[60] bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-in fade-in slide-in-from-right-4">{actionMsg}</div>}

      <main className="max-w-7xl mx-auto p-6 md:p-8">
        
        {/* VISTA EDIFICIOS */}
        {activeView === 'buildings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Gestión de Edificios</h2>
              <button onClick={loadBuildings} className="p-2 hover:bg-slate-800 rounded-full"><RefreshCw className="w-5 h-5" /></button>
            </div>
            <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/50 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Edificio</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4 text-center">Mediciones</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {buildings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-white font-bold">{b.name}</p>
                        <p className="text-slate-500 text-xs font-mono">{b.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{b.admin_email}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-400">{b.total_measurements}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[b.status] || STATUS_COLORS['Prueba']}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => router.push(`/edificio-admin/${b.slug}`)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"><Edit className="w-4 h-4 text-cyan-400" /></button>
                          <button onClick={() => router.push(`/edificio/${b.slug}`)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"><Eye className="w-4 h-4 text-purple-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA LEADS */}
        {activeView === 'leads' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Prospectos (Leads)</h2>
            <div className="grid gap-4">
              {leads.map(l => (
                <div key={l.id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">{l.nombre_apellido}</h3>
                    <p className="text-blue-400 text-sm">{l.email} | {l.whatsapp || 'Sin WhatsApp'}</p>
                    <p className="text-slate-500 text-xs mt-1">Edificio: {l.nombre_edificio} ({l.rol})</p>
                    <div className="mt-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-700 text-slate-300 italic text-sm italic">"{l.mensaje}"</div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-2">{format(new Date(l.created_at), 'dd/MM/yyyy')}</p>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${l.atendido ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {l.atendido ? 'ATENDIDO' : 'NUEVO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA EMAILS (NUEVA GALERÍA) */}
        {activeView === 'emails' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3"><Mail className="w-8 h-8 text-blue-400" /> Galería de Emails Reales</h2>
                <p className="text-slate-400 mt-2">Envía copias idénticas a <strong>correojago@gmail.com</strong> para validar el diseño de producción.</p>
              </div>
              {emailMsg && <div className="bg-blue-600/20 text-blue-400 px-6 py-2 rounded-full border border-blue-500/30 text-sm font-bold animate-bounce">{emailMsg}</div>}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { id: 'measurement_report', name: '📊 Reporte de Medición', desc: 'El diseño completo con gráficas, mapa de calor y tablas que ven los vecinos.', icon: '💧' },
                { id: 'welcome', name: '🎉 Bienvenida Admin', desc: 'Email profesional de bienvenida con accesos y primeros pasos.', icon: '🏢' },
                { id: 'anomaly_alert', name: '🚨 Alerta de Anomalía', desc: 'Aviso urgente de variación brusca de nivel (posible fuga).', icon: '⚠️' },
                { id: 'limit_90_storage', name: '📦 Cuota Almacenamiento 90%', desc: 'Advertencia de límite de base de datos próximo a alcanzarse.', icon: '🟠' },
                { id: 'limit_90_emails', name: '📧 Cuota Emails 90%', desc: 'Aviso preventivo de límite mensual de correos alcanzado.', icon: '🟡' },
              ].map(tpl => (
                <div key={tpl.id} className="bg-slate-800 border border-slate-700 rounded-[32px] p-8 hover:border-blue-500/50 transition-all flex flex-col shadow-xl">
                  <div className="text-5xl mb-6">{tpl.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{tpl.name}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">{tpl.desc}</p>
                  <button 
                    onClick={() => testEmailReal(tpl.id)}
                    disabled={testEmailLoading !== null}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {testEmailLoading === tpl.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Recibir Prueba Real
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA MANTENIMIENTO */}
        {activeView === 'maintenance' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Wrench className="w-6 h-6 text-cyan-400" /> Rutinas de Mantenimiento</h2>
            <div className="bg-slate-800 p-8 rounded-[32px] border border-slate-700">
               <p className="text-slate-400 mb-6">Ejecuta manualmente las tareas de limpieza, reinicio de cuotas y auditoría del sistema.</p>
               <button onClick={runMaintenance} disabled={maintLoading} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 disabled:opacity-50">
                 {maintLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                 Ejecutar Mantenimiento Completo
               </button>
            </div>
            {maintResult && (
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 overflow-auto max-h-96">
                <pre className="text-xs text-cyan-400 font-mono">{JSON.stringify(maintResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* VISTA AUDITORIA */}
        {activeView === 'audit' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-green-400" /> Bitácora de Auditoría</h2>
              <button onClick={fetchAuditLogs} className="p-2 hover:bg-slate-800 rounded-full"><RefreshCw className={`w-5 h-5 ${auditLoading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Operación</th>
                    <th className="px-6 py-4">Entidad</th>
                    <th className="px-6 py-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-700/20">
                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">{format(new Date(log.created_at), 'dd/MM HH:mm')}</td>
                      <td className="px-6 py-4 text-white font-medium">{log.user_email}</td>
                      <td className="px-6 py-4"><span className="px-2 py-0.5 bg-slate-900 rounded text-[9px] font-bold text-blue-400 border border-blue-500/20">{log.operation}</span></td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{log.entity_type}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-500">{log.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Icono extra necesario
function PlayCircle(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
  )
}
