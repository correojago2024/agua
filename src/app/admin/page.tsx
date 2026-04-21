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
  Mail, Send, Clock, CreditCard,
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
  trial_start_date?: string; trial_end_date?: string;
  subscription_status?: string; custom_rate?: number;
  notification_3days_sent?: boolean;
  last_email_trial_3days?: string;
  // Financial fields
  next_expiry_date?: string;
  payment_method?: string;
  bank?: string;
  reference_number?: string;
  pending_amount?: string;
  // Plan subscribe
  subscription_plan?: string;
}

// Payment History
interface PaymentRecord {
  id: string; building_id: string; payment_date: string;
  amount: number; currency: string; payment_method?: string;
  bank?: string; reference_number?: string; notes?: string;
  created_at: string;
}

// Email Template
interface EmailTemplate {
  id: number; name: string; subject_es: string; body_es: string;
  subject_en?: string; body_en?: string; is_active: boolean;
}

// Config
interface SystemConfig {
  key: string; value: string; description?: string;
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
  const [activeView, setActiveView] = useState<'buildings' | 'leads' | 'maintenance' | 'reports' | 'emails' | 'plans' | 'logs'>('buildings');
  
  // Editing fields
  const [editingField, setEditingField] = useState<{id: string; field: string} | null>(null);
  const [fieldValue, setFieldValue] = useState('');

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

