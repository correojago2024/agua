'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

// Planes - estos deberían cargarse desde config en DB
const defaultPlans = [
  {
    id: 'basico',
    name: 'Básico',
    price: 9,
    maxSubscribers: 50,
    isPopular: false,
    features: [
      'Hasta 50 suscriptores',
      'Alertas por email',
      'Historial de 3 meses',
      'Dashboard básico',
      'Soporte por email',
    ],
  },
  {
    id: 'profesional',
    name: 'Profesional',
    price: 25,
    maxSubscribers: 200,
    isPopular: true,
    features: [
      'Hasta 200 suscriptores',
      'Alertas por email y SMS',
      'Historial ilimitado',
      'Dashboards personalizados',
      'Exportación de reportes',
      'Soporte prioritario',
    ],
  },
  {
    id: 'empresarial',
    name: 'Empresarial',
    price: 49,
    maxSubscribers: 'unlimited',
    isCustom: true,
    features: [
      'Suscriptores ilimitados',
      'Todo incluido',
      'Integración personalizada',
      'API access',
      'Soporte dedicado 24/7',
    ],
  },
  {
    id: 'ia',
    name: 'IA Intelligence',
    price: 79,
    maxSubscribers: 'unlimited',
    aiEnabled: true,
    features: [
      'Todo del plan Empresarial',
      'Análisis con IA',
      'Predicciones inteligentes',
      'Recomendaciones automatizadas',
      'Reportes inteligentes',
      'Soporte 24/7 prioritario',
    ],
  },
];

export default function PricingSection() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

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
          {defaultPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-800 rounded-2xl p-6 transition-all ${
                plan.isPopular
                  ? 'ring-2 ring-blue-500 scale-105 shadow-2xl'
                  : 'hover:scale-102'
              }`}
              onMouseEnter={() => setHoveredPlan(plan.id)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Más popular
                </div>
              )}
              
              {plan.aiEnabled && (
                <div className="absolute -top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  🤖 IA
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                
                {!plan.isCustom && !plan.aiEnabled && (
                  <>
                    <div className="text-4xl font-bold text-white mb-1">
                      ${plan.price}
                    </div>
                    <div className="text-slate-400">/mes</div>
                  </>
                )}
                
                {!plan.isCustom && plan.aiEnabled && (
                  <>
                    <div className="text-4xl font-bold text-white mb-1">
                      ${plan.price}
                    </div>
                    <div className="text-slate-400">/mes</div>
                  </>
                )}
                
                {plan.isCustom && (
                  <div className="text-2xl font-bold text-white">Contactar</div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <Check className={`w-5 h-5 flex-shrink-0 ${plan.isPopular ? 'text-blue-400' : 'text-green-400'}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-xl font-medium transition-colors ${
                  plan.isPopular
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {plan.isCustom ? 'Contactar' : plan.aiEnabled ? 'Comenzar' : 'Comenzar'}
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