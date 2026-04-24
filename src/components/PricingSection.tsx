'use client';

import { useState, useEffect } from 'react';
import { Check, Info, Sparkles, Zap, ShieldCheck, Rocket, MessageSquare, Clock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhvynlhbgpittimyopue.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ZINHGD4RZ1cPw2yIHcokxQ_MVlyMO-Z';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Plan {
  id: string;
  plan_id: string;
  nombre: string;
  precio: number;
  caracteristicas: any;
  activo: boolean;
}

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase.from('plan_precios').select('*').order('precio', { ascending: true });
      if (data) setPlans(data);
      setLoading(false);
    };
    loadPlans();
  }, []);

  // Características extendidas basadas en el plan_id
  const getExtendedFeatures = (planId: string) => {
    switch (planId) {
      case 'basico':
        return [
          { icon: <Users size={16} />, text: 'Hasta 50 vecinos suscritos' },
          { icon: <Clock size={16} />, text: 'Historial de 30 días' },
          { icon: <Zap size={16} />, text: 'Gráficos básicos de nivel' },
          { icon: <ShieldCheck size={16} />, text: 'Alertas Email al 20%' },
          { icon: <MessageSquare size={16} />, text: 'Entrada de datos manual' },
        ];
      case 'profesional':
        return [
          { icon: <Users size={16} />, text: 'Hasta 200 vecinos suscritos' },
          { icon: <Clock size={16} />, text: 'Historial de 1 año' },
          { icon: <Zap size={16} />, text: 'Dashboard Inteligente Completo' },
          { icon: <MessageSquare size={16} />, text: 'Alertas WhatsApp (Junta)' },
          { icon: <ShieldCheck size={16} />, text: 'Detección de fugas y anomalías' },
          { icon: <Rocket size={16} />, text: 'Reportes PDF para cartelera' },
        ];
      case 'ia':
      case 'empresarial':
        return [
          { icon: <Users size={16} />, text: 'Vecinos ilimitados' },
          { icon: <Clock size={16} />, text: 'Historial de por vida' },
          { icon: <Sparkles size={16} />, text: 'IA Predictiva: Proyección falta de agua' },
          { icon: <Rocket size={16} />, text: 'Soporte para sensores IoT' },
          { icon: <Zap size={16} />, text: 'API de integración' },
          { icon: <ShieldCheck size={16} />, text: 'Soporte prioritario 24/7' },
        ];
      default:
        return [];
    }
  };

  return (
    <section id="planes" className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Decoración de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-blue-400 font-bold tracking-widest uppercase text-sm mb-3">Inversión Inteligente</h2>
          <h3 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
            Planes diseñados para proteger su edificio
          </h3>
          <p className="text-slate-400 text-lg mb-10">
            Evite gastos inesperados en cisternas con una gestión eficiente del recurso hídrico.
          </p>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
          {plans.map((plan) => {
            const isPro = plan.plan_id === 'profesional';
            const isIA = plan.plan_id === 'ia' || plan.plan_id === 'empresarial';
            const price = billingCycle === 'yearly' ? plan.precio * 0.8 : plan.precio;
            const features = getExtendedFeatures(plan.plan_id);

            return (
              <div
                key={plan.plan_id}
                className={`flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border transition-all duration-500 ${
                  isPro 
                    ? 'border-blue-500 shadow-[0_0_40px_-15px_rgba(59,130,246,0.5)] lg:scale-105 z-20 bg-slate-800' 
                    : 'border-slate-700 hover:border-slate-500 z-10'
                }`}
              >
                {isPro && (
                  <div className="bg-blue-500 text-white text-center text-[10px] font-bold py-1 rounded-t-2xl uppercase tracking-widest">
                    Más Popular
                  </div>
                )}
                
                {isIA && (
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center text-[10px] font-bold py-1 rounded-t-2xl uppercase tracking-widest flex items-center justify-center gap-2">
                    <Sparkles size={12} /> Próximamente
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h4 className="text-white text-lg font-bold mb-1">{plan.nombre}</h4>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">${Math.round(price)}</span>
                      <span className="text-slate-400 text-[10px]">/ {billingCycle === 'monthly' ? 'mes' : 'mes (anual)'}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-[11px] leading-tight">
                        <div className={`p-0.5 mt-0.5 rounded-full ${isPro ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                          <Check size={12} />
                        </div>
                        <span className="flex-1">{feat.text}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isIA}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                      isIA 
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : isPro
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                          : 'bg-white text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {isIA ? 'En Desarrollo' : 'Comenzar ahora'}
                    {!isIA && <Rocket size={14} />}
                  </button>
                  
                  {isIA && (
                    <p className="text-[10px] text-slate-500 text-center mt-3 italic flex items-center justify-center gap-1">
                      <Info size={10} /> Notificarme cuando esté listo
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 bg-slate-800/30 border border-slate-700/50 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="text-white text-2xl font-bold mb-4 flex items-center gap-3">
              <MessageSquare className="text-blue-400" />
              ¿Necesita una solución personalizada?
            </h4>
            <p className="text-slate-400">
              Para conjuntos residenciales de múltiples torres, centros comerciales o integraciones IoT industriales, 
              diseñamos planes a medida de su infraestructura.
            </p>
          </div>
          <a 
            href="mailto:correojago@gmail.com" 
            className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-2xl font-bold transition-colors whitespace-nowrap"
          >
            Contactar Soporte
          </a>
        </div>
      </div>
    </section>
  );
}

// Sub-componentes de iconos para limpieza
function Users({ size }: { size: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