  // System Status
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Plans
  interface PlanPrecio {
    id: number;
    plan_id: string;
    nombre: string;
    precio: number;
    caracteristicas: any;
    activo: boolean;
  }
  const [plans, setPlans] = useState<PlanPrecio[]>([]);
  const [plansMsg, setPlansMsg] = useState('');
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    if (activeView === 'plans') loadPlans();
  }, [activeView]);

  const loadPlans = async () => {
    setPlansLoading(true);
    const { data, error } = await supabase.from('plan_precios').select('*').order('id');
    if (data) setPlans(data);
    setPlansLoading(false);
  };

  const updatePlanPrice = async (planId: string, precio: number) => {
    const { error } = await supabase.from('plan_precios').update({ precio, updated_at: new Date().toISOString() }).eq('plan_id', planId);
    if (!error) {
      setPlans(plans.map(p => p.plan_id === planId ? { ...p, precio } : p));
      setPlansMsg('Precio actualizado ✓');
      setTimeout(() => setPlansMsg(''), 2000);
    }
  };

  // Auto Schedule Config
  const [autoConfig, setAutoConfig] = useState({
    // System Status Report
    reportEnabled: true,
    reportHour: '08:00',
    reportFrequency: 'daily' as 'daily' | 'weekly' | 'monthual' | 'percentage',
    reportDaysOfWeek: ['1', '3', '5'] as string[],
    reportDayOfMonth: 1,
    reportPercentageTriggers: ['75', '90'] as string[],
    reportEmailOnError: true,
    // Maintenance
    maintenanceEnabled: true,
    maintenanceFrequency: 'biweekly' as 'daily' | 'weekly' | 'biweekly' | 'monthual',
    maintenanceHour: '03:00',
    maintenanceDayOfMonth: 1,
  });

  // Trial Check
  const [trialCheckLoading, setTrialCheckLoading] = useState(false);
  const [trialCheckResult, setTrialCheckResult] = useState<any>(null);
  const [showTrialPreview, setShowTrialPreview] = useState(false);
  const [trialPreviewList, setTrialPreviewList] = useState<any[]>([]);
  const [selectedForEmail, setSelectedForEmail] = useState<{id: string; emailType: string}[]>([]);

  // Send Email
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState('');

  // Email Preview
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [previewBuilding, setPreviewBuilding] = useState<BuildingRow | null>(null);
  const [previewEmailType, setPreviewEmailType] = useState('');

  // Payment History
  const [showPaymentHistory, setShowPaymentHistory] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [newPayment, setNewPayment] = useState({ payment_date: '', amount: '', currency: 'USD', payment_method: '', bank: '', reference_number: '', notes: '' });

  // Email Templates
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);

  // Config
  const [systemConfig, setSystemConfig] = useState<SystemConfig[]>([]);

  // Notification Logs
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadNotificationLogs = async () => {
    setLogsLoading(true);
    // Simulated - in production would query notification_logs table
    setNotificationLogs([
      { id: '1', building_id: 'b1', building_name: 'Edificio Demo', email_type: 'trial_3days', sent_to: 'admin@demo.com', sent_at: '2026-04-15', success: true },
      { id: '2', building_id: 'b2', building_name: 'Residencia XYZ', email_type: 'welcome', sent_to: 'admin@xyz.com', sent_at: '2026-04-10', success: true },
    ]);
    setLogsLoading(false);
  };

  // Email Templates State
  const [editingTemplate, setEditingTemplate] = useState<{name: string; subject_es: string; body_es: string} | null>(null);
  const [emailTemplates, setEmailTemplates] = useState([
    { name: 'trial_3days', subject_es: '⚠️ Tu período de prueba termina en 3 días - AquaSaaS', body_es: 'Estimado administrador,\n\nTu período de prueba del sistema AquaSaaS para {building_name} termina el {trial_end_date}.\n\nTe esperamos que hayas disfrutado del servicio. Recuerda que te quedan 3 días de uso gratuito para decidir si deseas continuar.\n\nPara activar tu edificio y seguir usando el sistema, contacta al administrador: correojago@gmail.com\n\nSaludos,\nEquipo AquaSaaS' },
    { name: 'trial_expired', subject_es: '📅 Período de prueba terminado - AquaSaaS', body_es: 'Estimado administrador,\n\nEl período de prueba de tu edificio {building_name} ha terminado.\n\nEl sistema ha sido pausado. Para renovar el servicio, contacta a: correojago@gmail.com\n\nSaludos,\nEquipo AquaSaaS' },
    { name: 'building_suspended', subject_es: '🚫 Edificio pausado - AquaSaaS', body_es: 'Estimado administrador,\n\nTu edificio {building_name} ha sido pausado y no recibirá más datos de mediciones hasta tanto se solucione la situación de renovación/pago.\n\nPara reactivar tu edificio, contacta al administrador: correojago@gmail.com\n\nSaludos,\nEquipo AquaSaaS' },
    { name: 'payment_reminder', subject_es: '💰 Recordatorio de pago - AquaSaaS', body_es: 'Estimado administrador,\n\nEl edificio {building_name} tiene un pago pendiente de ${pending_amount}.\n\nPor favor regularice su situación para continuar disfrutando del servicio.\n\nSaludos,\nEquipo AquaSaaS' },
    { name: 'welcome', subject_es: '🎉 Bienvenido a AquaSaaS', body_es: 'Estimado administrador,\n\n¡Bienvenido al sistema AquaSaaS! Tu edificio {building_name} ha sido registrado correctamente.\n\nAhora tienes 15 días de prueba gratuita para explorar todas las funcionalidades.\n\nSi tienes alguna duda, contacta a: correojago@gmail.com\n\nSaludos,\nEquipo AquaSaaS' },
  ]);

  const saveTemplate = async () => {
    if (editingTemplate) {
      setEmailTemplates(emailTemplates.map(t => t.name === editingTemplate.name ? editingTemplate : t));
      setEditingTemplate(null);
      setActionMsg('✅ Plantilla guardada');
      setTimeout(() => setActionMsg(''), 2000);
    }
  };

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

  const saveField = async (buildingId: string, field: string, value: string) => {
    const update: any = {};
    
    if (field === 'custom_rate') {
      update.custom_rate = parseFloat(value) || 25;
    } else if (field === 'last_payment_amount') {
      update.last_payment_amount = parseFloat(value) || 0;
    } else if (field === 'pending_amount') {
      update.pending_amount = parseFloat(value) || 0;
    } else if (field === 'overpaid_amount') {
      update.overpaid_amount = parseFloat(value) || 0;
    } else if (field === 'next_expiry_date') {
      update.next_expiry_date = value || null;
    } else if (field === 'payment_method') {
      update.payment_method = value;
    } else if (field === 'bank') {
      update.bank = value;
    } else if (field === 'reference_number') {
      update.reference_number = value;
    } else if (field === 'currency') {
      update.currency = value;
    } else {
      update[field] = value;
    }
    
    await supabase.from('buildings').update(update).eq('id', buildingId);
    setEditingField(null);
    setActionMsg('✅ Campo actualizado');
    setTimeout(() => setActionMsg(''), 2000);
    loadBuildings();
  };

  const previewEmail = async (building: BuildingRow, emailType: string) => {
    setPreviewBuilding(building);
    setPreviewEmailType(emailType);
    setShowEmailPreview(true);
  };

  const loadPaymentHistory = async (buildingId: string) => {
    const { data } = await supabase
      .from('payment_history')
      .select('*')
      .eq('building_id', buildingId)
      .order('payment_date', { ascending: false });
    setPaymentHistory((data as PaymentRecord[]) || []);
    setShowPaymentHistory(buildingId);
  };

  const addPaymentRecord = async (buildingId: string) => {
    if (!newPayment.payment_date || !newPayment.amount) {
      setActionMsg('❌ Fecha y monto requeridos');
      return;
    }
    await supabase.from('payment_history').insert({
      building_id: buildingId,
      payment_date: newPayment.payment_date,
      amount: parseFloat(newPayment.amount),
      currency: newPayment.currency,
      payment_method: newPayment.payment_method,
      bank: newPayment.bank,
      reference_number: newPayment.reference_number,
      notes: newPayment.notes,
      created_by: 'admin'
    });
    setActionMsg('✅ Pago registrado');
    setNewPayment({ payment_date: '', amount: '', currency: 'USD', payment_method: '', bank: '', reference_number: '', notes: '' });
    loadPaymentHistory(buildingId);
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

  const checkSystemStatus = async () => {
    setSystemStatusLoading(true);
    setSystemStatus(null);
    try {
      const res = await fetch('/api/system-status', { method: 'POST', body: JSON.stringify({ sendEmail: true }) });
      const data = await res.json();
      setSystemStatus(data);
      setActionMsg(data.emailSent ? '📧 Reporte enviado a correojago@gmail.com' : '✅ Estado verificado');
    } catch (e: any) {
      setSystemStatus({ error: e.message });
    } finally {
      setSystemStatusLoading(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const runTrialCheck = async () => {
    // First, get the list of buildings that would receive emails
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    // Filter buildings with trials expiring in 3 days that haven't been notified
    const expiringBuildings = buildings.filter(b => 
      b.status === 'Prueba' && 
      b.trial_end_date && 
      new Date(b.trial_end_date) <= threeDaysFromNow &&
      new Date(b.trial_end_date) >= today &&
      !b.last_email_trial_3days
    );
    
    // Show preview for user to select
    setTrialPreviewList(expiringBuildings.map(b => ({
      id: b.id,
      name: b.name,
      email: b.admin_email,
      trial_end_date: b.trial_end_date,
      last_notified: b.last_email_trial_3days
    })));
    setSelectedForEmail(expiringBuildings.map(b => ({id: b.id, emailType: 'trial_3days'})));
    setShowTrialPreview(true);
    setTrialCheckLoading(false);
  };

  const sendSelectedEmails = async () => {
    setTrialCheckLoading(true);
    setShowTrialPreview(false);
    setTrialCheckResult(null);
    
    try {
      for (const selected of selectedForEmail) {
        const res = await fetch('/api/check-trials', {
          method: 'POST',
          body: JSON.stringify({ action: 'send', building_id: selected.id, template_name: selected.emailType }),
        });
        await res.json();
        
        // Log the notification
        const building = trialPreviewList.find(b => b.id === selected.id);
        setNotificationLogs(prev => [{
          id: Date.now().toString(),
          building_id: selected.id,
          building_name: building?.name,
          email_type: selected.emailType,
          sent_to: building?.email,
          sent_at: new Date().toISOString().split('T')[0],
          success: true
        }, ...prev]);
      }
      
      setTrialCheckResult({ success: true, sent: selectedForEmail.length });
      setActionMsg(`✅ Emails enviados a ${selectedForEmail.length} edificios`);
      loadBuildings();
    } catch (e: any) {
      setTrialCheckResult({ error: e.message });
    } finally {
      setTrialCheckLoading(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
  };

  const sendBuildingEmail = async (buildingId: string, templateName: string) => {
    setEmailLoading(buildingId);
    setEmailMsg('');
    try {
      const res = await fetch('/api/check-trials', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', building_id: buildingId, template_name: templateName }),
      });
      const data = await res.json();
      setEmailMsg(data.success ? `✅ Email enviado` : `❌ ${data.error}`);
    } catch (e: any) {
      setEmailMsg(`❌ ${e.message}`);
    } finally {
      setEmailLoading(null);
      setTimeout(() => setEmailMsg(''), 3000);
    }
  };

  const updateBuildingStatus = async (buildingId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/check-trials', {
        method: 'POST',
        body: JSON.stringify({ action: 'set_status', building_id: buildingId, new_status: newStatus }),
      });
      const data = await res.json();
      setActionMsg(data.success ? `✅ Estado actualizado` : `❌ ${data.error}`);
      loadBuildings();
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
    }
    setTimeout(() => setActionMsg(''), 3000);
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

      {/* Trial Preview Modal */}
      {showTrialPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">📧 Preview - Emails a Enviar</h3>
              <button onClick={() => setShowTrialPreview(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-4">
              <p className="text-slate-400 text-sm mb-4">
                Selecciona los edificios a los que deseas enviar el email de recordatorio de prueba (3 días):
              </p>
              
              <div className="space-y-2 mb-4">
                {trialPreviewList.map(b => {
                  const selected = selectedForEmail.find(s => s.id === b.id);
                  return (
                    <div key={b.id} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                      <input type="checkbox" checked={!!selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedForEmail([...selectedForEmail, {id: b.id, emailType: 'trial_3days'}]);
                          } else {
                            setSelectedForEmail(selectedForEmail.filter(s => s.id !== b.id));
                          }
                        }}
                        className="w-5 h-5 accent-blue-500" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{b.name}</p>
                        <p className="text-slate-400 text-xs">{b.email}</p>
                        <p className="text-amber-400 text-xs">Vence: {b.trial_end_date}</p>
                      </div>
                      <select value={selected?.emailType || 'trial_3days'}
                        onChange={(e) => {
                          const newList = selectedForEmail.map(s => 
                            s.id === b.id ? {...s, emailType: e.target.value} : s
                          );
                          if (!selected) {
                            newList.push({id: b.id, emailType: e.target.value});
                          }
                          setSelectedForEmail(newList);
                        }}
                        className="bg-slate-600 text-white px-2 py-1 rounded text-xs">
                        <option value="trial_3days">⚠️ 3 días prueba</option>
                        <option value="trial_expired">📅 Prueba vencida</option>
                        <option value="building_suspended">🚫 Edificio pausado</option>
                        <option value="payment_reminder">💰 Recordatorio pago</option>
                        <option value="welcome">🎉 Bienvenida</option>
                      </select>
                    </div>
                  );
                })}
                {trialPreviewList.length === 0 && (
                  <p className="text-slate-500 text-center py-4">No hay edificios por vencer en 3 días</p>
                )}
              </div>
              
              <div className="flex gap-3">
                <button onClick={sendSelectedEmails}
                  disabled={selectedForEmail.length === 0 || trialCheckLoading}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium">
                  📤 Enviar ({selectedForEmail.length}) emails
                </button>
                <button onClick={() => setShowTrialPreview(false)}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
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

        {/* Tools */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-slate-400 font-medium text-sm">🔧 Herramientas:</span>
            <button onClick={runTrialCheck} disabled={trialCheckLoading}
              title="Revisa edificios con prueba por vencer (3 días). Envía emails y suspende automáticamente los vencidos."
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {trialCheckLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Verificar Pruebas
            </button>
            <button onClick={runMaintenance} disabled={maintLoading}
              title="Limpia datos antiguos, verifica integridad y envía reporte a correojago@gmail.com"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {maintLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Mantenimiento
            </button>
<button onClick={checkSystemStatus} disabled={systemStatusLoading}
              title="Verificar uso de recursos vs límites gratuitos y enviar reporte"
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {systemStatusLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Estado Sistema
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">💡 Para diario: cron-job.org → POST a /api/system-status?sendEmail=true</p>
        </div>

        {/* Auto Schedule Settings */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-white font-medium text-sm">⏰ Programación de Tareas Automáticas</span>
          </div>

          {/* Tarea 1: Reporte de Estado */}
          <div className="mb-4 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300 font-medium text-sm">📊 Reporte de Uso del Sistema</span>
            </div>
            <div className="grid md:grid-cols-4 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoConfig.reportEnabled} onChange={(e) => setAutoConfig({...autoConfig, reportEnabled: e.target.checked})}
                  className="w-4 h-4 accent-purple-500" />
                <span className="text-slate-300">Activar</span>
              </label>
              <select value={autoConfig.reportHour} onChange={(e) => setAutoConfig({...autoConfig, reportHour: e.target.value})}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs">
                {['05:00', '06:00', '07:00', '08:00', '09:00', '18:00', '20:00'].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={autoConfig.reportFrequency} onChange={(e) => setAutoConfig({...autoConfig, reportFrequency: e.target.value as any})}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs">
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthual">Mensual</option>
                <option value="percentage">Por %</option>
              </select>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={autoConfig.reportEmailOnError} onChange={(e) => setAutoConfig({...autoConfig, reportEmailOnError: e.target.checked})}
                  className="w-4 h-4" />
                <span className="text-slate-400 text-xs">Error</span>
              </label>
            </div>
            {autoConfig.reportFrequency === 'percentage' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-slate-400 text-xs">Al %:</span>
                {['50', '75', '90', '95'].map(p => (
                  <label key={p} className="flex items-center gap-1">
                    <input type="checkbox" checked={autoConfig.reportPercentageTriggers.includes(p)}
                      onChange={(e) => {
                        const newTriggers = e.target.checked ? [...autoConfig.reportPercentageTriggers, p] : autoConfig.reportPercentageTriggers.filter(t => t !== p);
                        setAutoConfig({...autoConfig, reportPercentageTriggers: newTriggers});
                      }}
                      className="w-3 h-3" />
                    <span className="text-slate-300 text-xs">{p}%</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tarea 2: Mantenimiento */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300 font-medium text-sm">🔧 Mantenimiento</span>
            </div>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoConfig.maintenanceEnabled} onChange={(e) => setAutoConfig({...autoConfig, maintenanceEnabled: e.target.checked})}
                  className="w-4 h-4 accent-cyan-500" />
                <span className="text-slate-300">Activar</span>
              </label>
              <select value={autoConfig.maintenanceHour} onChange={(e) => setAutoConfig({...autoConfig, maintenanceHour: e.target.value})}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs">
                {['02:00', '03:00', '04:00', '05:00'].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={autoConfig.maintenanceFrequency} onChange={(e) => setAutoConfig({...autoConfig, maintenanceFrequency: e.target.value as any})}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs">
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal (15 días)</option>
                <option value="monthual">Mensual</option>
              </select>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs">
              💾 Guardar Configuración
            </button>
            <span className="text-slate-500 text-xs ml-2">(Se guarda en la próxima actualización)</span>
          </div>
        </div>

        {/* Buildings tab */}
        {activeView === 'buildings' && (
          <>
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
                  {['Edificio', 'Email', 'Registro', 'Tarifa', 'Trial', 'Estado', 'Medicion', 'Acciones'].map(h => (
                    <th key={h} className="px-2 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                        <td className="px-3 py-4">
                          <p className="text-white font-medium">{b.name}</p>
                          <p className="text-slate-500 text-xs">{b.slug}</p>
                        </td>
                        <td className="px-3 py-4 text-slate-400 text-xs">{b.admin_email}</td>
                        <td className="px-3 py-4 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(b.created_at).toLocaleDateString('es-ES')}
                        </td>
                        <td className="px-3 py-4 text-green-400 text-xs font-medium">
                          ${b.custom_rate || 25}
                        </td>
                        <td className="px-3 py-4 text-xs whitespace-nowrap">
                          {b.trial_end_date ? (
                            <span className={new Date(b.trial_end_date) < new Date() ? 'text-red-400' : 'text-amber-400'}>
                              {new Date(b.trial_end_date).toLocaleDateString('es-ES')}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS['Prueba']}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-slate-300 font-medium text-center">{b.total_measurements ?? 0}</td>
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
                            <select
                              value={status}
                              onChange={(e) => updateBuildingStatus(b.id, e.target.value)}
                              className={`w-20 text-xs rounded px-1 py-1 cursor-pointer ${status === 'Activo' ? 'bg-green-500/20 text-green-400' : status === 'Suspendido' ? 'bg-red-500/20 text-red-400' : status === 'Prueba' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}>
                              <option value="Prueba" className="text-amber-400">Prueba</option>
                              <option value="Activo" className="text-green-400">Activo</option>
                              <option value="Suspendido" className="text-red-400">Suspendido</option>
                              <option value="Inactivo" className="text-slate-400">Inactivo</option>
                            </select>
                            <button onClick={() => sendBuildingEmail(b.id, b.status === 'Prueba' ? 'trial_3days' : 'building_suspended')}
                              disabled={emailLoading === b.id}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg disabled:opacity-50"
                              title="Enviar recordatorio por email">
                              {emailLoading === b.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            </button>
                            <button onClick={() => updateBuildingStatus(b.id, status === 'Suspendido' ? 'Activo' : 'Suspendido')}
                              className={`p-1.5 rounded-lg ${status === 'Suspendido' ? 'text-green-400 hover:bg-green-500/20' : 'text-red-400 hover:bg-red-500/20'}`}
                              title={status === 'Suspendido' ? 'Activar' : 'Suspender'}>
                              <CreditCard className="w-4 h-4" />
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
                            <div className="space-y-3">
                              {/*基本信息*/}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">📅 Fecha Registro</p>
                                  <p className="text-slate-300">{new Date(b.created_at).toLocaleDateString('es-ES')}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">💰 Plan</p>
                                  <select value={b.subscription_plan || 'basico'} 
                                    onChange={(e) => saveField(b.id, 'subscription_plan', e.target.value)}
                                    className="w-full bg-slate-600 text-blue-400 px-2 py-1 rounded text-xs">
                                    <option value="basico">Básico ($9)</option>
                                    <option value="profesional">Profesional ($25)</option>
                                    <option value="empresarial">Empresarial ($49)</option>
                                    <option value="ia">IA Intelligence ($79)</option>
                                  </select>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">💵 Tarifa ($/mes)</p>
                                  <input type="number" value={b.custom_rate || 25} 
                                    onChange={(e) => saveField(b.id, 'custom_rate', e.target.value)}
                                    className="w-20 bg-slate-600 text-green-400 px-2 py-1 rounded text-xs" />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">📅 Próximo Vencimiento</p>
                                  <input type="date" value={b.next_expiry_date || ''} 
                                    onChange={(e) => saveField(b.id, 'next_expiry_date', e.target.value)}
                                    className="w-28 bg-slate-600 text-amber-400 px-2 py-1 rounded text-xs" />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">📝 Notas</p>
                                  <input type="text" value={b.notes || ''} 
                                    onChange={(e) => saveField(b.id, 'notes', e.target.value)}
                                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs" placeholder="Notas..." />
                                </div>
                              </div>
                              
                              {/* Pagos */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm border-t border-slate-600 pt-3">
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">💰 Último Pago</p>
                                  <input type="date" value={b.last_payment_date || ''} 
                                    onChange={(e) => saveField(b.id, 'last_payment_date', e.target.value)}
                                    className="w-full bg-slate-600 text-blue-400 px-2 py-1 rounded text-xs mb-1" />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">💵 Monto Pagado</p>
                                  <input type="number" value={b.last_payment_amount || ''} 
                                    onChange={(e) => saveField(b.id, 'last_payment_amount', e.target.value)}
                                    className="w-full bg-slate-600 text-green-400 px-2 py-1 rounded text-xs" placeholder="0" />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">🏦 Banco</p>
                                  <input type="text" value={b.bank || ''} 
                                    onChange={(e) => saveField(b.id, 'bank', e.target.value)}
                                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs" placeholder="Banco..." />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">📋 Referencia</p>
                                  <input type="text" value={b.reference_number || ''} 
                                    onChange={(e) => saveField(b.id, 'reference_number', e.target.value)}
                                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs" placeholder="Nro ref..." />
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">📤 Forma Pago</p>
                                  <select value={b.payment_method || ''} 
                                    onChange={(e) => saveField(b.id, 'payment_method', e.target.value)}
                                    className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs">
                                    <option value="">Seleccionar</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="pago_movil">Pago Móvil</option>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="zelle">Zelle</option>
                                  </select>
                                </div>
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
        </>
        )}

        {/* Main navigation tabs - horizontal menu */}
        <div className="flex flex-wrap gap-2 mb-6 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
          {[
            { id: 'buildings', label: '🏢 Edificios', Icon: Building },
            { id: 'leads', label: '📬 Leads', Icon: Users },
            { id: 'maintenance', label: '🔧 Mantenimiento', Icon: Settings },
            { id: 'reports', label: '📊 Reportes', Icon: BarChart3 },
            { id: 'emails', label: '📧 Emails', Icon: Mail },
            { id: 'plans', label: '💰 Planes', Icon: CreditCard },
            { id: 'logs', label: '📨 Logs', Icon: Clock },
          ].map(({ id, label, Icon }) => (
            <button key={id}
              onClick={() => { setActiveView(id as any); if (id === 'leads') loadLeads(); if (id === 'logs') loadNotificationLogs(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeView === id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Buildings tab */}

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

        {/* Reports tab */}
        {activeView === 'reports' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📊 Reportes de Gestión</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-blue-400 font-medium mb-2">💰 Estado de Cuentas</h3>
                <div className="space-y-2 text-sm">
                  <p>Total Edificios: <span className="text-white font-bold">{buildings.length}</span></p>
                  <p>Activos: <span className="text-green-400 font-bold">{stats.activos}</span></p>
                  <p>Pendiente por cobrar: <span className="text-red-400 font-bold">${buildings.reduce((sum, b) => sum + (Number(b.pending_amount) || 0), 0)}</span></p>
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-amber-400 font-medium mb-2">⏳ Pruebas por Vencer</h3>
                <div className="space-y-2 text-sm">
                  {buildings.filter(b => b.status === 'Prueba' && b.trial_end_date && new Date(b.trial_end_date) <= new Date(Date.now() + 3*24*60*60*1000)).map(b => (
                    <p key={b.id} className="text-amber-400">{b.name}: {b.trial_end_date}</p>
                  ))}
                  {buildings.filter(b => b.status === 'Prueba' && b.trial_end_date && new Date(b.trial_end_date) <= new Date(Date.now() + 3*24*60*60*1000)).length === 0 && (
                    <p className="text-slate-500">No hay pruebas por vencer</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Emails tab */}
        {activeView === 'emails' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📧 Plantillas de Emails</h2>
            <p className="text-slate-400 text-xs mb-4">Clic en una plantilla para editar. Usa {'{building_name}'}, {'{trial_end_date}'}, etc. para variables.</p>
            
            {editingTemplate ? (
              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-xs">Asunto</label>
                  <input type="text" value={editingTemplate.subject_es} 
                    onChange={(e) => setEditingTemplate({...editingTemplate, subject_es: e.target.value})}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs">Cuerpo (HTML)</label>
                  <textarea value={editingTemplate.body_es} 
                    onChange={(e) => setEditingTemplate({...editingTemplate, body_es: e.target.value})}
                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm h-64 font-mono" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveTemplate} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm">💾 Guardar</button>
                  <button onClick={() => setEditingTemplate(null)} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm">✕ Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {emailTemplates.map(t => (
                  <div key={t.name} className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 cursor-pointer"
                    onClick={() => setEditingTemplate(t)}>
                    <p className="text-blue-400 font-medium">{t.name}</p>
                    <p className="text-slate-400 text-xs mt-1">{t.subject_es.substring(0, 50)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plans tab */}
        {activeView === 'plans' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">💰 Configuración de Planes</h2>
            <p className="text-slate-400 text-xs mb-6">Edita los precios de los planes que se muestran en la página principal.</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div key={plan.plan_id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-white font-medium">{plan.nombre}</span>
                    <span className="text-slate-400 text-xs">{plan.plan_id}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-slate-400 text-sm">Precio:</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={plan.precio}
                      onChange={(e) => updatePlanPrice(plan.plan_id, parseFloat(e.target.value) || 0)}
                      className="bg-slate-800 text-white px-3 py-1 rounded text-sm w-24"
                    />
                    <span className="text-slate-400 text-sm">/mes</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {plan.caracteristicas?.suscriptores} suscriptores, 
                    {plan.caracteristicas?.alertas_email && ' email'}
                    {plan.caracteristicas?.alertas_sms && ', SMS'}
                    {plan.caracteristicas?.historial_ilimitado && ', historial ilimitado'}
                    {plan.caracteristicas?.api && ', API'}
                    {plan.caracteristicas?.soporte_24_7 && ', 24/7'}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
              <h3 className="text-white font-medium mb-3">Edificios por Plan</h3>
              <div className="grid md:grid-cols-4 gap-3">
                {['basico', 'profesional', 'empresarial', 'ia'].map((planId) => {
                  const count = buildings.filter(b => (b.subscription_plan || 'basico') === planId).length;
                  const plan = plans.find(p => p.plan_id === planId);
                  return (
                    <div key={planId} className="bg-slate-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">{count}</div>
                      <div className="text-xs text-slate-400">{plan?.nombre || planId}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {plansMsg && (
              <div className="mt-4 p-3 bg-green-600/20 text-green-400 rounded-lg text-sm">
                {plansMsg}
              </div>
            )}
          </div>
        )}

        {/* Logs tab */}
        {activeView === 'logs' && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">📨 Logs de Notificaciones Enviadas</h2>
              <button onClick={loadNotificationLogs} disabled={logsLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm">
                {logsLoading ? 'Cargando...' : '🔄 Actualizar'}
              </button>
            </div>
            
            <p className="text-slate-400 text-xs mb-4">Historial de emails enviados por el sistema. Útil para verificar antes de ejecutar "Verificar Pruebas".</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Edificio</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Tipo Email</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Destino</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-400">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {notificationLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-700/30">
                      <td className="px-3 py-2 text-slate-300">{log.sent_at}</td>
                      <td className="px-3 py-2 text-white">{log.building_name}</td>
                      <td className="px-3 py-2 text-blue-400">{log.email_type}</td>
                      <td className="px-3 py-2 text-slate-400">{log.sent_to}</td>
                      <td className="px-3 py-2">
                        {log.success ? (
                          <span className="text-green-400">✓ Enviado</span>
                        ) : (
                          <span className="text-red-400">✕ Error</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {notificationLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No hay logs registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
