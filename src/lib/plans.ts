/**
 * PLANES Y TARIFAS - aGuaSaaS
 * Sistema de gestión de planes subscription
 */

// Planes del sistema
export interface Plan {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  priceBs?: number;
  maxSubscribers: number | 'unlimited';
  features: string[];
  isPopular?: boolean;
  isCustom?: boolean;
  aiEnabled?: boolean;
}

// Lista de planes
export const PLANS: Plan[] = [
  {
    id: 'basico',
    name: 'Básico',
    nameEn: 'Basic',
    price: 9,
    maxSubscribers: 50,
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
    nameEn: 'Professional',
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
    id: 'premium',
    name: 'Premium',
    nameEn: 'Premium',
    price: 49,
    maxSubscribers: 'unlimited',
    isCustom: true,
    features: [
      'Suscriptores ilimitados',
      'Historial de 12 meses',
      'Integración personalizada',
      'API access',
      'Soporte dedicado 24/7',
    ],
  },
  {
    id: 'ia',
    name: 'Inteligencia Artificial',
    nameEn: 'AI Intelligence',
    price: 79,
    maxSubscribers: 'unlimited',
    aiEnabled: true,
    features: [
      'Todo del plan Premium',
      'Historial de 24 meses',
      'Análisis con IA',
      'Predicciones inteligentes',
      'Recomendaciones automatizadas',
      'Soporte 24/7 prioritario',
    ],
  },
];

// Obtener plan por ID
export function getPlanById(id: string): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

// Obtener precio formateado
export function formatPrice(plan: Plan, currency: 'USD' | 'Bs' = 'USD'): string {
  if (plan.isCustom) return 'Contactar';
  if (currency === 'Bs' && plan.priceBs) return `Bs ${plan.priceBs.toLocaleString()}`;
  return `$${plan.price}`;
}

// Verificar si puede agregar más suscriptores
export function canAddSubscribers(planId: string, currentCount: number): boolean {
  const plan = getPlanById(planId);
  if (!plan) return false;
  if (plan.maxSubscribers === 'unlimited') return true;
  return currentCount < plan.maxSubscribers;
}

// Actualizar precio de plan (para admin)
export function updatePlanPrice(planId: string, newPrice: number): void {
  const plan = PLANS.find(p => p.id === planId);
  if (plan) {
    plan.price = newPrice;
  }
}