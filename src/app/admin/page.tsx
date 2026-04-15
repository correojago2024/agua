/**
 * ARCHIVO: admin/page.tsx
 * VERSIÓN: 3.0
 * FECHA: 2026-04-11
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Building, Users, BarChart3, Settings, LogOut, Trash2, Edit,
  RefreshCw, Eye, ChevronDown, ChevronUp, Plus, Save, X, Wrench,
} from 'lucide-react';

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
}

interface Lead {
  id: string; nombre_apellido: string; nombre_edificio: string;
  rol: string; email: string; whatsapp?: string; mensaje: string;
  created_at: string; atendido?: boolean;
}

const STATUS_CYCLE: Record<string, string> = {
  'Prueba': 'Activo', 'Activo': 'Suspendido',
  'Suspendido': 'Prueba', 'Inactivo': 'Prueba',
};
const STATUS_COLORS: Record<string, string> = {
  'Activo': 'bg-green-500/20 text-green-400 border border-green-500/30',
  'Prueba': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Suspendido': 'bg-red-500/20 text-red-400 border border-red-500/30',
  'Inactivo': 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};
const GEAR_COLORS: Record<string, string> = {
  'Prueba': 'text-amber-400 hover:bg-amber-500/20',
  'Activo': 'text-green-400 hover:bg-green-500/20',
  'Suspendido': 'text-slate-400 hover:bg-slate-500/20',
  'Inactivo': 'text-blue-400 hover:bg-blue-500/20',
};
const GEAR_TITLES: Record<string, string> = {
  'Prueba': 'Cambiar a Activo', 'Activo': 'Cambiar a Suspendido',
  'Suspendido': 'Volver a Prueba', 'Inactivo': 'Reactivar como Prueba',
};

export default function AdminPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [activeView, setActiveView] = useState<'leads' | 'maintenance'>('leads');

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Add building
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [newBldg, setNewBldg] = useState({
    name: '', slug: '', admin_email: '', admin_name: '',
    tank_capacity_liters: '169000', password: '',
  });
  const [addBldgMsg, setAddBldgMsg] = useState('');

  // Maintenance
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintResult, setMaintResult] = useState<any>(null);

  useEffect(() => { loadBuildings(); }, []);

  const loadBuildings = async () => {
    setLoading(true);
    const { data: blds } = await supabase
      .from('buildings').select('*').order('created_at', { ascending: false });
    if (!blds) { setLoading(false); return; }
    const enriched = await Promise.all(blds.map(async (b) => {
      const [{ count: mCount }, { data: lastM }, { count: sCount }] = await Promise.all([
        supabase.from('measurements').select('*', { count: 'exact', head: true }).eq('building_id', b.id),
        supabase.from('measurements').select('recorded_at, percentage')
          .eq('building_id', b.id).order('recorded_at', { ascending: false }).limit(1),
        supabase.from('resident_subscriptions').select('*', { count: 'exact', head: true }).eq('building_id', b.id),
      ]);
      return {
        ...b,
        total_measurements: mCount ?? 0,
        total_subscribers: sCount ?? 0,
        last_measurement_at: lastM?.[0]?.recorded_at ?? null,
        last_measurement_pct: lastM?.[0]?.percentage ?? null,
      } as BuildingRow;
    }));
    setBuildings(enriched);
    setLoading(false);
  };

  const loadLeads = async () => {
    setLeadsLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads((data as Lead[]) || []);
    setLeadsLoading(false);
  };

  const markLeadAtendido = async (id: string, atendido: boolean) => {
    await supabase.from('leads').update({ atendido }).eq('id', id);
    loadLeads();
  };

  const addBuilding = async () => {
    if (!newBldg.name || !newBldg.admin_email || !newBldg.password) {
      setAddBldgMsg('❌ Nombre, email y clave son obligatorios'); return;
    }
    const slug = newBldg.slug ||
      newBldg.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('buildings').insert({
      name: newBldg.name, slug,
      admin_email: newBldg.admin_email,
      admin_name: newBldg.admin_name,
      tank_capacity_liters: parseInt(newBldg.tank_capacity_liters) || 169000,
      password: newBldg.password,
      status: 'Prueba',
    });
    if (error) { setAddBldgMsg('❌ ' + error.message); return; }
    setAddBldgMsg('✅ Edificio registrado en modo Prueba');
    setNewBldg({ name: '', slug: '', admin_email: '', admin_name: '', tank_capacity_liters: '169000', password: '' });
    setShowAddBuilding(false);
    setTimeout(() => setAddBldgMsg(''), 4000);
    loadBuildings();
  };

  const handleToggleStatus = async (building: BuildingRow) => {
    const newStatus = STATUS_CYCLE[building.status || 'Prueba'] ?? 'Activo';
    const { error } = await supabase.from('buildings').update({ status: newStatus }).eq('id', building.id);
    if (!error) {
      setActionMsg(`✅ "${building.name}" → ${newStatus}`);
      setTimeout(() => setActionMsg(''), 3000);
      loadBuildings();
    }
  };

  const handleDeactivate = async (building: BuildingRow) => {
    if (!window.confirm(`¿Desactivar "${building.name}"?\nPasará a INACTIVO. Los datos se conservan.`)) return;
    const { error } = await supabase.from('buildings').update({ status: 'Inactivo' }).eq('id', building.id);
    if (!error) {
      setActionMsg(`🚫 "${building.name}" marcado como Inactivo`);
      setTimeout(() => setActionMsg(''), 3000);
      loadBuildings();
    }
  };

  const runMaintenance = async () => {
    setMaintLoading(true);
    setMaintResult(null);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer aquasaas-cron-2026' },
      });
      const data = await res.json();
      setMaintResult(data);
    } catch (e: any) {
      setMaintResult({ error: e.message });
    } finally {
      setMaintLoading(false);
    }
  };

  const stats = {
    total: buildings.length,
    activos: buildings.filter(b => b.status === 'Activo').length,
    prueba: buildings.filter(b => b.status === 'Prueba').length,
    suspendidos: buildings.filter(b => b.status === 'Suspendido').length,
    inactivos: buildings.filter(b => b.status === 'Inactivo').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
              <p className="text-xs text-slate-400">Sistema AquaSaaS — Administrador Principal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadBuildings} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-700">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      {actionMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {actionMsg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {([
            { label: 'Total',       value: stats.total,       bg: 'bg-blue-500/20',  ic: 'text-blue-500',  Icon: Building },
            { label: 'Activos',     value: stats.activos,     bg: 'bg-green-500/20', ic: 'text-green-500', Icon: Users },
            { label: 'En Prueba',   value: stats.prueba,      bg: 'bg-amber-500/20', ic: 'text-amber-500', Icon: BarChart3 },
            { label: 'Suspendidos', value: stats.suspendidos, bg: 'bg-red-500/20',   ic: 'text-red-500',   Icon: Settings },
            { label: 'Inactivos',   value: stats.inactivos,   bg: 'bg-slate-500/20', ic: 'text-slate-400', Icon: Trash2 },
          ] as { label: string; value: number; bg: string; ic: string; Icon: React.ElementType }[]).map(({ label, value, bg, ic, Icon }) => (
            <div key={label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${ic}`} />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">{label}</p>
                  <p className="text-2xl font-bold text-white">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Status cycle legend */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mb-6 flex flex-wrap gap-3 items-center text-xs">
          <span className="text-slate-400 font-medium">⚙️ Ciclo:</span>
          {(['Prueba', 'Activo', 'Suspendido'] as string[]).map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[s]}`}>{s}</span>
              {i < arr.length - 1 && <span className="text-slate-600">→</span>}
            </span>
          ))}
          <span className="text-slate-600">→ (regresa a Prueba)</span>
          <span className="text-slate-500 ml-2">| 🗑️ =</span>
          <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS['Inactivo']}`}>Inactivo</span>
        </div>

        {/* Buildings table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Edificios Registrados</h2>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">{buildings.length} edificios</span>
              <button onClick={() => setShowAddBuilding(!showAddBuilding)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                <Plus className="w-4 h-4" /> Nuevo Edificio
              </button>
            </div>
          </div>

          {showAddBuilding && (
            <div className="px-6 py-4 bg-slate-700/30 border-b border-slate-700">
              <p className="text-slate-300 text-sm font-medium mb-3">Registrar Nuevo Edificio</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {([
                  { label: 'Nombre *', key: 'name', type: 'text', placeholder: 'Residencias Mi Edificio' },
                  { label: 'Slug (auto)', key: 'slug', type: 'text', placeholder: 'se genera del nombre' },
                  { label: 'Email Admin *', key: 'admin_email', type: 'email', placeholder: 'admin@edificio.com' },
                  { label: 'Nombre Admin', key: 'admin_name', type: 'text', placeholder: 'Juan Pérez' },
                  { label: 'Capacidad (L)', key: 'tank_capacity_liters', type: 'number', placeholder: '169000' },
                  { label: 'Clave *', key: 'password', type: 'password', placeholder: '••••••••' },
                ] as { label: string; key: keyof typeof newBldg; type: string; placeholder: string }[]).map(f => (
                  <div key={f.key}>
                    <label className="block text-slate-400 text-xs mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder}
                      value={newBldg[f.key]}
                      onChange={e => setNewBldg({ ...newBldg, [f.key]: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addBuilding} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm">
                  <Save className="w-4 h-4" /> Registrar Edificio
                </button>
                <button onClick={() => setShowAddBuilding(false)} className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm">
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
              {addBldgMsg && <p className="mt-2 text-sm text-slate-300">{addBldgMsg}</p>}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  {['Edificio', 'Admin Email', 'Capacidad', 'Mediciones', 'Suscriptores', 'Último registro', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {buildings.map((b) => {
                  const status = b.status || 'Prueba';
                  const isInactive = status === 'Inactivo';
                  return (
                    <>
                      <tr key={b.id} className={`hover:bg-slate-700/30 ${isInactive ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-4">
                          <p className="text-white font-medium">{b.name}</p>
                          <p className="text-slate-500 text-xs">{b.slug}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-400 text-xs">{b.admin_email}</td>
                        <td className="px-4 py-4 text-slate-400 whitespace-nowrap">{(b.tank_capacity_liters ?? 169000).toLocaleString()} L</td>
                        <td className="px-4 py-4 text-slate-300 font-medium text-center">{b.total_measurements ?? 0}</td>
                        <td className="px-4 py-4 text-slate-300 text-center">{b.total_subscribers ?? 0}</td>
                        <td className="px-4 py-4 text-xs whitespace-nowrap">
                          {b.last_measurement_at
                            ? <span className="text-slate-300">
                                {new Date(b.last_measurement_at).toLocaleDateString('es-ES')}
                                {b.last_measurement_pct != null && (
                                  <span className="text-blue-400 font-bold ml-1">({Math.round(b.last_measurement_pct)}%)</span>
                                )}
                              </span>
                            : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS['Prueba']}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                              className="p-1.5 text-slate-400 hover:bg-slate-600 rounded-lg">
                              {expandedId === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button onClick={() => router.push(`/edificio/${b.slug}`)}
                              className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded-lg">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => router.push(`/edificio-admin/${b.slug}`)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-500/20 rounded-lg">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleToggleStatus(b)}
                              className={`p-1.5 rounded-lg ${GEAR_COLORS[status] || GEAR_COLORS['Prueba']}`}
                              title={GEAR_TITLES[status]}>
                              <Settings className="w-4 h-4" />
                            </button>
                            {!isInactive && (
                              <button onClick={() => handleDeactivate(b)}
                                className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === b.id && (
                        <tr key={`${b.id}-exp`} className="bg-slate-700/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Registrado</p>
                                <p className="text-slate-300">{new Date(b.created_at).toLocaleDateString('es-ES')}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Portal Admin</p>
                                <p className="text-cyan-400 text-xs">/edificio-admin/{b.slug}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Notas</p>
                                <p className="text-slate-300 text-xs">{b.notes || '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs mb-1">Último pago</p>
                                <p className="text-slate-300">
                                  {b.last_payment_date ? new Date(b.last_payment_date).toLocaleDateString('es-ES') : '—'}
                                  {b.last_payment_amount != null && (
                                    <span className="text-green-400 ml-1">(${b.last_payment_amount.toLocaleString()})</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          {buildings.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay edificios registrados</p>
            </div>
          )}
        </div>

        {/* Sub-tabs: Leads / Maintenance */}
        <div className="flex gap-2 border-b border-slate-700 mb-6 mt-10">
          {([
            { id: 'leads' as const,       label: '📬 Leads / Contactos' },
            { id: 'maintenance' as const, label: '🔧 Mantenimiento' },
          ]).map(({ id, label }) => (
            <button key={id}
              onClick={() => { setActiveView(id); if (id === 'leads') loadLeads(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Leads tab */}
        {activeView === 'leads' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Leads del Formulario de Contacto</h2>
              <button onClick={loadLeads} className="p-2 text-slate-400 hover:text-white rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {leadsLoading ? (
              <div className="p-8 text-center text-slate-400">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      {['Fecha', 'Nombre', 'Edificio', 'Rol', 'Email', 'WhatsApp', 'Mensaje', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {leads.map(l => (
                      <tr key={l.id} className={`hover:bg-slate-700/20 ${l.atendido ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3 text-white text-xs">{l.nombre_apellido}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{l.nombre_edificio}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{l.rol}</td>
                        <td className="px-4 py-3 text-blue-400 text-xs">{l.email}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{l.whatsapp || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{l.mensaje}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => markLeadAtendido(l.id, !l.atendido)}
                            className={`px-2 py-1 rounded text-xs ${l.atendido ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {l.atendido ? '✅ Atendido' : '⏳ Pendiente'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No hay leads registrados aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Maintenance tab */}
        {activeView === 'maintenance' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-cyan-400" />
                  Mantenimiento Manual del Sistema
                </h2>
                <p className="text-slate-400 text-sm mt-1">Ejecuta la rutina ahora y recibe reporte por email.</p>
              </div>
              <button onClick={runMaintenance} disabled={maintLoading}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <RefreshCw className={`w-4 h-4 ${maintLoading ? 'animate-spin' : ''}`} />
                {maintLoading ? 'Ejecutando...' : 'Ejecutar Ahora'}
              </button>
            </div>
            {maintResult && (
              <div className="space-y-3">
                <div className="flex gap-3 flex-wrap">
                  {([
                    { label: '✅ OK', value: maintResult.summary?.ok, color: 'text-green-400' },
                    { label: '⚠️ Avisos', value: maintResult.summary?.warnings, color: 'text-amber-400' },
                    { label: '❌ Errores', value: maintResult.summary?.errors, color: 'text-red-400' },
                    { label: '⏱️ Duración', value: maintResult.elapsed_ms ? `${(maintResult.elapsed_ms / 1000).toFixed(1)}s` : '—', color: 'text-slate-300' },
                  ] as { label: string; value: string | number | undefined; color: string }[]).map(s => (
                    <div key={s.label} className="bg-slate-700 rounded-lg px-4 py-2 text-sm">
                      <span className="text-slate-400">{s.label}: </span>
                      <span className={`font-bold ${s.color}`}>{s.value ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {Array.isArray(maintResult.tasks) && maintResult.tasks.map((t: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded-lg ${t.status === 'ok' ? 'bg-green-500/10' : t.status === 'warning' ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                    <span>{t.status === 'ok' ? '✅' : t.status === 'warning' ? '⚠️' : '❌'}</span>
                    <div>
                      <p className="text-white font-medium">{t.task}</p>
                      <p className="text-slate-400 text-xs">{t.message}</p>
                    </div>
                  </div>
                ))}
                {maintResult.error && <p className="text-red-400 text-sm">{maintResult.error}</p>}
              </div>
            )}
            <div className="bg-slate-700/30 rounded-lg p-4 text-xs text-slate-400">
              <p>🕐 El cron automático se ejecuta los días <strong className="text-slate-300">1 y 15 de cada mes a las 3 AM</strong>.</p>
              <p className="mt-1">📧 Cada ejecución envía un reporte detallado a <strong className="text-slate-300">correojago@gmail.com</strong>.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
