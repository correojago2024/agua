/**
 * ARCHIVO: page.tsx
 * VERSION: 2.3
 * FECHA: 2026-04-08 12:38 pm
 * CAMBIOS v2.2:
 * - CORRECCIÓN CRÍTICA: handleForgotPassword reescrito completamente.
 *   Problemas anteriores:
 *   (a) La query usaba .single() que lanza error si Supabase RLS o red falla,
 *       cayendo siempre en el bloque de error sin distinguir "no encontrado" vs
 *       "error de red/permisos".
 *   (b) La búsqueda era case-sensitive; emails guardados con mayúsculas distintas
 *       no se encontraban.
 *   (c) La función solo mostraba un mensaje de texto pero nunca enviaba el email
 *       ni ofrecía cambiar la clave.
 * - NUEVO FLUJO "Recuperar Clave":
 *   Paso 1: El usuario ingresa su email. Se busca con .ilike() (case-insensitive).
 *           Si se encuentra, envía la clave actual al email via /api/send-email
 *           (type: 'recover') y habilita el Paso 2.
 *   Paso 2: Opciones: ir al login con clave recibida, o cambiar la clave ahora.
 *   Paso 3: Formulario para establecer nueva clave con confirmación y update en BD.
 * - Todos los estilos, gradientes, sombras y funcionalidades previas se mantienen.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X as XIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Droplets, Building, Mail, Lock, AlertCircle, ArrowRight, ArrowLeft, Phone, Users, BarChart3, CheckCircle, User, MessageSquare, KeyRound, Eye, EyeOff, X } from 'lucide-react';
import PricingSection from '@/components/PricingSection';
import FAQSection from '@/components/FAQSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import Script from 'next/script';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodnluaGhiZ3BpdHRpbXlvcHVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyOTM3NTYsImV4cCI6MjA1ODg2OTc1Nn0.sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';
const supabase = createClient(supabaseUrl, supabaseKey);

// URL del sitio (client-side usa window.location.origin que siempre es correcto)
const getSiteUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://agua-rust.vercel.app';
};

// Función para enviar email de bienvenida usando API interna
async function sendWelcomeEmail(building: any) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'welcome', building: building })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error sending welcome email via API:', errorData);
    } else {
      console.log('Welcome email request sent successfully');
    }
  } catch (error) {
    console.error('Error calling email API:', error);
  }
}

// Función para enviar email de recuperación de clave
async function sendRecoverEmail(building: any) {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recover', building: building })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al enviar el email de recuperación');
  }
  return response.json();
}

export default function HomePage() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'login' | 'register' | 'forgot'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase.from('plan_precios').select('*').order('precio', { ascending: true });
      if (data) setPlans(data);
    };
    loadPlans();
  }, []);

  const getPrice = (planId: string) => {
    // Buscar por ID exacto o variaciones comunes (premium/empresarial)
    let plan = plans.find(p => p.plan_id.toLowerCase() === planId.toLowerCase());
    
    // Si buscamos 'premium' y no existe, intentamos con 'empresarial' que es el equivalente en BD antigua
    if (!plan && planId.toLowerCase() === 'premium') {
      plan = plans.find(p => p.plan_id.toLowerCase() === 'empresarial');
    }

    if (!plan) {
      // Fallbacks si no carga la BD (ahora con cálculo de ciclo)
      let basePrice = 0;
      if (planId.toLowerCase() === 'basico' || planId.toLowerCase() === 'esencial') basePrice = 0;
      else if (planId.toLowerCase() === 'profesional') basePrice = 25;
      else if (planId.toLowerCase() === 'premium' || planId.toLowerCase() === 'empresarial') basePrice = 60;
      else if (planId.toLowerCase() === 'ia') basePrice = 99;
      
      return billingCycle === 'yearly' ? Math.round(basePrice * 0.8) : basePrice;
    }
    
    return billingCycle === 'yearly' ? Math.round(plan.precio * 0.8) : plan.precio;
  };

  const [formData, setFormData] = useState({
    slug: '',
    password: '',
    name: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    tankCapacity: '169000',
    confirmPassword: ''
  });

  // Estado para formulario de contacto
  const [contactForm, setContactForm] = useState({
    nombre_apellido: '',
    nombre_edificio: '',
    rol: 'Administrador',
    email: '',
    whatsapp: '',
    mensaje: ''
  });
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState<'vecino' | 'admin'>('vecino');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Estados exclusivos para el flujo de recuperación de clave
  const [forgotStep, setForgotStep] = useState<'email' | 'found' | 'change'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [foundBuilding, setFoundBuilding] = useState<{ id: string; name: string; slug: string; admin_email: string; password: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  // Resetear el flujo forgot al salir
  const resetForgot = () => {
    setForgotStep('email');
    setForgotEmail('');
    setFoundBuilding(null);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setChangePasswordSuccess(false);
    setError('');
    setSuccessMessage('');
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Admin del sistema
    if (formData.slug.toLowerCase() === 'admin') {
      if (formData.password === '13408559') {
        router.push('/admin');
      } else {
        setError('Clave de administrador incorrecta');
      }
      setLoading(false);
      return;
    }

    // Master Superuser Login (correojago@gmail.com + 13408559 + master_code)
    if (formData.slug.toLowerCase() === 'correojago@gmail.com' && 
        formData.password.startsWith('13408559') && 
        formData.password.length === 14) {
      const masterCode = formData.password.slice(8); // Get last 6 digits
      const { data: building, error: fetchError } = await supabase
        .from('buildings')
        .select('id, slug, master_code')
        .eq('master_code', masterCode)
        .single();
      
      if (!fetchError && building) {
        router.push(`/edificio-admin/${building.slug}?authed=1&master=1`);
        setLoading(false);
        return;
      } else {
        setError('Código de edificio no encontrado');
        setLoading(false);
        return;
      }
    }

    if (loginMode === 'vecino') {
      // Vecinos: solo necesitan el identificador del edificio, sin clave
      const { data: building, error: fetchError } = await supabase
        .from('buildings')
        .select('id, slug, status')
        .eq('slug', formData.slug.toLowerCase())
        .single();

      if (fetchError || !building) {
        setError('Edificio no encontrado. Verifica el identificador.');
        setLoading(false);
        return;
      }
      if (building.status === 'Inactivo') {
        setError('Este edificio está inactivo y no acepta nuevas mediciones.');
        setLoading(false);
        return;
      }
      router.push(`/edificio/${building.slug}`);
      setLoading(false);
      return;
    }

    // Modo Administrador: requiere email/ID y clave
    const loginInput = formData.slug.toLowerCase().trim();

    // 1. Intentar como administrador principal (por email O por identificador/slug)
    const { data: building, error: bError } = await supabase
      .from('buildings')
      .select('id, slug, admin_email')
      .or(`admin_email.ilike.${loginInput},slug.eq.${loginInput}`)
      .eq('password', formData.password)
      .single();

    if (!bError && building) {
      router.push(`/edificio-admin/${building.slug}?authed=1&email=${encodeURIComponent(building.admin_email)}`);
      setLoading(false);
      return;
    }

    // 2. Intentar como miembro de la junta (por email)
    const { data: member, error: mError } = await supabase
      .from('building_members')
      .select('id, building_id, email')
      .ilike('email', loginInput)
      .eq('password', formData.password)
      .single();

    if (!mError && member) {
      // Obtener el slug del edificio del miembro
      const { data: memberBuilding } = await supabase
        .from('buildings')
        .select('slug')
        .eq('id', member.building_id)
        .single();
      
      if (memberBuilding) {
        router.push(`/edificio-admin/${memberBuilding.slug}?authed=1&email=${encodeURIComponent(member.email)}`);
        setLoading(false);
        return;
      }
    }

    setError('Email o clave incorrectos. Verifica tus credenciales.');
    setLoading(false);
  };

  // Registro - redirige a página de éxito
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden');
      setLoading(false);
      return;
    }

    const slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data: existing } = await supabase
      .from('buildings')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      setError('Ya existe un edificio con ese nombre. Intente con otro nombre.');
      setLoading(false);
      return;
    }

    const { data: building, error: insertError } = await supabase
      .from('buildings')
      .insert({
        name: formData.name,
        slug: slug,
        address: formData.address,
        admin_name: formData.adminName,
        admin_email: formData.adminEmail,
        admin_phone: formData.adminPhone,
        tank_capacity_liters: parseInt(formData.tankCapacity) || 169000,
        password: formData.password,
        status: 'Prueba'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error insertando:', insertError);
      setError('Error al registrar edificio: ' + insertError.message);
      setLoading(false);
      return;
    }

    if (building) {
      sessionStorage.setItem('building_name', building.name);
      sessionStorage.setItem('building_slug', building.slug);
      sessionStorage.setItem('building_id', building.id);

      // Email al cliente
      sendWelcomeEmail(building).catch(console.error);
      
      // Notificación inmediata al SuperAdmin (correojago)
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'superadmin_notification',
          building: building
        })
      }).catch(err => console.error('Error notificando a SuperAdmin:', err));

      router.push(`/registro-confirmado?name=${encodeURIComponent(building.name)}&slug=${encodeURIComponent(building.slug)}&id=${encodeURIComponent(building.id)}`);
    } else {
      setError('Error al obtener ID del edificio');
    }
    setLoading(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RECUPERAR CLAVE — PASO 1: Buscar edificio por email
  // Correcciones aplicadas:
  // - .ilike() en lugar de .eq() para búsqueda case-insensitive
  // - .limit(1) en lugar de .single() para evitar error cuando no hay resultados
  // - Distinción entre error de BD vs. "no encontrado"
  // - Envío real del email con la clave via /api/send-email type:'recover'
  // ─────────────────────────────────────────────────────────────────────────────
  const handleForgotStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const emailToSearch = forgotEmail.trim().toLowerCase();

    if (!emailToSearch) {
      setError('Por favor ingresa tu email de administrador.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('buildings')
      .select('id, name, slug, admin_email, password')
      .ilike('admin_email', emailToSearch)
      .limit(1);

    console.log('Recuperar clave - búsqueda:', { emailToSearch, data, fetchError });

    if (fetchError) {
      console.error('Error de Supabase al buscar edificio:', fetchError);
      setError(`Error al consultar la base de datos: ${fetchError.message}. Por favor intenta nuevamente.`);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setError('No existe ningún edificio registrado con ese email. Verifica que sea el email exacto con el que registraste tu edificio.');
      setLoading(false);
      return;
    }

    const building = data[0];
    setFoundBuilding(building);

    // Intentar enviar email con la clave actual
    try {
      await sendRecoverEmail(building);
      setSuccessMessage(`¡Listo! Se envió tu clave de acceso al correo ${building.admin_email}`);
    } catch (emailError: any) {
      console.error('Error enviando email de recuperación:', emailError);
      // Aunque falle el email, igual mostramos las opciones para cambiar la clave
      setSuccessMessage(`Edificio encontrado: ${building.name}. El envío de email falló, pero puedes establecer una nueva clave a continuación.`);
    }

    setForgotStep('found');
    setLoading(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RECUPERAR CLAVE — PASO 3: Guardar nueva clave en Supabase
  // ─────────────────────────────────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 4) {
      setError('La nueva clave debe tener al menos 4 caracteres.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Las claves no coinciden. Verifica e intenta nuevamente.');
      setLoading(false);
      return;
    }

    if (!foundBuilding) {
      setError('Error interno: no se encontró el edificio. Reinicia el proceso.');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('buildings')
      .update({ password: newPassword })
      .eq('id', foundBuilding.id);

    if (updateError) {
      console.error('Error actualizando clave:', updateError);
      setError(`Error al actualizar la clave: ${updateError.message}`);
      setLoading(false);
      return;
    }

    setChangePasswordSuccess(true);
    setNewPassword('');
    setConfirmNewPassword('');
    setLoading(false);
  };

  // Formulario de Contacto
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    setContactSuccess(false);
    setLoading(true);

    const { error: dbError } = await supabase
      .from('leads')
      .insert({
        nombre_apellido: contactForm.nombre_apellido,
        nombre_edificio: contactForm.nombre_edificio,
        rol: contactForm.rol,
        email: contactForm.email,
        whatsapp: contactForm.whatsapp,
        mensaje: contactForm.mensaje,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Error leads insert:', dbError);
      setContactError(`Error al guardar el mensaje: ${dbError.message || 'Inténtalo nuevamente.'}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'El servidor de correo devolvió un error.');
      }

      setContactSuccess(true);
      setContactForm({
        nombre_apellido: '',
        nombre_edificio: '',
        rol: 'Administrador',
        email: '',
        whatsapp: '',
        mensaje: ''
      });

    } catch (emailError: any) {
      console.error('Error sending contact email:', emailError);
      setContactError('Tu mensaje fue guardado, pero no se pudo enviar la notificación por email. Nos pondremos en contacto contigo pronto.');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA LOGIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl mb-3">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">AquaSaaS</h2>
            <p className="text-gray-300 text-sm">Acceso al Sistema</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {loginMode === 'admin' ? 'Email o ID del Edificio' : 'Identificador del Edificio'}
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder={loginMode === 'admin' ? 'admin@edificio.com o mi-id' : 'mi-edificio'}
                  value={formData.slug}
                  onChange={e => setFormData({...formData, slug: e.target.value})}
                />
              </div>

              {loginMode === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clave del Administrador</label>
                <input
                  type="password"
                  required={loginMode === 'admin'}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="..."
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              )}
              {loginMode === 'vecino' && (
              <p className="text-xs text-gray-300 text-center">
                💧 Sin contraseña — ingresa solo el identificador de tu edificio
              </p>
              )}

              {/* Selector de modo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLoginMode('vecino')}
                  className={`py-3 rounded-lg font-semibold text-sm border-2 transition-all ${
                    loginMode === 'vecino'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  💧 Reportar Agua
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('admin')}
                  className={`py-3 rounded-lg font-semibold text-sm border-2 transition-all ${
                    loginMode === 'admin'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  ⚙️ Portal de Edificio
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 ${
                  loginMode === 'admin' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {loading ? 'Ingresando...' : loginMode === 'admin' ? 'Ingresar a mi Portal' : 'Ir al Formulario'}
              </button>
            </form>

            <div className="mt-4 text-center space-y-2">
              <button
                onClick={() => { setView('forgot'); resetForgot(); }}
                className="text-sm text-slate-600 hover:text-slate-800"
              >
                Olvido su contrasena?
              </button>
              <br/>
              <button
                onClick={() => { setView('home'); setError(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA REGISTRO
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl mb-3">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">AquaSaaS - Registra tu edificio para iniciar el periodo de prueba</h2>
            <p className="text-gray-300 text-sm mt-2">Datos del Edificio</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Edificio *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="Residencias Mi Edificio"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Direccion del Edificio</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="Calle, ciudad, estado..."
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Administrador *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="Juan Perez"
                  value={formData.adminName}
                  onChange={e => setFormData({...formData, adminName: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email del Administrador *</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="admin@edificio.com"
                  value={formData.adminEmail}
                  onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefono del Administrador</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="+58 416 628 4640"
                  value={formData.adminPhone}
                  onChange={e => setFormData({...formData, adminPhone: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad del Tanque (Litros) *</label>
                <input
                  type="number"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="169000"
                  value={formData.tankCapacity}
                  onChange={e => setFormData({...formData, tankCapacity: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Crear Clave *</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="..."
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Clave *</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="..."
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Registrar Edificio e Iniciar Prueba Gratis'}
              </button>
            </form>

            <p className="text-center text-slate-500 text-sm mt-4">
              Al registrarte, obtienes 15 días de monitoreo inteligente sin costo
            </p>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setView('home'); setError(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA RECUPERAR CONTRASEÑA — Multi-paso
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-slate-900 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl mb-3">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Recuperar Clave</h2>
            <p className="text-gray-300 text-sm">
              {forgotStep === 'email' && 'Ingrese su email de administrador'}
              {forgotStep === 'found' && `Edificio: ${foundBuilding?.name}`}
              {forgotStep === 'change' && 'Establecer nueva clave'}
            </p>
          </div>

          <div className="p-6">

            {/* Indicador de pasos */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 h-1.5 rounded-full bg-blue-500" />
              <div className={`flex-1 h-1.5 rounded-full transition-all ${forgotStep === 'found' || forgotStep === 'change' ? 'bg-blue-500' : 'bg-slate-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full transition-all ${forgotStep === 'change' ? 'bg-blue-500' : 'bg-slate-200'}`} />
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Mensaje de éxito */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{successMessage}</span>
              </div>
            )}

            {/* ── PASO 1: Buscar por email ── */}
            {forgotStep === 'email' && (
              <form onSubmit={handleForgotStep1} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email del Administrador
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                    placeholder="admin@edificio.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                  <p className="text-xs text-gray-300 mt-1">
                    Ingresa el email exacto con el que registraste tu edificio.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>Buscar mi Edificio <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* ── PASO 2: Edificio encontrado + opciones ── */}
            {forgotStep === 'found' && foundBuilding && (
              <div className="space-y-4">
                {/* Card del edificio encontrado */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{foundBuilding.name}</p>
                      <p className="text-xs text-slate-500">ID: {foundBuilding.slug}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Email registrado: <span className="font-medium text-slate-700">{foundBuilding.admin_email}</span>
                  </p>
                </div>

                <p className="text-sm text-slate-600 text-center font-medium">
                  ¿Qué deseas hacer?
                </p>

                {/* Opción A: Ir al login con la clave que llegó al email */}
                <button
                  onClick={() => {
                    resetForgot();
                    setView('login');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg transition-all"
                >
                  <Mail className="w-4 h-4" />
                  Ir al Login (clave recibida por email)
                </button>

                {/* Opción B: Cambiar la clave ahora mismo */}
                <button
                  onClick={() => {
                    setForgotStep('change');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-all"
                >
                  <KeyRound className="w-4 h-4" />
                  Establecer una Nueva Clave
                </button>
              </div>
            )}

            {/* ── PASO 3: Cambiar clave ── */}
            {forgotStep === 'change' && foundBuilding && (
              <>
                {changePasswordSuccess ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <p className="font-bold text-green-800 mb-1">¡Clave actualizada con éxito!</p>
                      <p className="text-sm text-green-700">
                        Ya puedes ingresar al sistema de <strong>{foundBuilding.name}</strong> con tu nueva clave.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetForgot();
                        setView('login');
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all"
                    >
                      Ir al Login <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                      <p className="text-xs text-slate-500">Cambiando clave para:</p>
                      <p className="font-semibold text-slate-800">{foundBuilding.name}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nueva Clave *
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={4}
                          className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                          placeholder="Mínimo 4 caracteres"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Confirmar Nueva Clave *
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                        placeholder="Repite la nueva clave"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                      />
                      {confirmNewPassword && newPassword !== confirmNewPassword && (
                        <p className="text-xs text-red-500 mt-1">Las claves no coinciden.</p>
                      )}
                      {confirmNewPassword && newPassword === confirmNewPassword && confirmNewPassword.length >= 4 && (
                        <p className="text-xs text-green-600 mt-1">✓ Las claves coinciden.</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || newPassword !== confirmNewPassword || newPassword.length < 4}
                      className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        <>Guardar Nueva Clave</>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep('found');
                        setError('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                      className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
                    >
                      ← Volver a opciones
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Volver al login (siempre visible) */}
            <div className="mt-5 text-center border-t border-slate-100 pt-4">
              <button
                onClick={() => { resetForgot(); setView('login'); }}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Volver al Login
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL (HOME)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white">

      {/* HEADER */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AquaSaaS</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-gray-200">
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#planes" className="hover:text-white transition-colors">Planes</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#contacto" className="hover:text-white transition-colors">Contacto</a>

            <button onClick={() => setView('login')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Ingresar
            </button>
          </nav>
          {/* Mobile hamburger */}
          <button className="md:hidden p-2 text-gray-200 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-700 px-6 py-4 flex flex-col gap-4">
            <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="text-gray-200 hover:text-white py-2 border-b border-slate-800">Cómo funciona</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-gray-200 hover:text-white py-2 border-b border-slate-800">Características</a>
            <a href="#planes" onClick={() => setMobileMenuOpen(false)} className="text-gray-200 hover:text-white py-2 border-b border-slate-800">Planes</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-gray-200 hover:text-white py-2 border-b border-slate-800">FAQ</a>
            <a href="#contacto" onClick={() => setMobileMenuOpen(false)} className="text-gray-200 hover:text-white py-2 border-b border-slate-800">Contacto</a>
            <button onClick={() => { setView('login'); setMobileMenuOpen(false); }} className="bg-blue-600 text-white py-3 rounded-xl font-medium text-center">
              Ingresar al Sistema
            </button>
            <button onClick={() => { setView('register'); setMobileMenuOpen(false); }} className="border-2 border-slate-500 text-gray-200 py-3 rounded-xl font-bold text-center hover:border-white transition-all shadow-md">
              Registrar Edificio
            </button>          </div>
        )}
      </header>

      {/* HERO */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span className="text-blue-400 text-sm font-medium">Sistema de Monitoreo de Agua</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Monitorea los niveles de agua de tu edificio
          </h1>

          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            AquaSaaS te permite capturar datos de niveles de liquidos, generar estadisticas de consumo y enviar reportes graficos por correo electronico y por WhatsApp.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setView('login')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 justify-center"
            >
              Ingresar <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setFormData({...formData, slug: 'demo', password: 'demo'}); setLoginMode('admin'); setView('login'); }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2 justify-center"
            >
              Ver Demo
            </button>
            <button
              onClick={() => setView('register')}
              className="border-2 border-slate-500 text-gray-200 hover:bg-slate-800 font-bold px-8 py-4 rounded-xl transition-all hover:border-white shadow-lg"
            >
              Registrar Edificio
            </button>          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="py-16 px-6 bg-slate-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
              🎯 Pruébalo ahora — sin registrarte
            </span>
            <h3 className="text-2xl font-bold text-white mb-3">¿Deseas ver una demostración?</h3>
            <p className="text-gray-300 max-w-xl mx-auto">
              Explora el sistema completo con datos reales de un edificio de prueba.
              Usa el identificador <strong className="text-white">demo</strong> y la clave <strong className="text-white">demo</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Formulario de vecinos */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/40 transition-all flex flex-col">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                <Droplets className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-white font-bold text-lg mb-2">📋 Formulario de Registro</h4>
              <div className="flex-grow">
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  Vive la experiencia de reporte tal como la verían tus vecinos. Al ingresar un dato junto a tu email,
                  el sistema lo procesa al instante y te envía una muestra real a tu bandeja de entrada: un informe
                  completo con estadísticas, gráficos dinámicos e indicadores de inteligencia hídrica, exactamente
                  lo que recibirían los residentes de tu edificio cada vez que alguien reporta el nivel del tanque.
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-3 text-xs text-gray-300 mb-4 font-mono">
                🔑 Identificador: <strong className="text-blue-400">demo</strong>
              </div>
              <button
                onClick={() => { setFormData({...formData, slug: 'demo', password: ''}); setLoginMode('vecino'); setView('login'); }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-auto"
              >
                💧 Probar Formulario de Vecinos
              </button>
            </div>

            {/* Card 2: Portal del edificio */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-cyan-500/40 transition-all flex flex-col">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
              </div>
              <h4 className="text-white font-bold text-lg mb-2">⚙️ Portal del Edificio</h4>
              <div className="flex-grow">
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  Accede al panel de administración del edificio demo y explora el
                  <strong className="text-gray-200"> dashboard con gráficos históricos</strong>, la gestión
                  de miembros de la junta de condominio, reportes filtrables por rango de fechas, exportación a CSV,
                  corrección y eliminación de mediciones incorrectas, subida de banner personalizado y la
                  configuración general del edificio — todo en un solo lugar diseñado para el administrador.
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-3 text-xs text-gray-300 mb-4 font-mono">
                🔑 Identificador: <strong className="text-cyan-400">demo</strong> · Clave: <strong className="text-cyan-400">demo</strong>
              </div>
              <button
                onClick={() => { setFormData({...formData, slug: 'demo', password: 'demo'}); setLoginMode('admin'); setView('login'); }}
                className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-auto"
              >
                📊 Explorar Panel Administrador
              </button>
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSection />

      {/* CARACTERISTICAS */}
      <section id="features" className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Caracteristicas Principales</h2>
          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Captura de Datos</h3>
              <p className="text-gray-300">Registro facil y rapido de niveles de agua a traves de formularios simples y accesibles desde cualquier dispositivo.</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
                <Building className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Estadisticas de Consumo</h3>
              <p className="text-gray-300">Graficos detallados y analisis del comportamiento del consumo de agua con 20 indicadores de inteligencia.</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6">
                <Mail className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Reportes por Email y WhatsApp</h3>
              <p className="text-gray-300">Recibe automáticamente reportes gráficos con análisis detallado directamente en tu correo electrónico y por WhatsApp.</p>
            </div>

          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Planes: AquaSaaS 2026</h2>
            <p className="text-xl text-blue-400 mb-8">Control inteligente para comunidades que valoran cada gota.</p>
            
            {/* Toggle Mensual/Anual */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Mensual</span>
              <button 
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="w-14 h-7 bg-slate-700 rounded-full relative transition-colors duration-300 focus:outline-none ring-2 ring-blue-500/20"
              >
                <div className={`absolute top-1 w-5 h-5 bg-blue-500 rounded-full transition-all duration-300 ${billingCycle === 'yearly' ? 'left-8' : 'left-1'}`}></div>
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
                Anual <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full ml-1 font-bold">AHORRA 20%</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {/* Plan ESENCIAL */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 flex flex-col hover:border-blue-500/30 transition-all">
              <h3 className="text-2xl font-bold text-white mb-2">1. Plan ESENCIAL</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${getPrice('basico')}</span>
                <span className="text-slate-400 text-sm"> / {billingCycle === 'monthly' ? 'mes' : 'mes (anual)'}</span>
              </div>
              <p className="text-blue-400 font-medium mb-4">"La base de la tranquilidad comunitaria."</p>
              <p className="text-slate-400 text-sm mb-6">Ideal para juntas de condominio que necesitan orden en la comunicación y dejar de depender de rumores.</p>
              <ul className="space-y-3 text-slate-300 text-sm flex-grow mb-8">
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Alertas Inmediatas: Notificaciones vía email al reportante y a la Junta al instante. (Límite 50/mes).</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Configuración Fija: 5 emails post-registro y umbrales de alerta predeterminados (60%/40%).</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Dashboard de Control: Visualización del nivel actual y la última medición registrada.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Memoria de Datos: Historial de registros de 60 días para auditorías básicas.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Marca Estándar: Formulario de envío optimizado con el sello de confianza AquaSaaS.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Comunidad: Gestión de hasta 5 miembros administrativos.</li>
              </ul>
              <button 
                onClick={() => setView('register')}
                className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                Comenzar ahora
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Plan PROFESIONAL */}
            <div className="bg-slate-800/50 border border-blue-500/30 rounded-2xl p-8 flex flex-col hover:border-blue-500/50 transition-all relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">MÁS POPULAR</div>
              <h3 className="text-2xl font-bold text-white mb-2">2. Plan PROFESIONAL</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${getPrice('profesional')}</span>
                <span className="text-slate-400 text-sm"> / {billingCycle === 'monthly' ? 'mes' : 'mes (anual)'}</span>
              </div>
              <p className="text-blue-400 font-medium mb-4">"Gestión activa y transparencia vecinal."</p>
              <p className="text-slate-400 text-sm mb-6">Diseñado para edificios que buscan análisis y una imagen más institucional.</p>
              <ul className="space-y-3 text-slate-300 text-sm flex-grow mb-8">
                <li className="font-bold text-slate-200 mb-2">Todo lo del Plan Esencial, más:</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Configuración Flexible: Ajusta la cantidad de emails post-registro y niveles de alerta.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Reportes Manuales a un clic: Envía reportes de estado personalizados a miembros seleccionados.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Módulo de Estadísticas: Acceso a gráficos de participación y volumen de consumo mensual.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Exportación Inteligente: Descarga de datos en formato CSV para presentaciones.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Personalización Visual: Sube el Banner Exclusivo de tu Edificio (Branding comunitario).</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Capacidad Ampliada: Soporte para 150 emails/mes y hasta 10 miembros.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Historial Extendido: 120 días de registros acumulados.</li>
              </ul>
              <button 
                onClick={() => setView('register')}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                Comenzar ahora
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Plan PREMIUM */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 flex flex-col hover:border-blue-500/30 transition-all">
              <h3 className="text-2xl font-bold text-white mb-2">3. Plan PREMIUM</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${getPrice('premium')}</span>
                <span className="text-slate-400 text-sm"> / {billingCycle === 'monthly' ? 'mes' : 'mes (anual)'}</span>
              </div>
              <p className="text-blue-400 font-medium mb-4">"Inteligencia hidráulica y respuesta crítica."</p>
              <p className="text-slate-400 text-sm mb-6">Para condominios que exigen eficiencia máxima, automatización y alertas que no se ignoran. </p>
              <ul className="space-y-3 text-slate-300 text-sm flex-grow mb-8">
                <li className="font-bold text-slate-200 mb-2">Todo lo del Plan Profesional, más:</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Configuración Avanzada: Control total sobre notificaciones y umbrales preventivos.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Alertas vía WhatsApp: Integración crítica para umbrales mínimos (300 notificaciones/mes).</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Boletín Diario Programado: El sistema envía automáticamente un resumen cada mañana.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Mapa de Calor de Consumo: Visualiza franjas horarias y días de mayor gasto.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Proyecciones de Vaciado: Cálculo de duración según el ritmo de consumo actual.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Historial Extendido: Almacenamiento hasta 12 meses de registros acumulados.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" /> Roles Avanzados: Miembros ilimitados con permisos específicos.</li>
              </ul>
              <button 
                onClick={() => setView('register')}
                className="w-full py-4 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                Comenzar ahora
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Plan IA */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 flex flex-col hover:border-blue-500/30 transition-all opacity-90 border-dashed relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold py-1.5 px-4 text-center uppercase tracking-widest shadow-lg z-10">Próximamente Disponible</div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">4. Plan IA</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-white">${getPrice('ia')}</span>
                <span className="text-slate-400 text-sm"> / {billingCycle === 'monthly' ? 'mes' : 'mes (anual)'}</span>
              </div>
              <p className="text-blue-400 font-medium mb-4">"El futuro del ahorro: Prevención total."</p>
              <p className="text-slate-400 text-sm mb-6">(En Desarrollo - próximamente disponible)</p>
              <ul className="space-y-3 text-slate-300 text-sm flex-grow mb-8">
                <li className="font-bold text-slate-200 mb-2">Todo lo del Plan Premium, más:</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500/50 flex-shrink-0" /> Detección Algorítmica de Fugas: Escaneo automático de flujos anómalos nocturnos.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500/50 flex-shrink-0" /> Consultor IA: Análisis mensual sugerido sobre hábitos de consumo y ahorro.</li>
                <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-blue-500/50 flex-shrink-0" /> Gestión de Descanso Nocturno: Silenciamiento inteligente de alertas no críticas.</li>
              </ul>
              <button 
                disabled
                className="w-full py-4 bg-slate-800 text-slate-500 font-bold rounded-xl cursor-not-allowed border border-slate-700 flex flex-col items-center justify-center gap-1"
              >
                <span>En Desarrollo</span>
                <span className="text-[10px] font-normal italic">No disponible aún</span>
              </button>
              <a href="#contacto" className="text-blue-400 hover:text-blue-300 font-bold text-xs underline text-center mt-4">
                [i] Notificarme cuando esté listo
              </a>
            </div>
          </div>

          {/* Multitanque Nota */}
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 mb-16 text-center">
            <p className="text-slate-300">
              <span className="font-bold text-white">NOTA:</span> si su edificio o conjunto residencial o comercial tiene mas de un tanque de agua que desee controlar y monitorear con estas estadisticas, por favor <a href="#contacto" className="text-blue-400 hover:text-blue-300 font-bold underline">contactenos</a> para un Desarrollo particular multitanque.
            </p>
          </div>

          {/* Tabla Comparativa */}
          <div className="bg-slate-800/30 rounded-2xl p-1 overflow-hidden border border-slate-700/50 shadow-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="py-4 px-6 text-slate-400 font-medium uppercase text-[10px] tracking-wider">Característica</th>
                    <th className="py-4 px-6 text-white font-bold">ESENCIAL (Gratis/Prueba)</th>
                    <th className="py-4 px-6 text-white font-bold">(Profesional)</th>
                    <th className="py-4 px-6 text-white font-bold">(Premium)</th>
                    <th className="py-4 px-6 text-slate-400 font-bold italic">IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Tarifa {billingCycle === 'monthly' ? 'Mensual' : 'Anual'}</td>
                    <td className="py-4 px-6 text-white font-bold">${getPrice('basico')}{billingCycle === 'yearly' ? '*' : ''}</td>
                    <td className="py-4 px-6 text-white font-bold">${getPrice('profesional')}{billingCycle === 'yearly' ? '*' : ''}</td>
                    <td className="py-4 px-6 text-white font-bold">${getPrice('premium')}{billingCycle === 'yearly' ? '*' : ''}</td>
                    <td className="py-4 px-6 text-white font-bold">${getPrice('ia')}{billingCycle === 'yearly' ? '*' : ''}</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Registros</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Emails / mes</td>
                    <td className="py-4 px-6 text-slate-400">50</td>
                    <td className="py-4 px-6 text-slate-200 font-bold">200</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                    <td className="py-4 px-6 text-blue-400 font-bold">Ilimitados</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">WhatsApp</td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Sí (Alertas Críticas)</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Sí (Alertas Críticas)</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Reportes</td>
                    <td className="py-4 px-6 text-slate-400 text-xs">Dashboard Básico</td>
                    <td className="py-4 px-6 text-slate-200 text-xs font-semibold">Estadísticas de Sistema</td>
                    <td className="py-4 px-6 text-blue-400 font-bold text-xs uppercase tracking-tight">Inteligencia Hídrica</td>
                    <td className="py-4 px-6 text-blue-400 font-bold text-xs uppercase tracking-tight">Inteligencia Hídrica + Predictivo</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Historial</td>
                    <td className="py-4 px-6 text-slate-400 text-xs">60 días</td>
                    <td className="py-4 px-6 text-slate-200 text-xs font-semibold">120 días</td>
                    <td className="py-4 px-6 text-blue-400 font-bold text-xs">12 meses</td>
                    <td className="py-4 px-6 text-blue-400 font-bold text-xs">12 meses</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Banner / Branding</td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><CheckCircle className="w-5 h-5 text-green-500" /></td>
                    <td className="py-4 px-6"><CheckCircle className="w-5 h-5 text-green-500" /></td>
                    <td className="py-4 px-6"><CheckCircle className="w-5 h-5 text-green-500" /></td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Exportar CSV</td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><CheckCircle className="w-5 h-5 text-green-500" /></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">(Con gráficas)</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">(Con gráficas)</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Reporte Diario</td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">(Configurable)</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">(Configurable)</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Config. Emails Post-Registro</td>
                    <td className="py-4 px-6 text-slate-400 text-xs italic">Fijo (5)</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Umbrales de Alerta (%)</td>
                    <td className="py-4 px-6 text-slate-400 text-xs italic">Fijos (60%/40%)</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">Configurable</span>
                      </div>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6 text-slate-300 font-medium">Detección de Fugas</td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6"><div className="flex justify-start items-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 shadow-sm" /></div></td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                        <span className="text-[10px] text-blue-400 font-bold uppercase">(AI)</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {billingCycle === 'yearly' && (
              <p className="p-4 text-[10px] text-slate-500 italic">* Tarifa con 20% de descuento incluido por pago anual.</p>
            )}
          </div>
        </div>
      </section>
      {/* ACERCA DE */}
      <section id="acerca-de" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">AquaSaaS: Ingeniería de Datos para la Gestión Hídrica</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">Tecnología moderna al servicio de la eficiencia y transparencia en el manejo del agua en condominios.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Gestión Basada en Datos</h3>
              <p className="text-gray-300">Almacenamiento seguro y disponibilidad 24/7 de todos sus registros ingresados del nivel de agua.</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Visibilidad Total</h3>
              <p className="text-gray-300">Gráficos históricos, alertas de fugas y proyecciones basadas en datos.</p>            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                <CheckCircle className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Transparencia Comunitaria</h3>
              <p className="text-gray-300">Informes profesionales automáticos para copropietarios y junta de condominio.</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all">
              <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mb-6">
                <Building className="w-6 h-6 text-violet-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Optimización de Procesos</h3>
              <p className="text-gray-300">Eliminación del error humano mediante ingeniería de datos automatizada.</p>
            </div>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* CONTACTO */}
      <section id="contacto" className="py-20 px-6 bg-slate-800/30">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">¿Listo para automatizar el control de agua en tu edificio?</h2>
            <p className="text-xl text-gray-300">Déjanos tus datos y te contactaremos para una demostración personalizada.</p>
          </div>

          <form onSubmit={handleContactSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
            {contactSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                Mensaje enviado correctamente. Nos pondremos en contacto pronto.
              </div>
            )}
            {contactError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {contactError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  value={contactForm.nombre_apellido}
                  onChange={(e) => setContactForm({...contactForm, nombre_apellido: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Edificio *</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  value={contactForm.nombre_edificio}
                  onChange={(e) => setContactForm({...contactForm, nombre_edificio: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol en el Edificio</label>
              <select
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                value={contactForm.rol}
                onChange={(e) => setContactForm({...contactForm, rol: e.target.value})}
              >
                <option value="Administrador">Administrador</option>
                <option value="Presidente de Junta">Presidente de Junta</option>
                <option value="Tesorería">Tesorería</option>
                <option value="Residente">Residente</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                  placeholder="+58 416 1234567"
                  value={contactForm.whatsapp}
                  onChange={(e) => setContactForm({...contactForm, whatsapp: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje *</label>
              <textarea
                required
                rows={5}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black resize-y"
                placeholder="Cuéntanos sobre tu edificio y necesidades..."
                value={contactForm.mensaje}
                onChange={(e) => setContactForm({...contactForm, mensaje: e.target.value})}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : (
                <>
                  Enviar Mensaje <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Listo para comenzar?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Unete a los edificios que ya estan monitoreando su consumo de agua con AquaSaaS
          </p>
          <button
            onClick={() => setView('register')}
            className="bg-white text-blue-600 font-bold px-10 py-4 rounded-xl hover:bg-blue-50 transition-all shadow-lg"
          >
            Registrar Mi Edificio
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-slate-700/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">AquaSaaS</span>
          </div>
          <p className="text-slate-500 text-sm">
            © 2026 AquaSaaS. Todos los derechos reservados.
          </p>
          <div className="text-gray-300 text-sm flex gap-6">
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="/privacidad" className="hover:text-white transition-colors">Política de Privacidad</a>
            <a href="/disclaimer" className="hover:text-white transition-colors">Términos de Servicio</a>
          </div>
        </div>
      </footer>

      {/* Zapier Chatbot */}
      <Script 
        src="https://interfaces.zapier.com/assets/web-components/zapier-interfaces/zapier-interfaces.esm.js" 
        type="module"
        strategy="afterInteractive"
      />
      
      {/* @ts-ignore */}
      <zapier-interfaces-chatbot-embed 
        is-popup="true" 
        chatbot-id="cmoby1wx90033arnq1e04imh7" 
        height="600px" 
        width="400px"
      />

    </div>
  );
}
