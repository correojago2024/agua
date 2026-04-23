/**
 * ARCHIVO: edificio-admin/[slug]/page.tsx
 * VERSIÓN: 1.4
 * FECHA: 2026-04-08 04:26 pm
 * MODIFICACIÓN:
 *   Muestra datos DEMO de Torrebela
 * - Agregados gráficos de inteligencia hídrica en el dashboard.
 * - Corregidos errores de tipos e importación durante la compilación.
 * 
 * Portal de administración para la Junta de Condominio de cada edificio.
 * Acceso con contraseña simple almacenada en buildings.admin_password
 * (o cualquier campo que configures en Supabase).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Droplets, Users, BarChart3, Download, Plus, Trash2, Edit2, Save,
  X, RefreshCw, AlertTriangle, CheckCircle2, Mail, Calendar,
  TrendingDown, TrendingUp, Activity, FileText, Settings, LogOut,
  ChevronDown, ChevronUp, Image, Wrench, Upload
} from 'lucide-react';

import { getAllImprovedCharts } from '@/lib/charts';
import { 
  CombinedTrendChart, 
  FlowComparisonChart, 
  TankLevelGauge, 
  ThresholdsChart, 
  StatusIndicator 
} from '@/components/DashboardCharts';

import { Measurement } from '@/lib/calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';
const supabase = createClient(supabaseUrl, supabaseKey);

type Tab = 'dashboard' | 'junta' | 'reportes' | 'mediciones' | 'configuracion';

// Helper: lee variation_lts o variacion_lts (ambos nombres posibles en BD)
const getVariation = (m: Measurement): number =>
  m.variation_lts ?? m.variacion_lts ?? 0;

// Enmascara email: jogarot@gmail.com → jo***ot@gmail.com
const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 4) return local[0] + '***@' + domain;
  return local.slice(0, 2) + '***' + local.slice(-2) + '@' + domain;
};

interface JuntaMember {
  id: string;
  building_id: string;
  email: string;
  name?: string;
  role?: string;
  emails_remaining?: number;
  is_junta?: boolean;
  is_admin?: boolean;
  password?: string;
}

export default function EdificioAdminPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const [building, setBuilding] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [authed, setAuthed]     = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [currentUser, setCurrentUser] = useState<JuntaMember | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeMsg, setPasswordChangeMsg] = useState('');
  const [tab, setTab] = useState<Tab>('dashboard');

  // Data
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [juntaMembers, setJuntaMembers] = useState<JuntaMember[]>([]);
  const [allSubscribers, setAllSubscribers] = useState<JuntaMember[]>([]);
  const [chartUrls, setChartUrls] = useState<any>(null);
  const [chartsLoading, setChartsLoading] = useState(true);


  // Report filters
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo]     = useState('');
  const [reportType, setReportType] = useState('full');

  // Mediciones editing
  const [editingMeasurement, setEditingMeasurement] = useState<any>(null);
  const [editLiters, setEditLiters] = useState('');
  const [editPct, setEditPct]       = useState('');
  const [measMsg, setMeasMsg]       = useState('');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  // Configuración del edificio
  const [editingConfig, setEditingConfig] = useState(false);
  const [cfgName, setCfgName]       = useState('');
  const [cfgCapacity, setCfgCapacity] = useState('');
  const [cfgAdminEmail, setCfgAdminEmail] = useState('');
  const [cfgThreshold, setCfgThreshold]   = useState('30');
  const [cfgMsg, setCfgMsg]         = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerMsg, setBannerMsg]   = useState('');

  // Junta editing
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName]   = useState('');
  const [newMemberRole, setNewMemberRole]   = useState('Vocal');
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [editingMember, setEditingMember]   = useState<JuntaMember | null>(null);
  const [memberMsg, setMemberMsg]           = useState('');

  // Demo mode — computed from building id
  const DEMO_BUILDING_ID = "935bdd40-2ba7-4abe-8707-19413cd14c07";
  const isDemo = building?.id === DEMO_BUILDING_ID;

  // Helper to block writes in demo mode
  const demoBlock = (msg?: string): boolean => {
    if (!isDemo) return false;
    setMeasMsg(msg || '⚠️ Modo Demo: los cambios no se guardan en la base de datos.');
    setTimeout(() => setMeasMsg(''), 4000);
    return true;
  };

  // Helper to mask email for demo mode
  const maskEmail = (email: string): string => {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : local;
    return `${maskedLocal}@${domain}`;
  };

  // ── Load building ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const slugParam = slug as string;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam);
      const { data } = isUUID
        ? await supabase.from('buildings').select('*').eq('id', slugParam).single()
        : await supabase.from('buildings').select('*').eq('slug', slugParam).single();
      setBuilding(data);
      // Si viene con ?authed=1 desde el login de page.tsx, ya está autenticado
      if (searchParams.get('authed') === '1') {
        setAuthed(true);
      }
      setLoading(false);
    })();
  }, [slug, searchParams]);

  const loadData = useCallback(async () => {
    if (!building) return;
    setChartsLoading(true);

    const DEMO_BUILDING_ID = "935bdd40-2ba7-4abe-8707-19413cd14c07";
    const isDemo = building.id === DEMO_BUILDING_ID;
    const REAL_BUILDING_ID = "c8d8c62e-cb04-439e-9905-b5ad88bb86c9";
    
    let measurementsQueryBuildingId = building.id;
    // Subscriptions should always be for the building currently logged into,
    // even if it's the demo building.
    const subscriptionsQueryBuildingId = building.id; 

    if (building.id === DEMO_BUILDING_ID) {
      measurementsQueryBuildingId = REAL_BUILDING_ID; // Redirect measurements for demo
    }

    const [{ data: ms }, { data: members }] = await Promise.all([
      supabase.from('measurements').select('*').eq('building_id', measurementsQueryBuildingId)
        .order('recorded_at', { ascending: false }).limit(200),
      supabase.from('building_members').select('*').eq('building_id', subscriptionsQueryBuildingId),
    ]);
    
    const sortedMs = (ms || []).slice().reverse();
    setMeasurements(sortedMs);

    const allMembers = members || [];
    setAllSubscribers(allMembers);
    // All building_members are considered junta members for now (except master user)
    const filteredMembers = allMembers.filter((m: any) => m.email !== 'correojago@gmail.com');
    setJuntaMembers(filteredMembers);
  }, [building]);

  useEffect(() => { if (authed && building) loadData(); }, [authed, building, loadData]);

  // Hook para generar gráficos cuando las mediciones cambian
  useEffect(() => {
    if (measurements.length > 0 && building) {
      try {
        const urls = getAllImprovedCharts(measurements, building.tank_capacity_liters);
        setChartUrls(urls);
      } catch (error) {
        console.error("Error generando los gráficos:", error);
        setChartUrls(null);
      } finally {
        setChartsLoading(false);
      }
    } else {
      setChartsLoading(false);
      setChartUrls(null);
    }
  }, [measurements, building]);


  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    // Verificar primero si el edificio está suspendido o inactivo
    if (building?.status === 'Suspendido') {
      setAuthError('⛔ Esta cuenta está SUSPENDIDA. No es posible acceder al portal. Contacte al administrador del sistema para reactivarla.');
      return;
    }
    if (building?.status === 'Inactivo') {
      setAuthError('⛔ Esta cuenta está INACTIVA. Contacte al administrador del sistema.');
      return;
    }

    const inputEmail = loginEmail.trim().toLowerCase();
    const inputPassword = password;
    const buildingPassword = building?.password || building?.admin_password || '';
    const TEMP_PASSWORD = '123456';

    // Always fetch fresh members from DB for login verification
    const { data: members } = await supabase
      .from('building_members')
      .select('*')
      .eq('building_id', building.id);
    
    if (members) {
      setAllSubscribers(members);
      // Filter out master user from junta members
      const filteredMembers = members.filter((m: any) => m.email !== 'correojago@gmail.com');
      setJuntaMembers(filteredMembers);
    }

    // Try to find the user by email if provided
    if (inputEmail) {
      const member = members?.find(s => s.email.toLowerCase() === inputEmail);
      
      if (member) {
        const memberPassword = member.password || '';
        
        // Case 1: Member has their own password set - check it
        if (memberPassword && memberPassword === inputPassword) {
          setCurrentUser(member);
          setAuthed(true);
          setAuthError('');
          return;
        }
        
        // Case 2: No individual password set - accept temp password or building password
        if (!memberPassword) {
          // Accept the temporary default password "123456"
          if (inputPassword === TEMP_PASSWORD) {
            setCurrentUser(member);
            setAuthed(true);
            setAuthError('');
            // Prompt to change password after first login
            setShowPasswordChange(true);
            return;
          }
          // Or accept building password as fallback
          if (buildingPassword && inputPassword === buildingPassword) {
            setCurrentUser(member);
            setAuthed(true);
            setAuthError('');
            setShowPasswordChange(true);
            return;
          }
        }
        
        setAuthError('Contraseña incorrecta para este usuario.');
        return;
      }
      
      // Email provided but not found as junta member
      setAuthError('Este email no está registrado como miembro de la junta.');
      return;
    }

    // Fallback: building password login (for original admin who registered the building)
    if (!inputEmail && buildingPassword) {
      if (password === buildingPassword) {
        setCurrentUser(null); // Building-level admin
        setAuthed(true);
        setAuthError('');
      } else {
        setAuthError('Contraseña incorrecta. Si olvidaste tu clave, puedes recuperarla desde la página principal.');
      }
      return;
    }

    setAuthError('Contraseña incorrecta. Si olvidaste tu clave, puedes recuperarla desde la página principal.');
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 4) {
      setPasswordChangeMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeMsg('Las contraseñas no coinciden.');
      return;
    }
    if (!currentUser || !currentUser.email) {
      setPasswordChangeMsg('Error: sesión de usuario no encontrada.');
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change',
          email: currentUser.email,
          buildingSlug: building?.slug,
          currentPassword: password,
          newPassword: newPassword,
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setPasswordChangeMsg(data.error || 'Error cambiando contraseña');
        return;
      }

      setPasswordChangeMsg('✅ Contraseña actualizada correctamente');
      setShowPasswordChange(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordChangeMsg(''), 3000);
      
      // Update current user
      setCurrentUser({ ...currentUser, password: newPassword });
    } catch (err: any) {
      setPasswordChangeMsg('Error de conexión: ' + err.message);
    }
  };

  // Helper: check if current user is admin
  const isUserAdmin = !currentUser || currentUser.is_admin === true;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = (() => {
    if (!measurements.length) return null;
    // measurements está ordenado ascendente (más antiguo primero)
    const latest = measurements[measurements.length - 1];
    const prev   = measurements[measurements.length - 2];
    // Balance 24h: desde el ÚLTIMO registro hacia atrás 24h (no desde "now")
    const lastTime = new Date(latest.recorded_at);
    const cutoff24h = new Date(lastTime.getTime() - 24 * 60 * 60 * 1000);
    const last24h = measurements.filter(m => new Date(m.recorded_at) >= cutoff24h);
    let consumed24h = 0, filled24h = 0;
    last24h.forEach((m, i) => {
      if (i === 0) return;
      const v = getVariation(m);
      if (v < 0) consumed24h += Math.abs(v);
      else if (v > 0) filled24h += v;
    });
    const avgPct = measurements.slice(-10).reduce((a, m) => a + m.percentage, 0) / Math.min(10, measurements.length);
    return {
      currentPct: latest.percentage,
      currentLts: latest.liters,
      trend: prev ? latest.liters - prev.liters : 0,
      consumed24h,
      filled24h,
      avgPct,
      lastDate: new Date(latest.recorded_at).toLocaleString('es-ES'),
      totalReadings: measurements.length,
    };
  })();

  // ── Junta CRUD ─────────────────────────────────────────────────────────────
  const addJuntaMember = async () => {
    if (!newMemberEmail.trim()) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden agregar miembros en la cuenta de demostración.')) return;
    const memberEmail = newMemberEmail.trim().toLowerCase();
    const memberNameVal = newMemberName.trim() || null;
    
    // Check if already exists as member
    const existing = allSubscribers.find(s => s.email.toLowerCase() === memberEmail);
    if (existing) {
      // Update to mark as junta
const { error: updateError } = await supabase.from('building_members')
        .update({ name: memberNameVal, role: newMemberRole || 'Vocal', is_admin: newMemberIsAdmin })
        .eq('id', existing.id);
      if (updateError) {
        console.error('Error updating member:', updateError);
        setMemberMsg('❌ Error al actualizar: ' + updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from('building_members').insert({
        building_id: building.id,
        email: memberEmail,
        name: memberNameVal,
        role: newMemberRole || 'Vocal',
        is_admin: newMemberIsAdmin,
      });
      if (insertError) {
        console.error('Error inserting member:', insertError);
        setMemberMsg('❌ Error al agregar: ' + insertError.message);
        return;
      }
    }

    // Send welcome email to new member
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'junta-welcome',
          building: {
            name: building.name,
            slug: building.slug,
            memberEmail: memberEmail,
            memberName: newMemberName || 'Nuevo Miembro',
            memberRole: newMemberRole,
            isAdmin: newMemberIsAdmin,
          }
        })
      });
    } catch (emailErr) {
      console.error('Error sending welcome email:', emailErr);
    }

    setNewMemberEmail(''); setNewMemberName(''); setNewMemberRole('Vocal'); setNewMemberIsAdmin(false);
    setShowAddMember(false);
    setMemberMsg('✅ Miembro agregado - Se envió email de invitación');
    setTimeout(() => setMemberMsg(''), 4000);
    loadData();
  };

  const removeJuntaMember = async (member: JuntaMember) => {
    if (!confirm(`¿Quitar a ${member.email} de la junta?\nDejará de recibir copias de los reportes.`)) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden eliminar miembros en la cuenta de demostración.')) return;
    await supabase.from('building_members')
      .delete()
      .eq('id', member.id);
    setMemberMsg('🗑️ Miembro removido de la junta');
    setTimeout(() => setMemberMsg(''), 3000);
    loadData();
  };

  const saveEditMember = async () => {
    if (!editingMember) return;
    if (demoBlock('⚠️ Modo Demo: los cambios no se guardan en la base de datos.')) { setEditingMember(null); return; }
    await supabase.from('building_members')
      .update({ name: editingMember.name, role: editingMember.role, is_admin: editingMember.is_admin })
      .eq('id', editingMember.id);
    setEditingMember(null);
    setMemberMsg('✅ Datos actualizados');
    setTimeout(() => setMemberMsg(''), 3000);
    loadData();
  };

  // ── Reportes ───────────────────────────────────────────────────────────────
  const filteredMeasurements = (() => {
    let data = [...measurements].reverse(); // Mostrar más reciente primero en reportes
    if (reportFrom) data = data.filter(m => new Date(m.recorded_at) >= new Date(reportFrom));
    if (reportTo)   data = data.filter(m => new Date(m.recorded_at) <= new Date(reportTo + 'T23:59:59'));
    return data;
  })();

  const exportCSV = () => {
    const rows = [
      ['Fecha/Hora','Litros','Porcentaje','Variación (L)','Registrado por','Email'],
      ...filteredMeasurements.map(m => [
        new Date(m.recorded_at).toLocaleString('es-ES'),
        Math.round(m.liters),
        Math.round(m.percentage) + '%',
        Math.round((m.variation_lts ?? m.variacion_lts ?? 0)),
        m.collaborator_name || '—',
        m.email || '—',
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `reporte-${building?.slug}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Mediciones CRUD ───────────────────────────────────────────────────────
  const startEditMeasurement = (m: any) => {
    setEditingMeasurement(m);
    setEditLiters(String(Math.round(m.liters)));
    setEditPct(String(m.percentage.toFixed(1)));
  };

  const saveEditMeasurement = async () => {
    if (!editingMeasurement) return;
    if (demoBlock('⚠️ Modo Demo: las ediciones no se guardan en la base de datos.')) { setEditingMeasurement(null); return; }
    const newLiters = parseFloat(editLiters);
    const newPct    = parseFloat(editPct);
    if (isNaN(newLiters) || isNaN(newPct)) return;
    const { error } = await supabase
      .from('measurements')
      .update({
        liters:       newLiters,
        percentage:   newPct,
        is_anomaly:   false,
        anomaly_checked: true,
        variacion_lts: null, // se recalcula en próximos registros
        variation_lts: null,
      })
      .eq('id', editingMeasurement.id);
    if (!error) {
      setMeasMsg('✅ Medición corregida');
      setEditingMeasurement(null);
      setTimeout(() => setMeasMsg(''), 3000);
      loadData();
    } else {
      setMeasMsg('❌ Error: ' + error.message);
    }
  };

  const deleteMeasurement = async (id: string) => {
    if (!confirm('¿Eliminar esta medición? Esta acción no se puede deshacer.')) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden eliminar registros en la cuenta de demostración.')) return;
    const { error } = await supabase.from('measurements').delete().eq('id', id);
    if (!error) {
      setMeasMsg('🗑️ Medición eliminada');
      setTimeout(() => setMeasMsg(''), 3000);
      loadData();
    }
  };

  const markAnomalyReviewed = async (id: string) => {
    if (demoBlock()) return;
    await supabase.from('measurements').update({ anomaly_checked: true, is_anomaly: false }).eq('id', id);
    setMeasMsg('✅ Marcada como revisada');
    setTimeout(() => setMeasMsg(''), 3000);
    loadData();
  };

  // ── Configuración del edificio ─────────────────────────────────────────────
  const startEditConfig = () => {
    setCfgName(building.name || '');
    setCfgCapacity(String(building.tank_capacity_liters || 169000));
    setCfgAdminEmail(building.admin_email || '');
    setCfgThreshold('30');
    setEditingConfig(true);
  };

  const saveConfig = async () => {
    if (demoBlock('⚠️ Modo Demo: la configuración no se guarda en la cuenta de demostración.')) { setEditingConfig(false); return; }
    const { error } = await supabase.from('buildings').update({
      name:                 cfgName,
      tank_capacity_liters: parseInt(cfgCapacity) || 169000,
      admin_email:          cfgAdminEmail,
    }).eq('id', building.id);
    if (!error) {
      setCfgMsg('✅ Configuración guardada');
      setEditingConfig(false);
      setTimeout(() => setCfgMsg(''), 3000);
      // Reload building
      const { data } = await supabase.from('buildings').select('*').eq('id', building.id).single();
      if (data) setBuilding(data);
    } else {
      setCfgMsg('❌ Error: ' + error.message);
    }
  };

  // ── Banner upload ──────────────────────────────────────────────────────────
  const uploadBanner = async (file: File) => {
    if (!file) return;
    if (demoBlock('⚠️ Modo Demo: no se puede subir banner en la cuenta de demostración.')) return;
    if (file.size > 2 * 1024 * 1024) { setBannerMsg('❌ La imagen debe ser menor a 2MB'); return; }
    if (!file.type.startsWith('image/')) { setBannerMsg('❌ Solo se permiten imágenes'); return; }

    setBannerUploading(true);
    setBannerMsg('Subiendo imagen...');

    try {
      const ext  = file.name.split('.').pop();
      const path = `banners/${building.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('building-banners')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('building-banners').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust

      const { error: updateError } = await supabase
        .from('buildings').update({ banner_url: publicUrl }).eq('id', building.id);

      if (updateError) throw updateError;

      setBuilding({ ...building, banner_url: publicUrl });
      setBannerMsg('✅ Banner actualizado correctamente');
    } catch (e: any) {
      setBannerMsg('❌ Error: ' + e.message);
    } finally {
      setBannerUploading(false);
      setTimeout(() => setBannerMsg(''), 5000);
    }
  };

  const removeBanner = async () => {
    if (!confirm('¿Eliminar el banner actual?')) return;
    if (demoBlock('⚠️ Modo Demo: no se puede eliminar el banner en la cuenta de demostración.')) return;
    await supabase.from('buildings').update({ banner_url: null }).eq('id', building.id);
    setBuilding({ ...building, banner_url: null });
    setBannerMsg('🗑️ Banner eliminado');
    setTimeout(() => setBannerMsg(''), 3000);
  };

  // ── Renders ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
    </div>
  );

  if (!building) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <p className="text-red-400">Edificio no encontrado</p>
    </div>
  );

  if (!authed) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${building.status === 'Suspendido' || building.status === 'Inactivo' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
            <Droplets className={`w-7 h-7 ${building.status === 'Suspendido' || building.status === 'Inactivo' ? 'text-red-400' : 'text-blue-400'}`} />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Panel Administrativo</h1>
            <p className="text-slate-400 text-sm">{building.name}</p>
            {(building.status === 'Suspendido' || building.status === 'Inactivo') && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
                ⛔ Cuenta {building.status}
              </span>
            )}
          </div>
        </div>
        {(building.status === 'Suspendido' || building.status === 'Inactivo') ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300 text-center">
            <p className="font-bold mb-2">Acceso no disponible</p>
            <p>La cuenta de este edificio está <strong>{building.status}</strong>.</p>
            <p className="mt-2 text-xs text-red-400">Para reactivarla, contacte al administrador del sistema AquaSaaS.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-slate-400 text-xs mb-1 block">Email (opcional - para miembros de junta)</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="tu-email@ejemplo.com"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-slate-400 text-sm mb-4">
              {loginEmail ? 'Ingresa tu contraseña:' : 'Ingresa la contraseña de administrador del edificio:'}
            </p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder={loginEmail ? "Tu contraseña" : "Contraseña"}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 mb-3 focus:outline-none focus:border-blue-500"
            />
            {authError && <p className="text-red-400 text-sm mb-3">{authError}</p>}
            <button onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
              Ingresar
            </button>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs text-center mb-2">
                {loginEmail 
                  ? 'Usa tu email + contraseña personal' 
                  : 'Solo miembros autorizados de la Junta de Condominio'}
              </p>
              <p className="text-center">
                <a href="/" className="text-blue-400 text-xs hover:text-blue-300">
                  ← Ir a página principal (recuperar contraseña)
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const pctColor = (kpis?.currentPct ?? 0) > 60 ? 'text-green-400' : (kpis?.currentPct ?? 0) > 30 ? 'text-amber-400' : 'text-red-400';
  const pctBg    = (kpis?.currentPct ?? 0) > 60 ? 'bg-green-500' : (kpis?.currentPct ?? 0) > 30 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Cambia tu contraseña</h2>
            <p className="text-slate-400 text-sm mb-4">Por seguridad, crea una contraseña personalizada.</p>
            {passwordChangeMsg && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${passwordChangeMsg.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {passwordChangeMsg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Nueva contraseña</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Confirmar contraseña</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={handlePasswordChange}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
                Guardar nueva contraseña
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Demo mode banner */}
      {isDemo && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs text-amber-400 font-medium">
          ⚠️ <strong>Modo Demostración</strong> — Puedes explorar todas las funciones, pero los cambios no se guardan en la base de datos.
        </div>
      )}
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">{building.name}</h1>
              <p className="text-slate-400 text-xs">Panel Administrativo — Junta de Condominio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setAuthed(false)} className="flex items-center gap-2 text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-700 text-sm">
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex gap-1 px-4 overflow-x-auto scrollbar-hide">
          {([
            { id: 'dashboard',     label: 'Dashboard',     Icon: BarChart3, color: 'blue' },
            { id: 'junta',         label: 'Junta',         Icon: Users,     color: 'purple' },
            { id: 'mediciones',    label: 'Mediciones',    Icon: Activity,  color: 'amber' },
            { id: 'reportes',      label: 'Reportes',      Icon: FileText,  color: 'green' },
            { id: 'configuracion', label: 'Config.',       Icon: Settings,  color: 'cyan' },
          ] as { id: Tab; label: string; Icon: any; color: string }[]).map(({ id, label, Icon, color }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 my-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === id
                  ? `bg-${color}-500/20 text-${color}-400 ring-1 ring-${color}-500/40 shadow-sm`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}>
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.slice(0,4)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── DASHBOARD TAB ────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {kpis ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Nivel actual */}
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 col-span-1 md:col-span-1">
                  <p className="text-gray-400 text-xs mb-1">Nivel actual</p>
                  <p className={`text-4xl font-bold ${pctColor}`}>{Math.round(kpis.currentPct)}%</p>
                  <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${pctBg} rounded-full transition-all`}
                      style={{ width: `${Math.min(100, kpis.currentPct)}%` }} />
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{Math.round(kpis.currentLts).toLocaleString()} L</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Tendencia</p>
                  {kpis.trend >= 0
                    ? <p className="text-green-400 font-bold text-xl flex items-center gap-1"><TrendingUp className="w-5 h-5" />+{Math.round(kpis.trend).toLocaleString()} L</p>
                    : <p className="text-red-400 font-bold text-xl flex items-center gap-1"><TrendingDown className="w-5 h-5" />{Math.round(kpis.trend).toLocaleString()} L</p>
                  }
                  <p className="text-slate-500 text-xs mt-1">vs medición anterior</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Consumo 24h</p>
                  <p className="text-orange-400 font-bold text-xl">▼ {Math.round(kpis.consumed24h).toLocaleString()} L</p>
                  <p className="text-green-400 font-bold text-base">▲ {Math.round(kpis.filled24h).toLocaleString()} L</p>
                  <p className="text-slate-500 text-xs mt-1">consumido / llenado</p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">Total registros</p>
                  <p className="text-blue-400 font-bold text-xl">{kpis.totalReadings}</p>
                  <p className="text-slate-500 text-xs mt-1">último: {kpis.lastDate}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Aún no hay mediciones registradas</p>
              </div>
            )}

            {/* GRÁFICOS */}
            {measurements.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl">
                <div className="px-5 py-4 border-b border-slate-700">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Gráficos de Inteligencia Hídrica
                  </h3>
                </div>
                {chartsLoading ? (
                  <div className="p-10 text-center text-slate-400 flex items-center justify-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Generando gráficos...</span>
                  </div>
                ) : measurements.length > 0 ? (
                  <div className="space-y-6 p-6">
                    {/* Fila Principal: Gauge + Indicador de Alarma */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-4">
                        <TankLevelGauge percentage={measurements[0]?.percentage ?? 0} />
                      </div>
                      <div className="flex flex-col gap-4">
                        <StatusIndicator percentage={measurements[0]?.percentage ?? 0} />
                      </div>
                    </div>

                    {/* Gráficos de Tendencia */}
                    <div className="grid grid-cols-1 gap-6">
                      <CombinedTrendChart data={measurements} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FlowComparisonChart data={measurements} />
                      <ThresholdsChart data={measurements} capacity={building?.tank_capacity_liters ?? 169000} />
                    </div>

                    {/* Otros gráficos que siguen usando imágenes (optimizados) por ahora */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { title: 'Consumo por Día de la Semana',       url: chartUrls?.dayOfWeekChart },
                        { title: 'Nivel % — Últimas 4 Semanas',        url: chartUrls?.last4WeeksChart },
                        { title: 'Consumo Fin de Semana (5 semanas)',   url: chartUrls?.weekendChart },
                        { title: 'Histórico Mensual Consumo/Llenado',  url: chartUrls?.historicoMensualChart },
                      ].map((chart, i) => (
                        <div key={i} className="bg-white rounded-lg overflow-hidden p-2">
                          <p className="text-xs text-slate-500 font-medium mb-2 text-center">{chart.title}</p>
                          {chart.url ? (
                            <img src={chart.url} alt={chart.title} className="max-w-full h-auto mx-auto" />
                          ) : (
                            <div className="h-40 flex items-center justify-center text-slate-300">Cargando...</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-500">No hay datos para generar gráficos.</div>
                )}
              </div>
            )}

            {/* Alerta si nivel bajo */}
            {kpis && kpis.currentPct < 30 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-semibold">⚠️ Nivel crítico del tanque</p>
                  <p className="text-red-300 text-sm">El tanque está por debajo del 30%. Se recomienda tomar acciones inmediatas.</p>
                </div>
              </div>
            )}

            {/* Últimas 10 mediciones */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Últimas Mediciones
                </h3>
                <span className="text-slate-500 text-xs">{measurements.length} registros totales</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      {['Fecha/Hora','Litros','%','Variación','Registrado por'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {measurements.slice(-10).reverse().map(m => { // De la más reciente a la más antigua
                      const v = getVariation(m);
                      return (
                        <tr key={m.id} className="hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                            {new Date(m.recorded_at).toLocaleString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">{Math.round(m.liters).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${m.percentage > 60 ? 'text-green-400' : m.percentage > 30 ? 'text-amber-400' : 'text-red-400'}`}>
                              {Math.round(m.percentage)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {v !== 0 && (
                              <span className={v > 0 ? 'text-green-400' : 'text-red-400'}>
                                {v > 0 ? '+' : ''}{Math.round(v).toLocaleString()} L
                              </span>
                            )}
                            {v === 0 && <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{m.collaborator_name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mini estadísticas */}
            {measurements.length >= 3 && (() => {
              const sorted = [...measurements].sort((a, b) => a.percentage - b.percentage);
              const min = sorted[0]; const max = sorted[sorted.length - 1];
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <p className="text-slate-400 text-xs mb-2">📉 Mínimo histórico</p>
                    <p className="text-red-400 font-bold text-2xl">{Math.round(min.percentage)}%</p>
                    <p className="text-slate-500 text-xs">{new Date(min.recorded_at).toLocaleDateString('es-ES')}</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <p className="text-slate-400 text-xs mb-2">📈 Máximo histórico</p>
                    <p className="text-green-400 font-bold text-2xl">{Math.round(max.percentage)}%</p>
                    <p className="text-slate-500 text-xs">{new Date(max.recorded_at).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── JUNTA TAB ────────────────────────────────────────────────── */}
        {tab === 'junta' && (
          <div className="space-y-5">
            {memberMsg && (
              <div className="bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm">{memberMsg}</div>
            )}

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    Miembros de la Junta de Condominio
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Los miembros de junta reciben copia de TODOS los reportes sin límite de emails.
                    {currentUser && !isUserAdmin && <span className="text-amber-400 ml-2">(Solo administradores pueden agregar/remover)</span>}
                  </p>
                </div>
                {isUserAdmin && (
                  <button onClick={() => setShowAddMember(!showAddMember)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                )}
              </div>

{showAddMember && (
                <div className="px-5 py-4 bg-slate-700/30 border-b border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <input type="email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)}
                      placeholder="correo@ejemplo.com" className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                    <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
                      placeholder="Nombre (opcional)" className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                    <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                      {['Presidente','Vice-presidente','Secretario/a','Tesorero/a','Vocal','Síndico/a'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 mb-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <input
                      type="checkbox"
                      id="newMemberIsAdmin"
                      checked={newMemberIsAdmin}
                      onChange={e => setNewMemberIsAdmin(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500"
                    />
                    <label htmlFor="newMemberIsAdmin" className="text-sm text-purple-300">
                      <strong>Administrador</strong> - Puede gestionar miembros de junta y configurar el edificio
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addJuntaMember} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                      <Save className="w-4 h-4" /> Guardar
                    </button>
                    <button onClick={() => setShowAddMember(false)} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                  </div>
                </div>
              )}

              {juntaMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No hay miembros de junta configurados</p>
                  <p className="text-xs mt-1">Agrega miembros para que reciban copias de todos los reportes sin límite.</p>
                </div>
              ) : (
<table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      {['Email','Nombre','Cargo','Rol','Emails recibidos','Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {juntaMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-700/20">
                        {editingMember?.id === m.id ? (
                          <>
                            <td className="px-4 py-3 text-slate-400 text-xs">{m.email}</td>
                            <td className="px-4 py-3">
                              <input type="text" value={editingMember.name || ''} onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                                className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs w-full" />
                            </td>
                            <td className="px-4 py-3">
                              <select value={editingMember.role || 'Vocal'} onChange={e => setEditingMember({...editingMember, role: e.target.value})}
                                className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs">
                                {['Presidente','Viceidente','Secretario/a','Tesorero/a','Vocal','Síndico/a'].map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={editingMember.is_admin === true}
                                  onChange={e => setEditingMember({...editingMember, is_admin: e.target.checked})}
                                  className="w-3 h-3"
                                />
                                <span className={editingMember.is_admin ? "text-purple-400 font-medium" : "text-slate-500"}>
                                  {editingMember.is_admin ? "Admin" : "Miembro"}
                                </span>
                              </label>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">Ilimitado</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button onClick={saveEditMember} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded"><Save className="w-4 h-4" /></button>
                                <button onClick={() => setEditingMember(null)} className="p-1.5 text-slate-400 hover:bg-slate-600 rounded"><X className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-300 text-xs">{maskEmail(m.email)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{m.name || '—'}</td>
                            <td className="px-4 py-3">
                              {m.role && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">{m.role}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {m.is_admin ? (
                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">Admin</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-700 text-slate-500 rounded-full text-xs">Miembro</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-green-400 text-xs font-medium">∞ Ilimitado</span>
                            </td>
                            <td className="px-4 py-3">
                              {isUserAdmin && (
                                <div className="flex gap-1">
                                  <button onClick={() => setEditingMember(m)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => removeJuntaMember(m)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Suscriptores regulares */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-400" />
                  Suscriptores Regulares
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">Vecinos que reciben reportes (máx. 5 por ciclo)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      {['Email','Emails restantes'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {/* This section would need resident_subscriptions - showing placeholder for now */}
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-500 text-sm">No hay suscriptores regulares aún</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORTES TAB ─────────────────────────────────────────────── */}
        {tab === 'reportes' && (
          <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Filtrar Reporte
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Desde</label>
                  <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Hasta</label>
                  <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Tipo de reporte</label>
                  <select value={reportType} onChange={e => setReportType(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="full">Completo (todas las mediciones)</option>
                    <option value="daily">Resumen diario (1 por día)</option>
                    <option value="anomalies">Solo anomalías</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-lg">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300 text-sm font-medium">
                    {filteredMeasurements.length} registros en el período
                  </span>
                </div>
                <button onClick={exportCSV}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>
            </div>

            {/* Reportes pre-construidos */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Reportes Rápidos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'Últimos 7 días',   days: 7  },
                  { label: 'Últimos 30 días',  days: 30 },
                  { label: 'Últimos 90 días',  days: 90 },
                ].map(({ label, days }) => (
                  <button key={days} onClick={() => {
                    const from = new Date(); from.setDate(from.getDate() - days);
                    setReportFrom(from.toISOString().split('T')[0]);
                    setReportTo(new Date().toISOString().split('T')[0]);
                    setTab('reportes');
                  }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-3 rounded-lg text-sm transition-colors text-left">
                    📅 {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen estadístico del período */}
            {filteredMeasurements.length > 0 && (() => {
              const pcts = filteredMeasurements.map(m => m.percentage);
              const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
              const minP = Math.min(...pcts); const maxP = Math.max(...pcts);
              const consumptions = filteredMeasurements.filter(m => getVariation(m) < 0).map(m => Math.abs(getVariation(m)));
              const fillings = filteredMeasurements.filter(m => getVariation(m) > 0).map(m => getVariation(m));
              const totalFilled = fillings.reduce((a, b) => a + b, 0);
              const totalConsumed = consumptions.reduce((a, b) => a + b, 0);
              return (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">📊 Resumen Estadístico del Período</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-slate-400 text-xs">Nivel promedio</p>
                      <p className="text-blue-400 font-bold text-xl">{avg.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Mínimo registrado</p>
                      <p className="text-red-400 font-bold text-xl">{minP.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Máximo registrado</p>
                      <p className="text-green-400 font-bold text-xl">{maxP.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">▼ Total consumido</p>
                      <p className="text-orange-400 font-bold text-xl">{Math.round(totalConsumed).toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">▲ Total llenado</p>
                      <p className="text-green-400 font-bold text-xl">{Math.round(totalFilled).toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Registros en período</p>
                      <p className="text-slate-300 font-bold text-xl">{filteredMeasurements.length}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tabla de datos */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700">
                <h3 className="text-white font-semibold">Datos del Período</h3>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      {['Fecha/Hora','Litros','%','Variación (L)','Registrado por'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-slate-400 uppercase font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {filteredMeasurements.map(m => {
                      const v = getVariation(m);
                      return (
                        <tr key={m.id} className="hover:bg-slate-700/20">
                          <td className="px-4 py-2 text-slate-300 whitespace-nowrap">{new Date(m.recorded_at).toLocaleString('es-ES')}</td>
                          <td className="px-4 py-2 text-white">{Math.round(m.liters).toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={m.percentage > 60 ? 'text-green-400' : m.percentage > 30 ? 'text-amber-400' : 'text-red-400'}>
                              {Math.round(m.percentage)}%
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {v !== 0
                              ? <span className={v > 0 ? 'text-green-400' : 'text-red-400'}>{v > 0 ? '+' : ''}{Math.round(v).toLocaleString()}</span>
                              : <span className="text-slate-600">—</span>
                            }
                          </td>
                          <td className="px-4 py-2 text-slate-400">{m.collaborator_name || '—'}</td>
                        </tr>
                      );
                    })}
                    {filteredMeasurements.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Sin registros en el período seleccionado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* ── MEDICIONES TAB ───────────────────────────────────────────── */}
        {tab === 'mediciones' && (() => {
          const displayMs = [...measurements]
            .sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
            .filter((m: any) => !showAnomaliesOnly || m.is_anomaly);
          return (
            <div className="space-y-4">
              {measMsg && <div className="bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm">{measMsg}</div>}

              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700 flex flex-wrap gap-3 justify-between items-center">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Gestión de Mediciones ({displayMs.length} registros)
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={showAnomaliesOnly}
                        onChange={e => setShowAnomaliesOnly(e.target.checked)}
                        className="rounded" />
                      Solo anomalías
                    </label>
                    {showAnomaliesOnly && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">
                        {measurements.filter((m: any) => m.is_anomaly).length} anomalías
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-700/50 sticky top-0">
                      <tr>
                        {['Fecha/Hora','Litros','%','Variación','Caudal','Reportado por','Estado','Acciones'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-slate-400 uppercase font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {displayMs.map((m: any) => {
                        const v = m.variacion_lts ?? m.variation_lts ?? 0;
                        const c = m.caudal_lts_min ?? m.flow_lpm ?? 0;
                        const isEditing = editingMeasurement?.id === m.id;
                        return (
                          <tr key={m.id} className={`hover:bg-slate-700/20 ${m.is_anomaly ? 'bg-red-500/5 border-l-2 border-red-500/50' : ''}`}>
                            <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                              {new Date(m.recorded_at).toLocaleString('es-ES')}
                              {m.is_anomaly && !m.anomaly_checked && (
                                <span className="ml-1 text-red-400 text-xs">⚠️ Anomalía</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-white font-medium">
                              {isEditing
                                ? <input type="number" value={editLiters} onChange={e => setEditLiters(e.target.value)}
                                    className="w-20 bg-slate-600 border border-slate-500 text-white rounded px-1 py-0.5 text-xs" />
                                : Math.round(m.liters).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing
                                ? <input type="number" value={editPct} onChange={e => setEditPct(e.target.value)}
                                    className="w-16 bg-slate-600 border border-slate-500 text-white rounded px-1 py-0.5 text-xs" />
                                : <span className={m.percentage > 60 ? 'text-green-400' : m.percentage > 30 ? 'text-amber-400' : 'text-red-400'}>
                                    {Math.round(m.percentage)}%
                                  </span>}
                            </td>
                            <td className={`px-3 py-2 ${v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                              {v !== 0 ? (v > 0 ? '+' : '') + Math.round(v).toLocaleString() : '—'}
                            </td>
                            <td className={`px-3 py-2 ${c > 0 ? 'text-green-400' : c < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                              {c !== 0 ? c.toFixed(2) : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{m.collaborator_name || '—'}</td>
                            <td className="px-3 py-2">
                              {m.is_anomaly
                                ? <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">Anomalía</span>
                                : <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Normal</span>}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {isEditing ? (
                                  <>
                                    <button onClick={saveEditMeasurement} className="p-1 text-green-400 hover:bg-green-500/20 rounded" title="Guardar">
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingMeasurement(null)} className="p-1 text-slate-400 hover:bg-slate-600 rounded" title="Cancelar">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startEditMeasurement(m)} className="p-1 text-blue-400 hover:bg-blue-500/20 rounded" title="Editar">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {m.is_anomaly && !m.anomaly_checked && (
                                      <button onClick={() => markAnomalyReviewed(m.id)} className="p-1 text-amber-400 hover:bg-amber-500/20 rounded" title="Marcar revisada">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button onClick={() => deleteMeasurement(m.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded" title="Eliminar">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {displayMs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">No hay registros que mostrar</div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── CONFIGURACIÓN TAB ─────────────────────────────────────────── */}
        {tab === 'configuracion' && (
          <div className="space-y-5">
            {cfgMsg && <div className="bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm">{cfgMsg}</div>}
            {bannerMsg && <div className="bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm">{bannerMsg}</div>}

            {/* Banner */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Image className="w-4 h-4 text-purple-400" />
                  Banner del Edificio
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Tamaño recomendado: <strong className="text-slate-300">1200 × 300 px</strong> (ratio 4:1) · Máx 2MB · JPG, PNG o WebP
                </p>
              </div>
              <div className="p-5 space-y-4">
                {building?.banner_url ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden border border-slate-600" style={{maxHeight: '200px'}}>
                      <img src={building.banner_url} alt="Banner actual" className="w-full object-cover" style={{maxHeight: '200px'}} />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" />
                        Cambiar banner
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
                      </label>
                      <button onClick={removeBanner} className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors">
                        <Trash2 className="w-4 h-4" />
                        Eliminar banner
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-8 cursor-pointer transition-colors hover:border-blue-500 hover:bg-blue-500/5 ${bannerUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-slate-300 font-medium">
                      {bannerUploading ? 'Subiendo...' : 'Haz clic para subir el banner'}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">1200×300px recomendado · máx 2MB</p>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
                  </label>
                )}
              </div>
            </div>

            {/* Datos del edificio */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  Datos del Edificio
                </h3>
                {!editingConfig && (
                  <button onClick={startEditConfig}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                )}
              </div>
              <div className="p-5">
                {editingConfig ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1">Nombre del Edificio</label>
                        <input value={cfgName} onChange={e => setCfgName(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1">Capacidad del Tanque (Litros)</label>
                        <input type="number" value={cfgCapacity} onChange={e => setCfgCapacity(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-slate-400 text-xs mb-1">Email del Administrador {isDemo && '(demo@example.com)'}</label>
                        <input type="email" value={isDemo ? 'demo@example.com' : cfgAdminEmail} onChange={e => !isDemo && setCfgAdminEmail(e.target.value)}
                          readOnly={isDemo}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveConfig}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                        <Save className="w-4 h-4" />
                        Guardar cambios
                      </button>
                      <button onClick={() => setEditingConfig(false)}
                        className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Nombre',            value: building.name },
                      { label: 'Slug / Identificador', value: building.slug },
                      { label: 'Capacidad del tanque', value: `${(building.tank_capacity_liters || 169000).toLocaleString()} L` },
                      { label: 'Email administrador',  value: isDemo ? maskEmail(building.admin_email || '') : building.admin_email },
                      { label: 'Estado',             value: building.status || 'Prueba' },
                      { label: 'Banner',             value: building.banner_url ? '✅ Configurado' : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-700/30 rounded-lg p-3">
                        <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                        <p className="text-slate-200 font-medium text-xs break-all">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
