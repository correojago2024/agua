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
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Droplets, Users, BarChart3, Download, Plus, Trash2, Edit2, Save,
  X, RefreshCw, AlertTriangle, CheckCircle2, Mail, Calendar,
  TrendingDown, TrendingUp, Activity, FileText, Settings, LogOut,
  ChevronDown, ChevronUp, Image, Wrench, Upload, MessageSquare, ClipboardList, CreditCard, Eye, Info
  } from 'lucide-react';


import { format } from 'date-fns';
import { getAllImprovedCharts } from '@/lib/charts';
import { 
  CombinedTrendChart, 
  FlowComparisonChart, 
  ThresholdsChart, 
  StatusIndicator,
  DayOfWeekConsumptionChart,
  LastWeeksTrendChart,
  WeekendConsumptionChart,
  MonthlyHistoryChart,
  HourlyConsumptionChart,
  WeeklyComparisonChart,
  NightlyConsumptionChart,
  VariationChart,
  FlowHourlyChart,
  ProjectionChart,
  ConsumptionDistributionPieChart,
  WeekendLitrosChart,
  ConsumptionHeatmap
} from '@/components/DashboardCharts';

import {
  UserParticipationPieChart,
  MonthlyReportsBarChart,
  DailyEmailsBarChart
} from '@/components/SystemStatsCharts';

import { Measurement } from '@/lib/calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';
const supabase = createClient(supabaseUrl, supabaseKey);

type Tab = 'dashboard' | 'junta' | 'reportes' | 'mediciones' | 'configuracion' | 'alarmas_logs';

// Helper: lee variation_lts o variacion_lts (ambos nombres posibles en BD)
const getVariation = (m: Measurement): number =>
  m.variation_lts ?? m.variacion_lts ?? 0;

// Enmascara email: pepito@gmail.com → pe***to@gmail.com
const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
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
  enable_email?: boolean;
  enable_whatsapp?: boolean;
}

