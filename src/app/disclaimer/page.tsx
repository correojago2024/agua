/**
 * ARCHIVO: /src/app/disclaimer/page.tsx
 * Página de Descargo de Responsabilidad (Bilingüe) - AquaSaaS
 */

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white font-sans">
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">AquaSaaS</span>
          </a>
          <nav className="flex items-center gap-6">
            <a href="/#features" className="hover:text-white transition-colors text-sm">Características</a>
            <a href="/#contacto" className="hover:text-white transition-colors text-sm">Contacto</a>
            <a href="/" className="hover:text-white transition-colors text-sm">Volver al Inicio</a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        
        {/* SECCIÓN EN ESPAÑOL */}
        <section className="prose prose-invert prose-lg max-w-none text-slate-300 space-y-4">
          <h1 className="text-4xl font-bold text-white mb-6">Descargo de Responsabilidad</h1>
          <p className="text-sm border-l-4 border-amber-500 pl-4 py-1 bg-amber-500/10">
            <strong>Última actualización:</strong> 8 de Abril de 2026
          </p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">1. Exactitud de los Datos</h2>
          <p>AquaSaaS es una herramienta de soporte basada en <strong>entrada manual de datos</strong>. No garantizamos la exactitud de los niveles reportados, ya que dependen de la veracidad y frecuencia del ingreso realizado por los usuarios.</p>
          
          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">2. Responsabilidad Operativa</h2>
          <p>Las decisiones de racionamiento o gestión hídrica son responsabilidad exclusiva de las <strong>Juntas de Condominio</strong>. AquaSaaS no se hace responsable por daños derivados de interpretaciones de los datos.</p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">3. Suministro Externo</h2>
          <p>No tenemos control sobre el suministro de entes como Hidrocapital. La disponibilidad de agua es ajena a nuestra plataforma técnica.</p>

          <div className="mt-8 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl">
             <p className="text-base italic">Nota: Para mayor precisión, contácteme para recomendarle sistemas de <strong>medición ultrasónica</strong> automáticos.</p>
          </div>
        </section>

        <hr className="border-slate-700" />

        {/* SECTION IN ENGLISH */}
        <section className="prose prose-invert prose-lg max-w-none text-slate-400 space-y-4 italic">
          <h1 className="text-4xl font-bold text-white mb-6 font-sans not-italic">Disclaimer</h1>
          <p className="text-sm border-l-4 border-slate-600 pl-4 py-1 bg-slate-800/50 not-italic">
            <strong>Last Updated:</strong> April 8, 2026
          </p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">1. Data Accuracy</h2>
          <p>AquaSaaS is a support tool based on <strong>manual data entry</strong>. We do not guarantee the accuracy of reported levels, as they depend on the veracity and frequency of user input.</p>
          
          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">2. Operational Responsibility</h2>
          <p>Decisions regarding water rationing or management are the sole responsibility of <strong>Condominium Boards</strong>. AquaSaaS is not liable for damages resulting from data interpretation.</p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">3. External Supply</h2>
          <p>We have no control over water supply from entities like Hidrocapital. Water availability is independent of our technical platform.</p>

          <div className="mt-8 p-6 bg-blue-900/10 border border-slate-700 rounded-xl not-italic">
             <p className="text-sm">Note: For higher precision, contact me to discuss automatic <strong>ultrasonic measurement</strong> systems.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/80 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} AquaSaaS. Support Tool for Water Management.</p>
        </div>
      </footer>
    </div>
  );
}
