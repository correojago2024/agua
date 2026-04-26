'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: "¿Es realmente rentable contratar aGuaSaaS para mi edificio?",
    answer: "Absolutamente. El sistema se paga solo con evitar la solicitud de una sola cisterna al año. Una cisterna en Caracas cuesta entre $60 y $120; gracias a la planificación y proyecciones que ofrece aGuaSaaS, las juntas de condominio pueden administrar mejor el recurso y evitar pedidos de emergencia por mala gestión."
  },
  {
    question: "¿Cómo se obtienen los datos del nivel del tanque?",
    answer: "El sistema funciona bajo un modelo de colaboración (crowdsourcing). Los vecinos autorizados o el personal del edificio ingresan la medición manual desde su celular. También ofrecemos integración con sensores ultrasónicos IoT para automatización total en planes avanzados."
  },
  {
    question: "¿Quiénes pueden ver los datos de mi edificio?",
    answer: "La privacidad es nuestra prioridad. Solo los vecinos que se registren y sean validados por el administrador de su edificio pueden acceder al dashboard y recibir reportes. Los datos no son públicos para otros edificios."
  },
  {
    question: "¿Qué pasa si el nivel del tanque llega a un punto crítico?",
    answer: "aGuaSaaS envía alertas automáticas por Email y WhatsApp (según el plan) cuando el tanque baja de ciertos umbrales (ej. 20%). Esto permite a la Junta de Condominio tomar decisiones de racionamiento preventivo antes de que el agua se agote totalmente."
  },
  {
    question: "¿Puedo probar el sistema antes de pagar?",
    answer: "Sí, todos los edificios nuevos cuentan con un período de prueba gratuito de 15 días con todas las funciones profesionales activas para que la comunidad compruebe el valor de la herramienta."
  },
  {
    question: "¿Qué soporte técnico ofrecen?",
    answer: "Contamos con soporte por correo electrónico para todos los planes y atención prioritaria vía WhatsApp para los planes Profesional y Enterprise, garantizando que su dashboard esté siempre operativo."
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-slate-800/50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <HelpCircle size={14} /> Resolviendo Dudas
          </div>
          <h3 className="text-4xl font-extrabold text-white mb-4">Preguntas Frecuentes</h3>
          <p className="text-slate-400 text-lg">Todo lo que necesita saber sobre el Sistema aGuaSaaS</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div 
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-slate-700/50 transition-colors"
              >
                <span className="text-white font-bold text-lg leading-tight">{faq.question}</span>
                <div className={`p-2 rounded-lg bg-slate-700 text-blue-400 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="p-6 pt-0 text-slate-300 text-base leading-relaxed border-t border-slate-700/50">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
