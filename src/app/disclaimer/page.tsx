/**
 * ARCHIVO: /src/app/disclaimer/page.tsx
 * Página de Términos y Condiciones - Sistema AquaSaaS
 */

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white font-sans">
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">AquaSaaS</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/" className="hover:text-white transition-colors text-sm">Volver al inicio</a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <section className="prose prose-invert prose-lg max-w-none text-slate-300 space-y-6">
          <h1 className="text-4xl font-bold text-white mb-2">Términos y Condiciones</h1>
          <p className="text-sm text-slate-400 mb-8">Última actualización: 24 de abril de 2026</p>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">1. Identificación del servicio</h2>
              <p>
                <strong>Sistema AquaSaaS</strong> (en adelante, “la Plataforma”) es un ecosistema digital de monitoreo, 
                análisis y gestión de recursos hídricos diseñado específicamente para condominios, edificios y 
                comunidades en el marco legal de la República Bolivariana de Venezuela. El uso de la Plataforma 
                implica la aceptación total de estos términos.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">2. Capacidad legal</h2>
              <p>Al utilizar este servicio, el usuario declara:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Ser mayor de edad (18+ años).</li>
                <li>Tener plena capacidad legal para contratar según el Código Civil venezolano.</li>
                <li>Actuar en representación de una Junta de Condominio debidamente constituida, comunidad de vecinos o bajo autorización expresa.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">3. Objeto del servicio</h2>
              <p>La Plataforma ofrece herramientas para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Monitoreo de niveles de tanques de agua mediante crowdsourcing.</li>
                <li>Generación de dashboards de inteligencia hídrica y proyecciones.</li>
                <li>Sistemas de alertas de anomalías y reportes estadísticos automatizados.</li>
                <li>Control histórico de consumo y llenado.</li>
              </ul>
              <p className="bg-amber-500/10 border-l-4 border-amber-500 p-4 mt-4 italic">
                <strong>Aviso:</strong> AquaSaaS es una herramienta de apoyo y gestión informativa, y NO sustituye las 
                obligaciones legales, contables o técnicas que el condominio deba cumplir ante las autoridades competentes.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">4. Registro y cuenta</h2>
              <p>El usuario registrado se compromete a:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Proporcionar información veraz sobre las mediciones y mantener los datos del edificio actualizados.</li>
                <li>Resguardar la confidencialidad de sus credenciales de acceso (Password de Administración).</li>
                <li>Notificar inmediatamente cualquier sospecha de acceso no autorizado.</li>
              </ul>
              <p>AquaSaaS no se hace responsable por daños derivados del uso indebido o negligente de las cuentas de usuario o la carga de datos erróneos.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">5. Uso permitido y prohibiciones</h2>
              <p>Queda terminantemente prohibido:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>El uso fraudulento, difamatorio o ilícito del sistema, incluyendo la carga deliberada de mediciones falsas.</li>
                <li>Intentar vulnerar la seguridad o acceder a datos de otros edificios registrados.</li>
                <li>Utilizar la plataforma para actividades prohibidas por la Ley Especial contra los Delitos Informáticos.</li>
                <li>Alterar, sabotear o realizar ingeniería inversa sobre el software.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">6. Disponibilidad del servicio</h2>
              <p>
                El servicio se ofrece bajo el modelo de "SaaS" (Software as a Service) según disponibilidad técnica. 
                Si bien trabajamos por un uptime del 99.9%, el acceso puede interrumpirse temporalmente por 
                mantenimientos programados o fallas externas de infraestructura (conectividad, electricidad, proveedores de nube).
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">7. Propiedad intelectual</h2>
              <p>
                Todo el software, código fuente, diseño gráfico de dashboards, algoritmos de proyección y logotipos 
                son propiedad intelectual. Se prohíbe la reproducción parcial o total, distribución o 
                creación de obras derivadas sin consentimiento expreso por escrito.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">8. Responsabilidad del usuario</h2>
              <p>
                El usuario es el único responsable de la integridad y veracidad de la información de niveles 
                cargada en el sistema, así como de asegurar que el uso de la plataforma cumple con las 
                normativas locales (incluyendo la Ley de Propiedad Horizontal).
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">9. Limitación de responsabilidad</h2>
              <p>AquaSaaS NO será responsable por:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Pérdida de datos resultante de causas externas fuera de nuestro control directo (fallas de proveedores como Supabase o Vercel).</li>
                <li>Daños indirectos, accidentales o lucro cesante derivados de la falta de suministro de agua.</li>
                <li>Decisiones operativas de racionamiento tomadas por la Junta de Condominio con base en la información mostrada por el sistema.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">10. Suspensión y terminación</h2>
              <p>Nos reservamos el derecho de suspender o cancelar el acceso a la plataforma en caso de incumplimiento de estos términos, o uso indebido que ponga en riesgo la integridad del sistema o la veracidad de los datos comunitarios.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">11. Legislación aplicable</h2>
              <p>Este acuerdo se rige por las leyes vigentes de la República Bolivariana de Venezuela, con especial énfasis en el Código de Comercio, la Ley de Propiedad Horizontal y la Ley Especial contra los Delitos Informáticos.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">12. Resolución de conflictos</h2>
              <p>Cualquier controversia se intentará resolver mediante negociación directa y amistosa. De no ser posible, las partes se someten a la jurisdicción de los tribunales competentes en la República Bolivariana de Venezuela.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/80 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; 2026 AquaSaaS. Inteligencia para la Gestión Hídrica en Condominios.</p>
        </div>
      </footer>
    </div>
  );
}
