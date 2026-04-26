/**
 * ARCHIVO: admin/page.tsx (VERSIÓN SIMPLIFICADA - GALERÍA DE EMAILS REALES)
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

const supabaseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'buildings' | 'leads' | 'maintenance' | 'emails' | 'plans' | 'logs' | 'audit'>('buildings');
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailMsg, setEmailMsg] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState<string | null>(null);

  useEffect(() => { loadBuildings(); }, []);

  const loadBuildings = async () => {
    setLoading(true);
    const { data } = await supabase.from('buildings').select('*').order('created_at', { ascending: false });
    if (data) setBuildings(data);
    setLoading(false);
  };

  const testEmailReal = async (templateName: string) => {
    setTestEmailLoading(templateName);
    setEmailMsg('');
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ['correojago@gmail.com'],
          template: templateName
        })
      });
      const data = await res.json();
      if (data.success) {
        setEmailMsg(`✅ Enviado: Revisa tu buzón (Real identical ${templateName})`);
      } else {
        setEmailMsg('❌ Error: ' + data.error);
      }
    } catch (err: any) {
      setEmailMsg('❌ Error de red: ' + err.message);
    }
    setTestEmailLoading(null);
    setTimeout(() => setEmailMsg(''), 5000);
  };

  const emailTemplatesList = [
    { id: 'measurement_report', name: '📊 Reporte de Medición (Completo)', desc: 'El email que reciben los vecinos con gráficas, tablas y estado del tanque.', icon: '💧' },
    { id: 'welcome', name: '🎉 Bienvenida Administrador', desc: 'Email de bienvenida con accesos y primeros pasos.', icon: '🏢' },
    { id: 'anomaly_alert', name: '⚠️ Alerta de Anomalía (Fuga)', desc: 'Alerta roja urgente que se envía al detectar variaciones bruscas.', icon: '🚨' },
    { id: 'limit_90_storage', name: '📦 Alerta Almacenamiento 90%', desc: 'Aviso preventivo de cuota de almacenamiento alcanzada.', icon: '⚠️' },
    { id: 'junta_welcome', name: '🏛️ Bienvenida Junta', desc: 'Invitación oficial para miembros de la junta de condominio.', icon: '🤝' },
    { id: 'recover', name: '🔑 Recuperación de Clave', desc: 'Envío de credenciales para administradores que olvidaron su clave.', icon: '🔐' },
  ];

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-500 w-8 h-8" />
            <h1 className="text-xl font-bold text-white tracking-tight">SuperAdmin Portal</h1>
          </div>
          <nav className="flex gap-2">
            {['buildings', 'leads', 'emails', 'maintenance', 'plans', 'logs', 'audit'].map(v => (
              <button key={v} onClick={() => setActiveView(v as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-700 text-slate-400'}`}>
                {v.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {activeView === 'emails' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Mail className="w-8 h-8 text-blue-400" /> Visualización de Emails Reales
                </h2>
                <p className="text-slate-400 mt-2">Envía una copia idéntica de cada mensaje del sistema a <strong>correojago@gmail.com</strong> para verificar diseño y contenido.</p>
              </div>
              {emailMsg && <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/30 text-sm font-bold animate-bounce">{emailMsg}</div>}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {emailTemplatesList.map(tpl => (
                <div key={tpl.id} className="bg-slate-800 border border-slate-700 rounded-3xl p-6 hover:border-blue-500/50 transition-all group flex flex-col h-full shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">{tpl.icon}</div>
                    <div className="bg-slate-700/50 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">System Core</div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{tpl.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">{tpl.desc}</p>
                  
                  <button 
                    onClick={() => testEmailReal(tpl.id)}
                    disabled={testEmailLoading !== null}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {testEmailLoading === tpl.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Recibir Prueba en mi Email
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-12 bg-blue-900/20 border border-blue-500/20 rounded-3xl p-8 flex gap-6 items-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center text-3xl shrink-0">💡</div>
              <div>
                <h4 className="text-blue-400 font-bold mb-1">¿Cómo funcionan estas pruebas?</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Cada botón inyecta datos reales (gráficas, mapas de calor y proyecciones) generados dinámicamente. El diseño que recibas es <strong>exactamente el mismo</strong> que verán los usuarios finales del sistema.</p>
              </div>
            </div>
          </div>
        )}

        {activeView === 'buildings' && <div className="text-center py-20 text-slate-500 italic">Pestaña Edificios (Cargando lista...)</div>}
        {/* Resto de vistas se mantendrían igual en la implementación completa */}
      </main>
    </div>
  );
}
