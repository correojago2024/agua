'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Plan {
  id: string;
  plan_id: string;
  nombre: string;
  precio: number;
  caracteristicas: any;
  activo: boolean;
}

const defaultPlans: Plan[] = [
  { id: '1', plan_id: 'basico', nombre: 'Básico', precio: 9, caracteristicas: { suscriptores: 50, alertas_email: true, historial_meses: 3 }, activo: true },
  { id: '2', plan_id: 'profesional', nombre: 'Profesional', precio: 25, caracteristicas: { suscriptores: 200, alertas_sms: true, historial_ilimitado: true }, activo: true },
  { id: '3', plan_id: 'empresarial', nombre: 'Empresarial', precio: 49, caracteristicas: { suscriptores: 'ilimitado', api: true, soporte_24_7: true }, activo: true },
  { id: '4', plan_id: 'ia', nombre: 'IA Intelligence', precio: 79, caracteristicas: { suscriptores: 'ilimitado', ia: true, api: true, soporte_24_7: true }, activo: true },
];

const getPlanFeatures = (plan: Plan) => {
  const c = plan.caracteristicas;
  const features = [];
  if (c.suscriptores) features.push(`Hasta ${c.suscriptores} suscriptores`);
  if (c.alertas_email) features.push('Alertas por email');
  if (c.alertas_sms) features.push('Alertas por SMS');
  if (c.historial_meses) features.push(`Historial de ${c.historial_meses} meses`);
  if (c.historial_ilimitado) features.push('Historial ilimitado');
  if (c.api) features.push('API access');
  if (c.soporte_24_7) features.push('Soporte 24/7');
  if (c.ia) features.push('Análisis con IA');
  return features;
};

export default function PricingSection() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);

  useEffect(() => {
    const loadPlans = async () => {
      const { data } = await supabase.from('plan_precios').select('*').order('id');
      if (data && data.length > 0) setPlans(data);
    };
    loadPlans();
  }, []);

  const getPlanById = (planId: string) => plans.find(p => p.plan_id === planId);

  return (
    <section id="planes" className="py-20 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Planes flexibles para cada necesidad
          </h2>
          <p className="text-slate-400 text-lg">
            Elige el plan que mejor se adapte a tu edificio
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.plan_id}
              className={`relative bg-slate-800 rounded-2xl p-6 transition-all ${
                plan.plan_id === 'profesional'
                  ? 'ring-2 ring-blue-500 scale-105 shadow-2xl'
                  : 'hover:scale-102'
              }`}
              onMouseEnter={() => setHoveredPlan(plan.plan_id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {plan.plan_id === 'profesional' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Más popular
                </div>
              )}
              
              {plan.plan_id === 'ia' && (
                <div className="absolute -top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  🤖 IA
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.nombre}</h3>
                <div className="text-4xl font-bold text-white mb-1">
                  ${plan.precio}
                </div>
                <div className="text-slate-400">/mes</div>
              </div>

              <ul className="space-y-3 mb-6">
                {getPlanFeatures(plan).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <Check className={`w-5 h-5 flex-shrink-0 ${plan.plan_id === 'profesional' ? 'text-blue-400' : 'text-green-400'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-xl font-medium transition-colors ${
                  plan.plan_id === 'profesional'
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                Comenzar
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-slate-400 text-sm">
            ¿Necesitas un plan personalizado?{' '}
            <a href="mailto:correojago@gmail.com" className="text-blue-400 hover:text-blue-300">
              Contáctanos
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}