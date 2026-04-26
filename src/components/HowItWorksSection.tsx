import React from 'react';
import { Droplets, Mail, CheckCircle, ArrowRight, RefreshCw, ClipboardList, Send } from 'lucide-react';

const HowItWorksSection = () => {
  return (
    <section id="como-funciona" className="py-24 px-6 bg-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Cómo funciona el sistema
          </h2>
          <p className="text-xl text-slate-400">
            Guía paso a paso para el registro de mediciones y el ciclo de comunicación
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 mb-20">
          {/* Paso 1 */}
          <div className="relative group">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all h-full flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Accede al formulario</h3>
              <p className="text-slate-300 text-sm">
                Abre el enlace de tu edificio en tu navegador. El reporte está disponible 24/7, los 365 días del año.
              </p>
            </div>
            <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
              <ArrowRight className="text-slate-700 w-8 h-8" />
            </div>
          </div>

          {/* Paso 2 */}
          <div className="relative group">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all h-full flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Ingresa la medición</h3>
              <p className="text-slate-300 text-sm mb-4">
                Dos formas de reportar:
              </p>
              <ul className="text-slate-400 text-xs text-left space-y-2">
                <li className="flex items-start gap-2">
                  <Droplets className="w-3 h-3 text-blue-500 mt-0.5" />
                  <span>En litros: cantidad consumida o nivel actual.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-3 h-3 text-blue-500 mt-0.5 font-bold">%</div>
                  <span>En porcentaje: nivel de llenado (ej: 75%).</span>
                </li>
              </ul>
            </div>
            <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
              <ArrowRight className="text-slate-700 w-8 h-8" />
            </div>
          </div>

          {/* Paso 3 */}
          <div className="relative group">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all h-full flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Completa tus datos</h3>
              <p className="text-slate-300 text-sm">
                Email (requerido) para identificación e informes. Nombre (opcional) para aparecer como colaborador.
              </p>
            </div>
            <div className="hidden md:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
              <ArrowRight className="text-slate-700 w-8 h-8" />
            </div>
          </div>

          {/* Paso 4 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 hover:border-blue-500/30 transition-all flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
              <span className="text-2xl font-bold">4</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Envía el reporte</h3>
            <p className="text-slate-300 text-sm">
              El sistema procesa tu medición de inmediato y recibirás un informe completo en tu correo en segundos.
            </p>
          </div>
        </div>

        {/* Sección del Ciclo */}
        <div className="bg-gradient-to-br from-blue-900/40 to-slate-800/40 border border-blue-500/20 rounded-3xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/2">
              <div className="inline-flex items-center gap-2 bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <Mail className="w-4 h-4" />
                <span>¿Qué pasa después de reportar?</span>
              </div>
              <h3 className="text-3xl font-bold text-white mb-6">
                Ciclo de comunicación inteligente
              </h3>
              <p className="text-slate-300 mb-8 leading-relaxed">
                El sistema activa un ciclo diseñado para mantenerte informado sin saturar tu bandeja de entrada, incentivando la participación comunitaria.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 flex-shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Tú reportas un dato</p>
                    <p className="text-slate-400 text-sm">Recibes informe completo y estadísticas históricas.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Seguimiento de vecinos</p>
                    <p className="text-slate-400 text-sm">Recibes hasta 5 emails por los reportes de tus vecinos.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 flex-shrink-0">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Reactivación necesaria</p>
                    <p className="text-slate-400 text-sm">Tras los 5 emails, debes reportar para reactivar el ciclo.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:w-1/2 w-full">
              <div className="bg-slate-900/80 rounded-2xl p-8 border border-slate-700/50 relative overflow-hidden">
                <h4 className="text-lg font-bold text-white mb-8 text-center">Visualización del Ciclo</h4>
                
                <div className="relative flex flex-col items-center gap-8">
                  <div className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold z-10 w-full text-center shadow-lg shadow-blue-900/20">
                    Tú reportas un dato
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <ArrowRight className="rotate-90 text-blue-500 w-6 h-6 mb-2" />
                    <div className="bg-slate-800 text-blue-300 border border-blue-500/30 px-6 py-3 rounded-xl z-10 w-full text-center">
                      Recibes informe completo
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <ArrowRight className="rotate-90 text-blue-500 w-6 h-6 mb-2" />
                    <div className="bg-slate-800 text-slate-300 border border-slate-700 px-6 py-3 rounded-xl z-10 w-full text-center">
                      5 emails por reportes de vecinos
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <ArrowRight className="rotate-90 text-blue-500 w-6 h-6 mb-2" />
                    <div className="bg-slate-800 text-yellow-500 border border-yellow-500/30 px-6 py-3 rounded-xl z-10 w-full text-center flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Debes reportar para reactivar
                    </div>
                  </div>

                  {/* Línea de retorno */}
                  <div className="absolute top-6 -right-4 bottom-6 w-8 border-y-2 border-r-2 border-blue-500/20 rounded-r-3xl hidden md:block"></div>
                  <div className="absolute top-1/2 -right-8 -translate-y-1/2 hidden md:block">
                    <div className="bg-slate-900 p-1">
                      <RefreshCw className="w-6 h-6 text-blue-500/40" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nueva Sección: Visualización de Resultados */}
        <div className="mt-32">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Información que recibirás en tu mano
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Visualiza estadísticas claras, proyecciones de consumo y reportes detallados diseñados para una toma de decisiones inteligente.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4 group">
              <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 group-hover:border-blue-500/50 transition-all shadow-xl">
                <img 
                  src="https://raw.githubusercontent.com/correojago2024/agua/main/grafico1.jpg" 
                  alt="Estadísticas de Consumo" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="px-2">
                <h4 className="text-white font-bold mb-2">Panel de Control Histórico</h4>
                <p className="text-slate-400 text-sm">Análisis detallado de tendencias y variaciones de consumo a lo largo del tiempo.</p>
              </div>
            </div>

            <div className="space-y-4 group">
              <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 group-hover:border-blue-500/50 transition-all shadow-xl">
                <img 
                  src="https://raw.githubusercontent.com/correojago2024/agua/main/grafico2.jpg" 
                  alt="Dashboard de Gestión" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="px-2">
                <h4 className="text-white font-bold mb-2">Dashboard de Inteligencia</h4>
                <p className="text-slate-400 text-sm">Indicadores clave de rendimiento (KPIs) para una gestión eficiente del recurso hídrico.</p>
              </div>
            </div>

            <div className="space-y-4 group">
              <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 group-hover:border-blue-500/50 transition-all shadow-xl">
                <img 
                  src="https://raw.githubusercontent.com/correojago2024/agua/main/grafico3email.jpg" 
                  alt="Reporte por Email" 
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="px-2">
                <h4 className="text-white font-bold mb-2">Reportes Automatizados</h4>
                <p className="text-slate-400 text-sm">Recibe notificaciones e informes gráficos directamente en tu bandeja de entrada.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