export default function EdificioAdminPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [stats, setStats] = useState({ totalEmails: 0, measurementsToday: 0, activeUsers: 0 });


  // Report filters
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo]     = useState('');
  const [reportType, setReportType] = useState('full');
  const [showPreview, setShowPreview] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Mediciones editing
  const [editingMeasurement, setEditingMeasurement] = useState<any>(null);
  const [editLiters, setEditLiters] = useState('');
  const [editPct, setEditPct]       = useState('');
  const [measMsg, setMeasMsg]       = useState('');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  // Configuración del edificio
  const [editingConfig, setEditingConfig] = useState(false);
  const [showHelpModal, setShowHelpModal]   = useState(false);
  const [cfgName, setCfgName]       = useState('');
  const [cfgCapacity, setCfgCapacity] = useState('');
  const [cfgAdminEmail, setCfgAdminEmail] = useState('');
  const [cfgThreshold, setCfgThreshold]   = useState('30');
  const [cfgSilenceStart, setCfgSilenceStart] = useState('22:00');
  const [cfgSilenceEnd, setCfgSilenceEnd] = useState('06:00');
  const [cfgEnableResidentNotifications, setCfgEnableResidentNotifications] = useState(true);
  const [cfgMsg, setCfgMsg]         = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerMsg, setBannerMsg]   = useState('');

  // WhatsApp settings
  const [waEnabled, setWaEnabled] = useState(false);
  const [waService, setWaService] = useState<'GREENAPI' | 'WHAPI' | 'BUSINESS'>('GREENAPI');
  const [waThresholdCaution, setWaThresholdCaution] = useState(60);
  const [waThresholdRationing, setWaThresholdRationing] = useState(40);
  const [waThresholdCritical, setWaThresholdCritical] = useState(20);
  const [waJuntaPhones, setWaJuntaPhones] = useState('');
  
  // Daily Report Settings
  const [waDailyReportEnabled, setWaDailyReportEnabled] = useState(false);
  const [waDailyReportTime, setWaDailyReportTime] = useState('19:00');
  const [waDailyReportDays, setWaDailyReportDays] = useState('1,2,3,4,5,6,0');
  
  // Credenciales específicas del edificio
  const [waInstanceId, setWaInstanceId] = useState('');
  const [waApiToken, setWaApiToken] = useState('');
  const [waApiUrl, setWaApiUrl] = useState('');
  const [waBusinessPhoneId, setWaBusinessPhoneId] = useState('');
  
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  
  // Prueba de WhatsApp
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);

  // Bitácora y Envío Manual
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [sendingManual, setSendingManual] = useState(false);
  const [manualMsg, setManualMsg] = useState('');

  // Junta editing
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName]   = useState('');
  const [newMemberRole, setNewMemberRole]   = useState('Vocal');
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [newMemberEnableEmail, setNewMemberEnableEmail] = useState(true);
  const [newMemberEnableWhatsapp, setNewMemberEnableWhatsapp] = useState(true);
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

  // Helper to block writes for observers
  const observerBlock = (msg?: string): boolean => {
    if (!isObserver) return false;
    setMeasMsg(msg || '⚠️ Modo Observador: no tienes permisos para realizar cambios.');
    setTimeout(() => setMeasMsg(''), 4000);
    return true;
  };

  const logClientAudit = async (operation: string, entity_type: string, entity_id: string, data?: any) => {
    if (!building) return;
    try {
      await supabase.from('audit_logs').insert({
        building_id: building.id,
        user_email: currentUser?.email || loginEmail || 'ADMIN',
        operation,
        entity_type,
        entity_id,
        data_after: data,
      });
      loadAuditLogs();
    } catch (e) {
      console.error('Error logging audit:', e);
    }
  };

  // ── WhatsApp Logic ────────────────────────────────────────────────────────
  const loadWhatsAppSettings = useCallback(async () => {
    if (!building) return;
    setWaLoading(true);
    const { data, error } = await supabase
      .from('building_whatsapp_settings')
      .select('*')
      .eq('building_id', building.id)
      .single();
    
    if (data) {
      setWaEnabled(data.is_enabled);
      setWaService(data.preferred_service);
      setWaThresholdCaution(Number(data.threshold_caution));
      setWaThresholdRationing(Number(data.threshold_rationing));
      setWaThresholdCritical(Number(data.threshold_critical));
      setWaJuntaPhones(data.junta_phones || '');
      setWaInstanceId(data.wa_instance_id || '');
      setWaApiToken(data.wa_api_token || '');
      setWaApiUrl(data.wa_api_url || '');
      setWaBusinessPhoneId(data.wa_business_phone_number_id || '');
      setWaDailyReportEnabled(data.daily_report_enabled || false);
      setWaDailyReportTime(data.daily_report_time || '19:00');
      setWaDailyReportDays(data.daily_report_days || '1,2,3,4,5,6,0');
    }
    setWaLoading(false);
  }, [building]);

  const saveWhatsAppSettings = async () => {
    if (!building) return;
    if (observerBlock()) return;
    if (demoBlock()) return;

    setWaLoading(true);
    const { error } = await supabase
      .from('building_whatsapp_settings')
      .upsert({
        building_id: building.id,
        is_enabled: waEnabled,
        preferred_service: waService,
        threshold_caution: waThresholdCaution,
        threshold_rationing: waThresholdRationing,
        threshold_critical: waThresholdCritical,
        junta_phones: waJuntaPhones,
        wa_instance_id: waInstanceId,
        wa_api_token: waApiToken,
        wa_api_url: waApiUrl,
        wa_business_phone_number_id: waBusinessPhoneId,
        daily_report_enabled: waDailyReportEnabled,
        daily_report_time: waDailyReportTime,
        daily_report_days: waDailyReportDays,
        updated_at: new Date().toISOString()
      });

    if (error) {
      setWaMsg('❌ Error al guardar: ' + error.message);
    } else {
      setWaMsg('✅ Configuración de WhatsApp y horario guardados');
      logClientAudit('UPDATE', 'whatsapp_settings', building.id, { service: waService, daily_enabled: waDailyReportEnabled });
      setTimeout(() => setWaMsg(''), 3000);
      loadWhatsAppSettings();
    }
    setWaLoading(false);
  };

  const handleTestWhatsApp = async () => {
    if (!building || !testPhone) return;
    if (observerBlock()) return;
    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_id: building.id,
          phone: testPhone,
          service: waService
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, msg: '¡Mensaje enviado con éxito!' });
      } else {
        setTestResult({ success: false, msg: data.error || 'Error desconocido' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message });
    }
    setTestLoading(false);
  };

  const loadAuditLogs = useCallback(async () => {
    if (!building) return;
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('building_id', building.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditLogs(data || []);
  }, [building]);

  const handleManualSendReport = async () => {
    if (!building || !manualRecipients) return;
    if (observerBlock()) return;
    setSendingManual(true);
    setManualMsg('');
    
    try {
      const res = await fetch('/api/measurements/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_id: building.id,
          recipients: manualRecipients.split(',').map(e => e.trim()),
          sender_email: currentUser?.email || 'ADMIN'
        })
      });
      const data = await res.json();
      if (data.success) {
        setManualMsg('✅ Reporte enviado con éxito');
        setManualRecipients('');
      } else {
        setManualMsg('❌ Error: ' + (data.error || 'No se pudo enviar'));
      }
    } catch (err: any) {
      setManualMsg('❌ Error: ' + err.message);
    }
    setSendingManual(false);
    loadAuditLogs();
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
      if (data) {
        setCfgName(data.name || '');
        setCfgCapacity(data.tank_capacity_liters?.toString() || '');
        setCfgAdminEmail(data.admin_email || '');
        
        // Cargar settings adicionales
        const { data: set } = await supabase.from('building_settings').select('*').eq('building_id', data.id).single();
        if (set) {
          setCfgThreshold(set.alert_threshold_percentage?.toString() || '30');
          setCfgSilenceStart(set.silence_start_time || '22:00');
          setCfgSilenceEnd(set.silence_end_time || '06:00');
          setCfgEnableResidentNotifications(set.enable_resident_notifications !== false);
        }
      }
      // Si viene con ?authed=1 desde el login de page.tsx, ya está autenticado
      if (searchParams.get('authed') === '1') {
        setAuthed(true);
        const urlEmail = searchParams.get('email');
        if (urlEmail) {
          setLoginEmail(urlEmail); // Pre-rellenar por si cierran sesión
          // Buscar si el email pertenece a un miembro de la junta para este edificio
          const { data: members } = await supabase
            .from('building_members')
            .select('*')
            .eq('building_id', data.id);
          
          if (members) {
            const member = members.find((m: any) => m.email.toLowerCase() === urlEmail.toLowerCase());
            if (member) {
              setCurrentUser(member);
            }
          }
        }
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

    const [{ data: ms }, { data: members }, { count: emailCount }] = await Promise.all([
      supabase.from('measurements').select('*').eq('building_id', measurementsQueryBuildingId)
        .order('recorded_at', { ascending: false }),
      supabase.from('building_members').select('*').eq('building_id', subscriptionsQueryBuildingId),
      supabase.from('notification_logs').select('*', { count: 'exact', head: true }).eq('building_id', subscriptionsQueryBuildingId).eq('success', true)
    ]);
    
    const sortedMs = (ms || []).slice().reverse();
    setMeasurements(sortedMs);

    // Calculate daily stats
    const today = new Date().toISOString().split('T')[0];
    const msToday = sortedMs.filter(m => m.recorded_at.startsWith(today)).length;
    const users = new Set(sortedMs.map(m => m.collaborator_name || m.email)).size;

    setStats({
      totalEmails: emailCount || 0,
      measurementsToday: msToday,
      activeUsers: users
    });

    const allMembers = members || [];
    setAllSubscribers(allMembers);
    // Mostrar todos los miembros sin filtrar para debugging y transparencia
    setJuntaMembers(allMembers);
  }, [building]);

  useEffect(() => { if (authed && building) loadData(); }, [authed, building, loadData]);

  useEffect(() => {
    if (tab === 'alarmas_logs') loadAuditLogs();
    if (tab === 'configuracion') loadWhatsAppSettings();
  }, [tab, loadAuditLogs, loadWhatsAppSettings]);

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
          logClientAudit('LOGIN', 'user', member.email);
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
  // Permisos: Admin real del edificio (o el admin central correojago)
  const isUserAdmin = !currentUser || currentUser.is_admin === true;
  const isObserver = currentUser?.role === 'Observador';

  // Helper para enmascarar email - Ahora siempre enmascara si NO es admin, o si es la pestaña Junta
  const getDisplayEmail = (email: string, forceMask = false) => {
    if (isUserAdmin && !isDemo && !forceMask) return email;
    return maskEmail(email);
  };

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
      lastDate: format(new Date(latest.recorded_at), 'dd/MM/yyyy hh:mm aa'),
      totalReadings: measurements.length,
      };

  })();

  // ── Junta CRUD ─────────────────────────────────────────────────────────────
  const addJuntaMember = async () => {
    if (observerBlock()) return;
    if (!newMemberEmail.trim()) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden agregar miembros en la cuenta de demostración.')) return;
    const memberEmail = newMemberEmail.trim().toLowerCase();
    const memberNameVal = newMemberName.trim() || null;
    
    setMemberMsg('⏳ Agregando miembro...');
    
    try {
      // Check if already exists as member
      const existing = allSubscribers.find(s => s.email.toLowerCase() === memberEmail);
      let error = null;

      if (existing) {
        // Update to mark as junta
        const { error: err } = await supabase.from('building_members')
          .update({ 
            name: memberNameVal, 
            role: newMemberRole || 'Vocal', 
            is_admin: newMemberIsAdmin,
            is_junta: true,
            enable_email: newMemberEnableEmail,
            enable_whatsapp: newMemberEnableWhatsapp
          })
          .eq('id', existing.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('building_members').insert({
          building_id: building.id,
          email: memberEmail,
          name: memberNameVal,
          role: newMemberRole || 'Vocal',
          is_admin: newMemberIsAdmin,
          is_junta: true,
          enable_email: newMemberEnableEmail,
          enable_whatsapp: newMemberEnableWhatsapp
        });
        error = err;
      }

      if (error) {
        console.error('Error in Supabase:', error);
        setMemberMsg('❌ Error BD: ' + error.message);
        return;
      }

      // Auditoría con email explícito
      logClientAudit('INSERT', 'junta_member', memberEmail, { name: memberNameVal, role: newMemberRole, email: memberEmail });

      // ENVIAR EMAIL DE BIENVENIDA (Implementación del workflow de EdifiSaaS_v1)
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'junta_welcome', 
            building: building, 
            member: { email: memberEmail, name: memberNameVal } 
          })
        });
      } catch (err) {
        console.error('Error enviando email de bienvenida:', err);
      }

      setNewMemberEmail(''); setNewMemberName(''); setNewMemberRole('Vocal'); setNewMemberIsAdmin(false);
      setShowAddMember(false);
      setMemberMsg('✅ Miembro agregado correctamente.');
      
      setTimeout(() => {
        setMemberMsg('');
        loadData(); // Recarga después de un momento para asegurar consistencia
      }, 1000);
      
      loadData(); // Recarga inmediata

      
    } catch (err: any) {
      setMemberMsg('❌ Error crítico: ' + err.message);
    }
  };

  const removeJuntaMember = async (member: JuntaMember) => {
    if (observerBlock()) return;
    if (!confirm(`¿Quitar a ${member.email} de la junta?\nDejará de recibir copias de los reportes.`)) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden eliminar miembros en la cuenta de demostración.')) return;
    await supabase.from('building_members')
      .delete()
      .eq('id', member.id);
    setMemberMsg('🗑️ Miembro removido de la junta');
    setTimeout(() => setMemberMsg(''), 3000);
    loadData();
  };

  const updateJuntaMember = async (member: any) => {
    if (!member) return;
    if (observerBlock()) { setEditingMember(null); return; }
    if (demoBlock('⚠️ Modo Demo: los cambios no se guardan en la base de datos.')) { setEditingMember(null); return; }
    const { error } = await supabase.from('building_members')
      .update({ 
        name: member.name, 
        role: member.role, 
        is_admin: member.is_admin,
        enable_email: member.enable_email !== false,
        enable_whatsapp: member.enable_whatsapp !== false
      })
      .eq('id', member.id);

    if (error) {
      setMemberMsg('❌ Error al actualizar: ' + error.message);
    } else {
      setEditingMember(null);
      setMemberMsg('✅ Datos actualizados correctamente');
      setTimeout(() => setMemberMsg(''), 3000);
      loadData();
    }
  };

  const saveEditMember = () => {
    if (editingMember) updateJuntaMember(editingMember);
  };

  // ── Reportes ───────────────────────────────────────────────────────────────
  const filteredMeasurements = (() => {
    let data = [...measurements].reverse(); // Mostrar más reciente primero en reportes
    if (reportFrom) data = data.filter(m => new Date(m.recorded_at) >= new Date(reportFrom));
    if (reportTo)   data = data.filter(m => new Date(m.recorded_at) <= new Date(reportTo + 'T23:59:59'));
    return data;
    })();

    const exportCSV = () => {
    if (filteredMeasurements.length === 0) {
      alert('No hay datos para exportar en el rango seleccionado.');
      return;
    }
    const rows = [
      ['Fecha/Hora', 'Litros', 'Porcentaje', 'Variacion (L)', 'Registrado por', 'Email'],
      ...filteredMeasurements.map(m => [
        format(new Date(m.recorded_at), 'dd/MM/yyyy HH:mm:ss'),
        Math.round(m.liters),
        Math.round(m.percentage) + '%',
        Math.round((m.variation_lts ?? m.variacion_lts ?? 0)),
        m.collaborator_name || 'Anonimo',
        m.email || '—',
      ])
    ];
    // Usar punto y coma (;) como separador para compatibilidad con Excel en español
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `reporte-${building?.slug}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    };

    const handleBulkDelete = async (mode: 'range' | 'all') => {
    if (!isUserAdmin) return;
    if (observerBlock()) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden realizar limpiezas de base de datos.')) return;

    const count = mode === 'all' ? measurements.length : filteredMeasurements.length;
    if (count === 0) {
      alert('No hay registros para eliminar.');
      return;
    }

    const confirmMsg = mode === 'all' 
      ? `🚨 ¡ADVERTENCIA CRÍTICA!\n\nEstás a punto de ELIMINAR TODOS los registros (${count}) del edificio.\n\nEsta acción NO se puede deshacer.\n\n¿Deseas continuar?`
      : `⚠️ ¿Eliminar los ${count} registros del rango seleccionado?\n\nEsta acción no se puede deshacer.`;

    if (!confirm(confirmMsg)) return;
    if (mode === 'all' && !confirm('¿Estás COMPLETAMENTE SEGURO?')) return;

    setDeletingBulk(true);
    setMeasMsg('⏳ Limpiando base de datos...');

    try {
      let query = supabase.from('measurements').delete().eq('building_id', building.id);
      if (mode === 'range') {
        if (reportFrom) query = query.gte('recorded_at', reportFrom);
        if (reportTo)   query = query.lte('recorded_at', reportTo + 'T23:59:59');
      }

      const { error } = await query;
      if (error) throw error;

      // Registro de auditoría manual (compatible con cliente)
      await supabase.from('audit_logs').insert([{
        building_id: building.id,
        user_email: currentUser?.email || loginEmail || 'ADMIN',
        operation: 'SECURITY',
        entity_type: 'measurement_cleanup',
        data_after: { mode, count_deleted: count, from: reportFrom, to: reportTo },
        status: 'SUCCESS'
      }]);

      setMeasMsg(`✅ Limpieza exitosa: ${count} registros eliminados`);
      setTimeout(() => setMeasMsg(''), 5000);
      loadData();
    } catch (err: any) {
      setMeasMsg('❌ Error: ' + err.message);
    } finally {
      setDeletingBulk(false);
    }
    };
  // ── Mediciones CRUD ───────────────────────────────────────────────────────
  const startEditMeasurement = (m: any) => {
    setEditingMeasurement(m);
    setEditLiters(String(Math.round(m.liters)));
    setEditPct(String(m.percentage.toFixed(1)));
  };

  const saveEditMeasurement = async () => {
    if (!editingMeasurement) return;
    if (observerBlock()) { setEditingMeasurement(null); return; }
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
    if (observerBlock()) return;
    if (!confirm('¿Eliminar esta medición? Esta acción no se puede deshacer.')) return;
    if (demoBlock('⚠️ Modo Demo: no se pueden eliminar registros en la cuenta de demostración.')) return;

    // Guardamos estado previo por si falla el servidor
    const previousMeasurements = [...measurements];
    
    try {
      // Actualización optimista: removemos del estado local inmediatamente para que el usuario vea el cambio
      setMeasurements(prev => prev.filter(m => m.id !== id));
      
      const response = await fetch(`/api/measurements/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMeasMsg('🗑️ Medición eliminada correctamente');
        setTimeout(() => setMeasMsg(''), 3000);
        // Refrescamos datos para asegurar que los cálculos (caudal, etc) se actualicen con el nuevo historial
        loadData();
      } else {
        throw new Error(result.error || 'Error desconocido al eliminar');
      }
    } catch (err: any) {
      // Revertimos el cambio visual si hubo error en el servidor
      setMeasurements(previousMeasurements);
      console.error('[DELETE_FAIL] ❌ Error:', err.message);
      setMeasMsg('❌ Error al eliminar: ' + err.message);
      setTimeout(() => setMeasMsg(''), 5000);
    }
  };

  const markAnomalyReviewed = async (id: string) => {
    if (observerBlock()) return;
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
    if (observerBlock()) { setEditingConfig(false); return; }
    if (demoBlock('⚠️ Modo Demo: la configuración no se guarda en la cuenta de demostración.')) { setEditingConfig(false); return; }
    const { error } = await supabase.from('buildings').update({
      name:                 cfgName,
      tank_capacity_liters: parseInt(cfgCapacity) || 169000,
      admin_email:          cfgAdminEmail,
    }).eq('id', building.id);
    if (!error) {
      setCfgMsg('✅ Configuración guardada');
      setEditingConfig(false);
      logClientAudit('UPDATE', 'building_config', building.id, { name: cfgName });
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
    if (!file || !building) {
      console.log('DEBUG BANNER: Falta archivo o datos del edificio', { file, buildingId: building?.id });
      return;
    }
    if (observerBlock()) return;
    if (demoBlock('⚠️ Modo Demo: no se puede subir banner.')) return;
    if (file.size > 2 * 1024 * 1024) { setBannerMsg('❌ La imagen debe ser menor a 2MB'); return; }

    setBannerUploading(true);
    setBannerMsg('📤 Subiendo imagen...');
    console.log('DEBUG BANNER: Iniciando subida...', { name: file.name, size: file.size, type: file.type });

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${building.id}.${extension}`;
      const filePath = `banners/${fileName}`;
      
      // 1. Subida a Storage (Sigue siendo en cliente)
      const { error: uploadError } = await supabase.storage
        .from('building-banners')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

        // 2. Construcción de URL Pública usando método oficial del SDK (garantiza formato correcto)
        const { data: { publicUrl } } = supabase.storage
          .from("building-banners")
          .getPublicUrl(filePath);

       // 3. Guardar en Base de Datos vía API (Para logs en Vercel y Alertas)
       const response = await fetch('/api/buildings/banner', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           building_id: building.id,
           banner_url: publicUrl,
           file_path: filePath,
           user_email: currentUser?.email
         })
       });

       const result = await response.json();

       if (!response.ok) {
         throw new Error(result.error || 'Error al guardar el banner en la base de datos');
       }

       // 4. Actualizar estado local con la URL retornada por el servidor
       //    (el servidor regenera la URL oficial para asegurar formato correcto)
       const nuevoUrl = result.data?.banner_url || publicUrl;
       const updatedBuilding = { ...building, banner_url: nuevoUrl };
       setBuilding(updatedBuilding);
       
       // Opcional: recargar desde BD para máxima coherencia
       const { data: reloaded } = await supabase
         .from('buildings')
         .select('*')
         .eq('id', building.id)
         .single();
       if (reloaded) setBuilding(reloaded);
      
      setBannerMsg('✅ Banner actualizado correctamente');

    } catch (e: any) {
      console.error('DEBUG BANNER: ERROR CRÍTICO', e);
      setBannerMsg('❌ Error: ' + e.message);
    } finally {
      setBannerUploading(false);
      setTimeout(() => setBannerMsg(''), 5000);
    }
  };

  const removeBanner = async () => {
    if (!confirm('¿Eliminar el banner actual?')) return;
    if (observerBlock()) return;
    if (demoBlock('⚠️ Modo Demo: no se puede eliminar el banner en la cuenta de demostración.')) return;
    await supabase.from('buildings').update({ banner_url: null }).eq('id', building.id);
    setBuilding({ ...building, banner_url: null });
    setBannerMsg('🗑️ Banner eliminado');
    logClientAudit('DELETE', 'banner', building.id);
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
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">{building.name}</h1>
              <p className="text-slate-400 text-[10px]">Panel Administrativo — Junta de Condominio</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 md:gap-4 flex-1">
            <div className="flex items-center gap-3">
              <a 
                href={`/edificio/${building.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95"
              >
                <Droplets className="w-4 h-4" />
                <span>Ir al Formulario de Entrada</span>
              </a>
              <button 
                onClick={() => setShowHelpModal(true)}
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-bold transition-colors text-xs"
              >
                <Info className="w-4 h-4" /> Ayuda ?
              </button>
              <button onClick={loadData} className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700 hidden lg:block" />

            <div className="hidden lg:flex items-center gap-3">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-bold uppercase text-[10px] text-slate-300 tracking-wider">
                    {currentUser ? currentUser.name : 'Admin Principal'}
                  </span>
                  <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 font-medium">{currentUser?.role || 'S.Admin'}</span>
                </div>
                <span className="text-[10px] text-slate-500 italic max-w-[150px] truncate">{loginEmail || building?.admin_email}</span>
              </div>
              <button onClick={() => {
                sessionStorage.clear();
                setAuthed(false);
                router.push('/');
              }} className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/5 transition-all" title="Cerrar Sesión">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Menu Strip */}
      <div className="bg-slate-800 border-b border-slate-700 shadow-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex gap-2 px-4 overflow-x-auto scrollbar-hide py-3">
          {([
            { id: 'dashboard',     label: 'Dashboard',     Icon: BarChart3,     color: 'blue' },
            { id: 'junta',         label: 'Mi Junta',      Icon: Users,        color: 'purple' },
            { id: 'mediciones',    label: 'Mediciones',    Icon: Activity,     color: 'amber' },
            { id: 'reportes',      label: 'Estadísticas y Reportes', Icon: FileText, color: 'green' },
            isUserAdmin ? { id: 'alarmas_logs',  label: 'Alarmas/Logs',  Icon: ClipboardList, color: 'slate' } : null,
            { id: 'configuracion', label: 'Config.',       Icon: Settings,      color: 'cyan' },
          ].filter(Boolean) as { id: Tab; label: string; Icon: any; color: string }[]).map(({ id, label, Icon, color }) => (
            <button 
              key={id} 
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                tab === id
                  ? `bg-white text-blue-700 ring-2 ring-blue-500/20 shadow-blue-500/10`
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/50'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${tab === id ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="uppercase tracking-wider">{label}</span>
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
                    {/* Fila Principal: Nivel y Caudal Llenado/Consumo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <StatusIndicator percentage={kpis?.currentPct ?? 0} />
                      <FlowComparisonChart data={measurements} />
                    </div>

                    {/* Cuadrícula de todos los gráficos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <CombinedTrendChart data={measurements} />
                      <ThresholdsChart data={measurements} capacity={building?.tank_capacity_liters ?? 169000} />
                      
                      <LastWeeksTrendChart data={measurements} />
                      <WeeklyComparisonChart data={measurements} />
                      
                      <DayOfWeekConsumptionChart data={measurements} />
                      <MonthlyHistoryChart data={measurements} />
                      
                      <HourlyConsumptionChart data={measurements} />
                      <NightlyConsumptionChart data={measurements} />

                      <WeekendConsumptionChart data={measurements} />
                      <WeekendLitrosChart data={measurements} />

                      <FlowHourlyChart data={measurements} />
                      <VariationChart data={measurements} />

                      <ProjectionChart data={measurements} capacity={building?.tank_capacity_liters ?? 169000} />
                      <ConsumptionDistributionPieChart data={measurements} />
                    </div>

                    {/* Mapa de Calor */}
                    <ConsumptionHeatmap data={measurements} />
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
                            {format(new Date(m.recorded_at), 'dd/MM/yyyy hh:mm aa')}
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
                    <p className="text-slate-500 text-xs">{format(new Date(min.recorded_at), 'dd/MM/yyyy hh:mm aa')}</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                    <p className="text-slate-400 text-xs mb-2">📈 Máximo histórico</p>
                    <p className="text-green-400 font-bold text-2xl">{Math.round(max.percentage)}%</p>
                    <p className="text-slate-500 text-xs">{format(new Date(max.recorded_at), 'dd/MM/yyyy hh:mm aa')}</p>
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
                    Al agregar un miembro, se le enviará automáticamente un email de bienvenida con su clave temporal (123456) e instrucciones de acceso.
                    {isObserver ? (
                      <span className="text-amber-400 ml-2">(Modo Observador: no puedes realizar cambios)</span>
                    ) : (
                      currentUser && !isUserAdmin && <span className="text-amber-400 ml-2">(Solo administradores pueden agregar/remover)</span>
                    )}
                  </p>
                </div>
                {isUserAdmin && !isObserver && (
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
                      {['Presidente','Vice-presidente','Secretario/a','Tesorero/a','Vocal','Síndico/a','Observador'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 mb-3">
                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex-1">
                      <input
                        type="checkbox"
                        id="newMemberEnableEmail"
                        checked={newMemberEnableEmail}
                        onChange={e => setNewMemberEnableEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="newMemberEnableEmail" className="text-sm text-blue-300 flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Recibir Emails
                      </label>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex-1">
                      <input
                        type="checkbox"
                        id="newMemberEnableWhatsapp"
                        checked={newMemberEnableWhatsapp}
                        onChange={e => setNewMemberEnableWhatsapp(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-green-500 focus:ring-green-500"
                      />
                      <label htmlFor="newMemberEnableWhatsapp" className="text-sm text-green-300 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Recibir WhatsApp
                      </label>
                    </div>
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
                      {['Miembro','Cargo','Rol','Notificaciones','Emails','Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {juntaMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-700/20">
                        {editingMember?.id === m.id ? (
                          <>
                            <td className="px-4 py-3">
                              <p className="text-white font-medium text-xs">{getDisplayEmail(m.email, true)}</p>
                              <input type="text" value={editingMember.name || ''} onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                                className="mt-1 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs w-full" placeholder="Nombre" />
                            </td>
                            <td className="px-4 py-3">
                              <select value={editingMember.role || 'Vocal'} onChange={e => setEditingMember({...editingMember, role: e.target.value})}
                                className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs">
                                {['Presidente','Vice-presidente','Secretario/a','Tesorero/a','Vocal','Síndico/a','Observador'].map(r => (
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
                                  className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-purple-500"
                                />
                                <span className={editingMember.is_admin ? "text-purple-400 font-medium" : "text-slate-500"}>
                                  {editingMember.is_admin ? "Admin" : "Miembro"}
                                </span>
                              </label>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setEditingMember({...editingMember, enable_email: !(editingMember.enable_email !== false)})}
                                  className={`p-1.5 rounded border transition-all ${editingMember.enable_email !== false ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}
                                  title="Recibir Emails"
                                >
                                  <Mail className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => setEditingMember({...editingMember, enable_whatsapp: !(editingMember.enable_whatsapp !== false)})}
                                  className={`p-1.5 rounded border transition-all ${editingMember.enable_whatsapp !== false ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-600'}`}
                                  title="Recibir WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">Ilimitado</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => updateJuntaMember(editingMember)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-all"><Save className="w-4 h-4" /></button>
                                <button onClick={() => setEditingMember(null)} className="p-1.5 text-slate-400 hover:bg-slate-600 rounded transition-all"><X className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <p className="text-white font-medium text-xs">{m.name || 'Sin nombre'}</p>
                              <p className="text-slate-500 text-[10px]">{getDisplayEmail(m.email, true)}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{m.role || 'Vocal'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.is_admin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-700 text-slate-400'}`}>
                                {m.is_admin ? 'Admin' : 'Miembro'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <div className={`p-1.5 rounded border ${m.enable_email !== false ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-600 grayscale'}`}>
                                  <Mail className="w-3 h-3" />
                                </div>
                                <div className={`p-1.5 rounded border ${m.enable_whatsapp !== false ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-slate-800 border-slate-700 text-slate-600 grayscale'}`}>
                                  <MessageSquare className="w-3 h-3" />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-green-400 text-xs font-medium">∞ Ilimitado</td>
                            <td className="px-4 py-3">
                              {isUserAdmin && !isObserver && (
                                <div className="flex gap-1">
                                  <button onClick={() => setEditingMember(m)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-all"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => removeJuntaMember(m)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
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
          <div className="space-y-6">
            {/* Encabezado de Estadísticas de Operación */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Estadísticas de Operación</h2>
                <p className="text-slate-400 text-sm">Monitoreo de actividad y rendimiento del sistema AquaSaaS</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadData} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                  <RefreshCw className="w-3.5 h-3.5" /> Actualizar Datos
                </button>
              </div>
            </div>

            {/* Tarjetas de Resumen Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Emails Enviados</p>
                  <p className="text-2xl font-bold text-white">{stats.totalEmails.toLocaleString()}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">Éxito en notificaciones</p>
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Mediciones Totales</p>
                  <p className="text-2xl font-bold text-white">{measurements.length}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">Histórico del edificio</p>
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Colaboradores</p>
                  <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">Han reportado al menos una vez</p>
                </div>
              </div>
            </div>

            {/* Bloque Principal de Gráficos de Sistema */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico 1: Participación por Colaborador */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Participación de la Comunidad
                  </h3>
                </div>
                <UserParticipationPieChart measurements={measurements} />
                <p className="text-[10px] text-slate-500 mt-4 text-center italic">Distribución porcentual de quién reporta más mediciones.</p>
              </div>

              {/* Gráfico 2: Volumen Mensual de Mediciones */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                    Actividad de Registro Mensual
                  </h3>
                </div>
                <MonthlyReportsBarChart measurements={measurements} />
                <p className="text-[10px] text-slate-500 mt-4 text-center italic">Cantidad total de mediciones registradas cada mes (último año).</p>
              </div>

              {/* Gráfico 3: Emails Diarios (Ultimos 30 días) */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-400" />
                    Volumen de Notificaciones Enviadas (Últimos 30 días)
                  </h3>
                </div>
                <DailyEmailsBarChart logs={auditLogs} />
                <p className="text-[10px] text-slate-500 mt-4 text-center italic">Cantidad de correos electrónicos de reporte enviados exitosamente cada día.</p>
              </div>
            </div>

            {/* Sección de Filtros y Herramientas */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-lg space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Herramientas de Datos y Filtros
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setReportFrom(''); setReportTo(''); setShowPreview(false); }}
                    className="text-[10px] text-slate-500 hover:text-white underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-1 text-balance">
                    <Calendar className="w-3 h-3" /> Rango Desde (dd/mm/aaaa)
                  </label>
                  <input 
                    type="date" 
                    value={reportFrom} 
                    onChange={e => setReportFrom(e.target.value)}
                    lang="es-ES"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none" 
                    style={{ colorScheme: 'dark' }} 
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-1 text-balance">
                    <Calendar className="w-3 h-3" /> Rango Hasta (dd/mm/aaaa)
                  </label>
                  <input 
                    type="date" 
                    value={reportTo} 
                    onChange={e => setReportTo(e.target.value)}
                    lang="es-ES"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
                    style={{ colorScheme: 'dark' }} 
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={() => setShowPreview(!showPreview)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${showPreview ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Ocultar' : 'Visualizar'}
                  </button>
                  <button onClick={exportCSV}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-all">
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                </div>
                
                {/* Nueva sección: Limpieza (Solo Admin) */}
                <div className="flex items-end border-l border-slate-700 pl-6">
                  {isUserAdmin && (
                    <div className="w-full space-y-2">
                      <p className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Zona de Limpieza
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleBulkDelete('range')}
                          disabled={deletingBulk || (!reportFrom && !reportTo)}
                          className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-900/30 py-2 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30"
                          title="Borrar solo el rango seleccionado"
                        >
                          Borrar Rango
                        </button>
                        <button 
                          onClick={() => handleBulkDelete('all')}
                          disabled={deletingBulk}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-[11px] font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                          title="BORRAR TODO EL HISTORIAL"
                        >
                          BORRAR TODO
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Previsualización de Datos */}
              {showPreview && (
                <div className="mt-6 border-t border-slate-700 pt-6 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white text-xs font-bold uppercase tracking-widest">Previsualización de Registros ({filteredMeasurements.length})</h4>
                    <p className="text-[10px] text-slate-500 italic">Mostrando registros según el filtro aplicado</p>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] border border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 sticky top-0 border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-slate-400 font-medium">Fecha/Hora</th>
                          <th className="px-4 py-3 text-slate-400 font-medium text-right">Liters</th>
                          <th className="px-4 py-3 text-slate-400 font-medium text-right">%</th>
                          <th className="px-4 py-3 text-slate-400 font-medium text-right">Variación</th>
                          <th className="px-4 py-3 text-slate-400 font-medium">Reportado por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredMeasurements.map(m => (
                          <tr key={m.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-2.5 text-slate-300">{format(new Date(m.recorded_at), 'dd/MM/yyyy HH:mm:ss')}</td>
                            <td className="px-4 py-2.5 text-white font-mono text-right">{Math.round(m.liters).toLocaleString()} L</td>
                            <td className="px-4 py-2.5 text-blue-400 font-bold text-right">{Math.round(m.percentage)}%</td>
                            <td className={`px-4 py-2.5 text-right font-mono ${ (m.variation_lts ?? m.variacion_lts ?? 0) >= 0 ? 'text-green-400' : 'text-red-400' }`}>
                              { (m.variation_lts ?? m.variacion_lts ?? 0) > 0 ? '+' : '' }{ Math.round(m.variation_lts ?? m.variacion_lts ?? 0) }
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{m.collaborator_name || 'Anónimo'}</td>
                          </tr>
                        ))}
                        {filteredMeasurements.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic">No hay datos que coincidan con el rango seleccionado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                          <td className="px-4 py-2 text-slate-300 whitespace-nowrap">{format(new Date(m.recorded_at), 'dd/MM/yyyy hh:mm aa')}</td>
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
                              {format(new Date(m.recorded_at), 'dd/MM/yyyy hh:mm aa')}
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
                              {isUserAdmin && !isObserver && (
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
                              )}
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

            {/* Envío Manual de Reporte (Movido desde Bitácora) */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 border-b border-slate-700 bg-blue-500/5">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  Envío Manual de Reporte
                </h3>
                <p className="text-slate-400 text-xs mt-1">Envía la situación actual del agua por correo electrónico sin registrar nuevos datos.</p>
              </div>
              <div className="p-5">
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                    value={manualRecipients}
                    onChange={e => setManualRecipients(e.target.value)}
                    placeholder="correos@ejemplo.com, otro@ejemplo.com"
                    className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={handleManualSendReport}
                    disabled={sendingManual || !manualRecipients}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {sendingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Enviar Reporte Ahora
                  </button>
                </div>
                {manualMsg && (
                  <div className={`mt-3 p-3 rounded-lg text-xs font-medium ${manualMsg.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {manualMsg}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => setManualRecipients(currentUser?.email || '')}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                  >
                    Ponerme a mí mismo
                  </button>
                  <span className="text-slate-700">|</span>
                  <button 
                    onClick={() => setManualRecipients(juntaMembers.map(m => m.email).join(', '))}
                    className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                  >
                    Toda la junta
                  </button>
                </div>
              </div>
            </div>

            {/* Reporte Diario Programado (Habilitado para toda la junta en modo lectura) */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 border-b border-slate-700 bg-amber-500/5">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    Reporte Diario Programado
                  </h3>
                  <div className={`flex items-center gap-2 bg-slate-700 p-1 rounded-lg ${!isUserAdmin && 'opacity-50'}`}>
                    <button 
                      onClick={() => isUserAdmin && setWaDailyReportEnabled(true)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${waDailyReportEnabled ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                      disabled={!isUserAdmin}
                    >ACTIVADO</button>
                    <button 
                      onClick={() => isUserAdmin && setWaDailyReportEnabled(false)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${!waDailyReportEnabled ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
                      disabled={!isUserAdmin}
                    >DESACTIVADO</button>
                  </div>
                </div>
                <p className="text-slate-400 text-xs mt-1">Envía automáticamente un resumen de la situación a la junta en el horario establecido.</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-slate-500 text-[10px] mb-1 font-bold">HORA DE ENVÍO (24H)</label>
                  <input type="time" value={waDailyReportTime} onChange={e => isUserAdmin && setWaDailyReportTime(e.target.value)}
                    disabled={!isUserAdmin || !waDailyReportEnabled}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-lg font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] mb-1 font-bold">DÍAS DE SEMANA (0-6)</label>
                  <div className="flex gap-1 mt-1">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => {
                      const isSelected = waDailyReportDays.split(',').includes(i.toString());
                      return (
                        <button key={i} disabled={!isUserAdmin || !waDailyReportEnabled}
                          onClick={() => {
                            const days = waDailyReportDays.split(',').filter(x => x !== '');
                            const newDays = isSelected ? days.filter(x => x !== i.toString()) : [...days, i.toString()];
                            setWaDailyReportDays(newDays.join(','));
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-500'}`}
                        >{d}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {isUserAdmin && (
                <div className="px-5 py-3 bg-slate-900/30 border-t border-slate-700 text-right">
                  <button onClick={saveWhatsAppSettings} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ml-auto shadow-lg">
                    <Save className="w-3.5 h-3.5" /> Guardar Horario
                  </button>
                </div>
              )}
            </div>
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
                    <div className="rounded-xl overflow-hidden border border-slate-600 bg-slate-700" style={{minHeight: '100px', maxHeight: '200px'}}>
                        <img 
                          src={building.banner_url} 
                          alt="Banner" 
                          className="w-full object-cover" 
                          style={{maxHeight: '200px', display: 'block'}} 
                          key={building.banner_url}
                          onError={(e) => {
                            // Si falla la carga normal, intentamos añadir un timestamp para forzar
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('force=')) {
                              target.src = `${building.banner_url}?force=${Date.now()}`;
                            }
                          }}
                        />
                    </div>
                    {isUserAdmin && (
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
                    )}
                  </div>
                ) : (
                  isUserAdmin ? (
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-8 cursor-pointer transition-colors hover:border-blue-500 hover:bg-blue-500/5 ${bannerUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-slate-300 font-medium">
                      {bannerUploading ? 'Subiendo...' : 'Haz clic para subir el banner'}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">1200×300px recomendado · máx 2MB</p>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
                  </label>
                  ) : (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-8 opacity-50">
                      <Image className="w-10 h-10 text-slate-500 mb-3" />
                      <p className="text-slate-300 font-medium italic">Sin banner personalizado</p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Datos del edificio */}
            {isUserAdmin && (
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
            )}

            {/* Configuración de WhatsApp */}
            {isUserAdmin && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center bg-green-500/5">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  Alertas de WhatsApp
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={waEnabled} onChange={e => setWaEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-300">{waEnabled ? 'Activado' : 'Desactivado'}</span>
                </label>
              </div>
              
              <div className={`p-5 space-y-6 transition-opacity ${!waEnabled ? 'opacity-50 grayscale' : ''}`}>
                {waMsg && <div className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm">{waMsg}</div>}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Servicio y Ayuda */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">¿Qué servicio de WhatsApp usará?</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => waEnabled && setWaService('GREENAPI')}
                          disabled={!waEnabled}
                          className={`px-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${waService === 'GREENAPI' ? 'bg-green-600 border-green-500 text-white shadow-lg' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                        >
                          GREEN API
                          <span className="block text-[9px] font-normal opacity-70">Rápido</span>
                        </button>
                        <button 
                          onClick={() => waEnabled && setWaService('WHAPI')}
                          disabled={!waEnabled}
                          className={`px-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${waService === 'WHAPI' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                        >
                          WHAPI
                          <span className="block text-[9px] font-normal opacity-70">Estable</span>
                        </button>
                        <button 
                          onClick={() => waEnabled && setWaService('BUSINESS')}
                          disabled={!waEnabled}
                          className={`px-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${waService === 'BUSINESS' ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
                        >
                          BUSINESS
                          <span className="block text-[9px] font-normal opacity-70">Oficial</span>
                        </button>
                      </div>
                    </div>

                    {/* Bloque de Ayuda Amigable */}
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 space-y-3">
                      <div className="flex items-center gap-2 text-blue-400">
                        <Wrench className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase">Instrucciones de configuración</h4>
                      </div>
                      
                      {waService === 'GREENAPI' && (
                        <div className="text-[11px] text-slate-400 space-y-2">
                          <p>1. Crea una cuenta en <a href="https://green-api.com" target="_blank" className="text-blue-400 underline">green-api.com</a>.</p>
                          <p>2. Escanea el código QR con tu WhatsApp en la consola.</p>
                          <p>3. Copia el <strong className="text-white">ID de Instancia</strong> (número largo) y el <strong className="text-white">API Token</strong>.</p>
                        </div>
                      )}
                      {waService === 'WHAPI' && (
                        <div className="text-[11px] text-slate-400 space-y-2">
                          <p>1. Crea una cuenta en <a href="https://whapi.cloud" target="_blank" className="text-blue-400 underline">whapi.cloud</a>.</p>
                          <p>2. Vincula tu número escaneando el QR.</p>
                          <p>3. Copia el <strong className="text-white">API Token</strong> desde tu canal creado.</p>
                        </div>
                      )}
                      {waService === 'BUSINESS' && (
                        <div className="text-[11px] text-slate-400 space-y-2">
                          <p>1. Usa tu cuenta de <a href="https://developers.facebook.com" target="_blank" className="text-blue-400 underline">Meta for Developers</a>.</p>
                          <p>2. Configura tu App de WhatsApp Business.</p>
                          <p>3. Necesitarás el <strong className="text-white">Phone Number ID</strong> y un <strong className="text-white">Token de Acceso Permanente</strong>.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campos de Configuración */}
                  <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 space-y-4">
                    <h4 className="text-white text-xs font-bold uppercase flex items-center gap-2 mb-2">
                      <Settings className="w-3 h-3 text-cyan-400" />
                      Ingresa tus credenciales
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {waService === 'GREENAPI' && (
                        <div>
                          <label className="block text-slate-500 text-[10px] mb-1 font-bold">ID DE INSTANCIA</label>
                          <input value={waInstanceId} onChange={e => setWaInstanceId(e.target.value)}
                            disabled={!waEnabled} placeholder="Ej: 7107580078"
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-green-500" />
                        </div>
                      )}
                      
                      {waService === 'BUSINESS' && (
                        <div>
                          <label className="block text-slate-500 text-[10px] mb-1 font-bold">PHONE NUMBER ID</label>
                          <input value={waBusinessPhoneId} onChange={e => setWaBusinessPhoneId(e.target.value)}
                            disabled={!waEnabled} placeholder="ID numérico de Meta"
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500" />
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-500 text-[10px] mb-1 font-bold">API TOKEN / ACCESS TOKEN</label>
                        <input type="password" value={waApiToken} onChange={e => setWaApiToken(e.target.value)}
                          disabled={!waEnabled} placeholder="Pega aquí el código largo (token)"
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                      </div>

                      {waService !== 'BUSINESS' && (
                        <div>
                          <label className="block text-slate-500 text-[10px] mb-1 font-bold">URL DE LA API (OPCIONAL)</label>
                          <input value={waApiUrl} onChange={e => setWaApiUrl(e.target.value)}
                            disabled={!waEnabled} placeholder="Solo si usas un servidor propio"
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Destinatarios y Prueba */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-700 pt-6">
                  <div className="space-y-2">
                    <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">Números de la Junta (Alertas Reales)</label>
                    <textarea 
                      value={waJuntaPhones}
                      onChange={e => setWaJuntaPhones(e.target.value)}
                      disabled={!waEnabled}
                      placeholder="Ej: 584161234567, 584127654321"
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 min-h-[80px]"
                    />
                    <p className="text-[10px] text-slate-500 italic">Separa los números con comas. Deben tener el código de país al inicio.</p>
                  </div>

                  <div className="bg-blue-600/5 border border-blue-500/20 p-5 rounded-2xl space-y-4">
                    <h4 className="text-blue-400 text-xs font-bold uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Verificar Configuración
                    </h4>
                    <p className="text-[10px] text-slate-400">Escribe tu número abajo para enviar un mensaje de prueba ahora mismo.</p>
                    <div className="flex gap-2">
                      <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                        disabled={!waEnabled || testLoading} placeholder="Tu número (Ej: 58414123...)"
                        className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                      <button 
                        onClick={handleTestWhatsApp}
                        disabled={!waEnabled || !testPhone || testLoading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95"
                      >
                        {testLoading ? '...' : 'Enviar'}
                      </button>
                    </div>
                    {testResult && (
                      <div className={`p-3 rounded-lg text-xs font-medium text-center ${testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {testResult.msg}
                      </div>
                    )}
                  </div>
                </div>

                {/* Umbrales */}
                <div className="space-y-4">
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">Umbrales de Alerta (Porcentaje)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-1">🟡 Precaución</p>
                      <div className="flex items-center gap-2">
                        <input type="number" value={waThresholdCaution} onChange={e => setWaThresholdCaution(Number(e.target.value))}
                          disabled={!waEnabled} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-xl font-bold focus:outline-none" />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-orange-400 text-xs font-bold mb-2 flex items-center gap-1">🟠 Racionamiento</p>
                      <div className="flex items-center gap-2">
                        <input type="number" value={waThresholdRationing} onChange={e => setWaThresholdRationing(Number(e.target.value))}
                          disabled={!waEnabled} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-xl font-bold focus:outline-none" />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-700">
                      <p className="text-red-400 text-xs font-bold mb-2 flex items-center gap-1">🔴 Crítico</p>
                      <div className="flex items-center gap-2">
                        <input type="number" value={waThresholdCritical} onChange={e => setWaThresholdCritical(Number(e.target.value))}
                          disabled={!waEnabled} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-xl font-bold focus:outline-none" />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    onClick={saveWhatsAppSettings}
                    disabled={waLoading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                  >
                    {waLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Configuración de WhatsApp
                  </button>
                </div>
              </div>
            </div>
            )}
            </div>
            )}

            {/* ── ALARMAS/LOGS TAB ─────────────────────────────────────────────── */}
            {tab === 'alarmas_logs' && (
            <div className="space-y-6">
            
            {/* Tabla de Logs de Auditoría */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  Historial de Eventos del Sistema
                </h3>
                <button onClick={loadAuditLogs} className="text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      {['Fecha/Hora', 'Operación', 'Usuario', 'Tipo Entidad', 'Resultado/Mensaje'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-slate-400 uppercase font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {auditLogs.map((log) => {
                      const isSuccess = log.operation === 'SUCCESS' || log.operation === 'INSERT';
                      const isError = log.operation === 'ERROR' || log.status === 'ERROR';
                      const isWarning = log.operation === 'WARNING';
                      const isInfo = log.operation === 'INFO';

                      return (
                        <tr key={log.id} className="hover:bg-slate-700/20">
                          <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSuccess ? 'bg-green-500/10 text-green-400' :
                              isError ? 'bg-red-500/10 text-red-400' :
                              isWarning ? 'bg-amber-500/10 text-amber-400' : 
                              isInfo ? 'bg-blue-500/10 text-blue-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {log.operation}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]" title={log.user_email}>
                            {log.user_email === 'SYSTEM' ? '⚙️ Sistema' : log.user_email}
                          </td>
                          <td className="px-4 py-3 text-slate-500 uppercase tracking-tighter">
                            {log.entity_type}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            <div className="truncate max-w-[300px]" title={JSON.stringify(log.data_after)}>
                              {log.data_after?.message || log.data_after?.error || JSON.stringify(log.data_after)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-600 italic">
                          No hay eventos registrados recientemente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE AYUDA SISTEMA (VERSIÓN COMPLETA PROFESIONAL) */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-300">
          <div className="bg-[#f7f6f2] w-full md:max-w-5xl h-full md:max-h-[95vh] md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-white/20">
            {/* Header del Modal */}
            <div className="bg-gradient-to-br from-[#04342C] via-[#0F6E56] to-[#1D9E75] p-6 md:p-10 shrink-0 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='12'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
               <div className="flex justify-between items-start relative z-10">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-[11px] px-3 py-1 rounded-full mb-6 font-bold uppercase tracking-wider">
                      💧 Gestión inteligente del agua
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight">Guía de Ayuda<br/>AquaSaaS</h2>
                    <p className="text-white/70 text-base mt-4 max-w-xl leading-relaxed font-medium">Todo lo que necesitas saber para gestionar el consumo de agua de tu edificio de forma inteligente, transparente y colaborativa.</p>
                  </div>
                  <button onClick={() => setShowHelpModal(false)} className="bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-all border border-white/25 shadow-xl active:scale-90">
                    <X className="w-6 h-6" />
                  </button>
               </div>
            </div>

            {/* Cuerpo del Modal (Navegable y completo) */}
            <div className="p-6 md:p-10 overflow-y-auto space-y-20 custom-scrollbar bg-[#f7f6f2] text-[#2C2C2A] flex-1">
              
              {/* SECCIÓN 1: CÓMO FUNCIONA */}
              <section id="help-como-funciona" className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#E1F5EE] border border-[#9FE1CB] rounded-2xl flex items-center justify-center text-3xl shadow-sm">⚙️</div>
                   <div>
                     <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#04342C]">¿Cómo funciona el sistema?</h3>
                     <p className="text-sm text-[#5F5E5A] font-medium italic">AquaSaaS es una plataforma de gestión colaborativa para comunidades inteligentes.</p>
                   </div>
                </div>

                <div className="bg-[#E6F1FB] border border-[#B5D4F4] p-5 rounded-2xl flex gap-4 items-start text-sm md:text-base text-[#0C447C] shadow-sm leading-relaxed">
                   <span className="text-2xl">ℹ️</span>
                   <p>AquaSaaS centraliza las mediciones de consumo reportadas por los residentes y las presenta en paneles de control detallados para administradores y miembros de la junta, generando informes automáticos por email en tiempo real.</p>
                </div>

                {/* Grid de pasos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { t: '🏢 Registro del edificio', p: 'El administrador del sistema AquaSaaS crea el perfil con un identificador único (slug), capacidad del tanque y correo administrativo.' },
                    { t: '👥 Incorporación de miembros', p: 'Se invita a residentes y miembros de junta por email. Cada uno recibe instrucciones de acceso y el enlace a su panel.' },
                    { t: '📊 Reporte y análisis', p: 'Los residentes ingresan mediciones (L o %) en cualquier momento. El sistema detecta anomalías y calcula tendencias.' },
                    { t: '📧 Notificaciones automáticas', p: 'Tras cada medición, se envía un informe completo por email al colaborador y a la junta con estadísticas en tiempo real.' }
                  ].map(item => (
                    <div key={item.t} className="bg-white border border-black/5 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                      <h4 className="font-bold text-base text-[#042C53] mb-2">{item.t}</h4>
                      <p className="text-sm text-[#5F5E5A] leading-relaxed">{item.p}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm overflow-hidden">
                   <h4 className="font-bold text-sm uppercase tracking-widest text-[#888780] mb-6">Los tres roles del sistema</h4>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="text-[#888780] uppercase tracking-tighter border-b border-black/10 text-[10px]">
                            <th className="py-4 px-2">Rol</th>
                            <th className="py-4 px-2">Acceso</th>
                            <th className="py-4 px-2">Funciones principales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 text-[#5F5E5A]">
                          <tr>
                            <td className="py-5 px-2"><span className="bg-[#E1F5EE] text-[#085041] px-2.5 py-1 rounded-full text-xs font-bold border border-[#9FE1CB]">Residente</span></td>
                            <td className="py-5 px-2 font-medium">Formulario público sin clave</td>
                            <td className="py-5 px-2">Reportar mediciones y recibir informes por email.</td>
                          </tr>
                          <tr>
                            <td className="py-5 px-2"><span className="bg-[#E6F1FB] text-[#0C447C] px-2.5 py-1 rounded-full text-xs font-bold border border-[#B5D4F4]">Administrador</span></td>
                            <td className="py-5 px-2 font-medium">Panel privado con login</td>
                            <td className="py-5 px-2">Gestionar miembros, estadísticas y configurar alertas críticas.</td>
                          </tr>
                          <tr>
                            <td className="py-5 px-2"><span className="bg-[#FAEEDA] text-[#633806] px-2.5 py-1 rounded-full text-xs font-bold border border-[#FAC775]">Junta</span></td>
                            <td className="py-5 px-2 font-medium">Panel privado con login</td>
                            <td className="py-5 px-2">Monitorear consumo y recibir informes periódicos detallados.</td>
                          </tr>
                        </tbody>
                     </table>
                   </div>
                </div>
              </section>

              {/* SECCIÓN 2: RESIDENTES */}
              <section id="help-residente" className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#FAEEDA] border border-[#FAC775] rounded-2xl flex items-center justify-center text-3xl shadow-sm">🏠</div>
                   <div>
                     <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#633806]">Guía para Residentes</h3>
                     <p className="text-sm text-[#5F5E5A] font-medium italic">Cómo reportar tu medición de consumo y qué sucede después.</p>
                   </div>
                </div>

                <div className="bg-[#E1F5EE] border border-[#9FE1CB] p-5 rounded-2xl flex gap-4 items-start text-sm md:text-base text-[#085041] shadow-sm leading-relaxed">
                   <span className="text-2xl">✅</span>
                   <div>
                     <p><strong>Sin contraseña necesaria.</strong> Los residentes acceden directamente a través de un enlace único de su edificio. No hay registro previo ni proceso de login tradicional para ellos.</p>
                   </div>
                </div>

                <div className="bg-white border border-black/5 p-8 rounded-[32px] shadow-sm space-y-6">
                   <h4 className="font-bold text-[#2C2C2A] text-lg">Tu enlace de acceso</h4>
                   <p className="text-[#5F5E5A] text-sm">Recibirás por correo o de tu administrador el enlace único de tu edificio. Guárdalo como favorito para acceso rápido.</p>
                   <div className="bg-[#F1EFE8] border border-black/10 rounded-xl p-4 flex items-center justify-between group overflow-hidden">
                      <code className="text-xs md:text-sm text-[#0F6E56] font-mono break-all font-bold">https://agua-rust.vercel.app/edificio/<strong>{building?.slug || '[slug]'}</strong></code>
                   </div>
                   <p className="text-[11px] text-[#888780] italic">Nota: El slug es el identificador único del edificio.</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-base text-[#2C2C2A] px-2 uppercase tracking-widest text-xs opacity-60">Pasos para registrar una medición</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { n: '1', t: 'Accede al formulario', p: 'Abre el enlace único en tu navegador. El formulario está disponible las 24 horas.' },
                      { n: '2', t: 'Ingresa la medición', p: 'Introduce el dato en Litros o el Porcentaje de llenado del tanque (ej: 75%).' },
                      { n: '3', t: 'Completa tus datos', p: 'Ingresa tu Email (requerido) y tu Nombre (opcional) para identificarte.' },
                      { n: '4', t: 'Envía el reporte', p: 'Haz clic en enviar y en segundos recibirás el informe completo en tu correo.' }
                    ].map(step => (
                      <div key={step.n} className="flex gap-4 p-5 bg-white rounded-2xl border border-black/5 shadow-sm">
                        <div className="w-10 h-10 bg-[#FAEEDA] text-[#BA7517] rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-[#FAC775]">{step.n}</div>
                        <div><h5 className="font-bold text-sm mb-1">{step.t}</h5><p className="text-xs text-[#5F5E5A] leading-relaxed">{step.p}</p></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#0F6E56] to-[#1D9E75] p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden">
                   <div className="relative z-10 space-y-6">
                     <h4 className="text-xl font-bold flex items-center gap-2">📧 ¿Qué pasa después de reportar?</h4>
                     <p className="text-white/80 text-sm leading-relaxed">El sistema activa un ciclo de comunicación inteligente para mantenerte informado sin saturar tu buzón:</p>
                     
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                          <p className="font-black text-xs uppercase mb-2 text-white/60 tracking-widest">Paso 1</p>
                          <p className="text-sm font-bold">Tú reportas un dato y recibes el informe detallado.</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/20">
                          <p className="font-black text-xs uppercase mb-2 text-white/60 tracking-widest">Paso 2</p>
                          <p className="text-sm font-bold">Recibes los siguientes 5 reportes hechos por tus vecinos.</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/20 border-dashed">
                          <p className="font-black text-xs uppercase mb-2 text-white/60 tracking-widest">Paso 3</p>
                          <p className="text-sm font-bold opacity-80 italic">El ciclo se pausa hasta que vuelvas a colaborar reportando un dato.</p>
                        </div>
                     </div>
                   </div>
                </div>
              </section>

              {/* SECCIÓN 3: ADMINISTRADOR */}
              <section id="help-administrador" className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#E6F1FB] border border-[#B5D4F4] rounded-2xl flex items-center justify-center text-3xl shadow-sm">🔧</div>
                   <div>
                     <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#0C447C]">Guía para Administradores</h3>
                     <p className="text-sm text-[#5F5E5A] font-medium italic">Panel completo de gestión: miembros, alertas y configuración.</p>
                   </div>
                </div>

                <div className="bg-white border border-[#B5D4F4] rounded-[32px] overflow-hidden shadow-sm">
                   <div className="bg-[#E6F1FB] p-6 border-b border-[#B5D4F4] flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <span className="text-2xl">🔐</span>
                        <h4 className="font-bold text-[#0C447C]">Acceso al panel privado</h4>
                     </div>
                     <span className="bg-white/60 text-[#0C447C] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Requiere Contraseña</span>
                   </div>
                   <div className="p-8 space-y-6">
                      <p className="text-sm text-[#5F5E5A]">Inicia sesión con tu correo y la contraseña configurada. Tendrás control total sobre:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         {[
                           { i: '📉', t: 'Tendencias', c: 'Histórico diario/mensual.' },
                           { i: '👥', t: 'Miembros', c: 'Añade o quita junta.' },
                           { i: '⚙️', t: 'Alertas', c: 'Umbrales de WhatsApp.' },
                           { i: '⚠️', t: 'Anomalías', c: 'Detección de fugas.' }
                         ].map(item => (
                           <div key={item.t} className="bg-[#F1EFE8]/50 p-4 rounded-2xl text-center border border-black/5">
                              <div className="text-2xl mb-2">{item.i}</div>
                              <p className="font-bold text-[11px] uppercase mb-1">{item.t}</p>
                              <p className="text-[10px] text-[#888780] leading-tight">{item.c}</p>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </section>

              {/* SECCIÓN 4: JUNTA */}
              <section id="help-junta" className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#EEEDFE] border border-[#AFA9EC] rounded-2xl flex items-center justify-center text-3xl shadow-sm">🏛️</div>
                   <div>
                     <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#3C3489]">Guía para la Junta</h3>
                     <p className="text-sm text-[#5F5E5A] font-medium italic">Acceso de supervisión y recepción de informes periódicos.</p>
                   </div>
                </div>

                <div className="card bg-white p-8 rounded-[32px] border border-black/5 shadow-sm space-y-6">
                  <h4 className="font-bold text-lg">Lo que puedes hacer como miembro:</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    {[
                      'Ver todos los gráficos avanzados del Dashboard.',
                      'Consultar el historial ilimitado de mediciones.',
                      'Acceder a las estadísticas y exportar reportes.',
                      'Recibir emails con cada nuevo reporte vecinal.',
                      'Supervisar los umbrales de configuración (Solo lectura).',
                      'Enviar reportes manuales a cualquier correo.'
                    ].map(text => (
                      <li key={text} className="flex gap-3 text-sm text-[#5F5E5A] items-start">
                        <span className="text-[#7F77DD] font-bold">✓</span> {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* SECCIÓN 5: INFORMES EMAIL */}
              <section id="help-emails" className="space-y-8">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-[#E1F5EE] border border-[#9FE1CB] rounded-2xl flex items-center justify-center text-3xl shadow-sm">📧</div>
                   <div>
                     <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#0F6E56]">Informes por correo</h3>
                     <p className="text-sm text-[#5F5E5A] font-medium italic">Transparencia y datos en la palma de tu mano.</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-[24px] border border-black/5 shadow-sm">
                      <h4 className="font-bold text-[#04342C] mb-4">Para Residentes</h4>
                      <p className="text-xs text-[#5F5E5A] leading-relaxed">Contiene su medición, nivel actual (%) y estadísticas rápidas comparativas con días anteriores.</p>
                   </div>
                   <div className="bg-white p-6 rounded-[24px] border border-black/5 shadow-sm">
                      <h4 className="font-bold text-[#04342C] mb-4">Para Admin y Junta</h4>
                      <p className="text-xs text-[#5F5E5A] leading-relaxed">Incluye quién reportó, estado detallado de autonomía hídrica, gráficos y resumen de consumo diario.</p>
                   </div>
                </div>

                <div className="bg-[#FAEEDA] border border-[#FAC775] p-6 rounded-2xl flex gap-4 items-start text-sm text-[#633806] shadow-sm">
                   <span className="text-2xl">⚠️</span>
                   <p><strong>Alerta de Anomalía:</strong> Si el sistema detecta una caída inusual (posible fuga), el Administrador recibe un email crítico inmediato con los datos del evento.</p>
                </div>
              </section>

              {/* SECCIÓN 6: COMUNIDAD */}
              <section id="help-comunidad" className="space-y-8">
                <div className="flex items-center gap-4 text-[#0F6E56]">
                   <div className="w-14 h-14 bg-[#E1F5EE] border border-[#9FE1CB] rounded-2xl flex items-center justify-center text-3xl shadow-sm">🌊</div>
                   <h3 className="text-2xl md:text-3xl font-serif font-bold">Datos Comunitarios</h3>
                </div>
                <div className="bg-[#F1EFE8] p-8 rounded-[32px] border border-black/5 shadow-inner">
                   <p className="text-sm text-[#2C2C2A] leading-relaxed text-center italic font-medium">"AquaSaaS promueve el uso responsable del agua a través de la transparencia compartiendo datos agregados con toda la comunidad del edificio."</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { i: '📈', t: 'Tendencias', p: 'Visualización histórica del nivel del tanque para todos.' },
                    { i: '👥', t: 'Participación', p: 'Indicador de cuántos vecinos están colaborando hoy.' },
                    { i: '🚰', t: 'Estado', p: 'Nivel hídrico actual disponible desde el link vecinal.' }
                  ].map(c => (
                    <div key={c.t} className="bg-white p-5 rounded-2xl text-center border border-black/5 shadow-sm">
                       <div className="text-2xl mb-2">{c.i}</div>
                       <h5 className="font-bold text-sm mb-1">{c.t}</h5>
                       <p className="text-[10px] text-[#888780] uppercase font-medium">{c.p}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* SECCIÓN 7: FAQ */}
              <section id="help-faq" className="space-y-6">
                <div className="flex items-center gap-4 text-[#0C447C]">
                   <div className="w-14 h-14 bg-[#E6F1FB] border border-[#B5D4F4] rounded-2xl flex items-center justify-center text-3xl shadow-sm">❓</div>
                   <h3 className="text-2xl md:text-3xl font-serif font-bold">Preguntas Frecuentes</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { q: '¿Necesito cuenta para reportar?', a: 'No. Solo necesitas el link único de tu edificio que te dará el administrador.' },
                    { q: '¿Cuándo debo reportar?', a: 'Cada vez que revises el nivel del tanque. A más datos, estadísticas más precisas.' },
                    { q: '¿Por qué dejé de recibir emails?', a: 'Tu ciclo de 5 emails terminó. Debes registrar una medición nueva para reactivarlo.' },
                    { q: '¿Es público mi email?', a: 'No. El correo es para identificación interna. Solo tu nombre (opcional) es comunitario.' },
                    { q: '¿Puedo borrar una medición?', a: 'Solo el Administrador del edificio puede editar o eliminar registros desde su panel.' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white border border-black/5 rounded-2xl p-5 hover:border-[#B5D4F4] transition-colors shadow-sm">
                       <p className="font-bold text-sm text-[#0C447C] mb-2">Q: {item.q}</p>
                       <p className="text-xs text-[#5F5E5A] leading-relaxed">A: {item.a}</p>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Footer Modal */}
            <div className="bg-white p-8 border-t border-black/5 text-center shrink-0 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-[#04342C] rounded-xl flex items-center justify-center shadow-lg"><Droplets className="w-6 h-6 text-white" /></div>
                 <div className="text-left"><p className="font-bold text-sm leading-none mb-1">AquaSaaS</p><p className="text-[10px] text-[#888780] font-medium tracking-tighter">Control Hídrico Residencial</p></div>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="bg-[#04342C] hover:bg-[#0F6E56] text-white px-16 py-3.5 rounded-2xl font-black transition-all shadow-xl active:scale-95 text-sm uppercase tracking-widest">
                Cerrar Guía
              </button>
              <p className="text-[9px] text-[#888780] font-bold uppercase tracking-widest hidden md:block">2026 — v2.0</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
