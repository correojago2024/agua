/**
 * ARCHIVO: /src/app/privacidad/page.tsx
 * Página de Política de Privacidad (Bilingüe) - AquaSaaS
 */

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold text-white mb-6">Política de Privacidad</h1>
          <p className="text-sm border-l-4 border-blue-500 pl-4 py-1 bg-blue-500/10">
            <strong>Última actualización:</strong> 8 de Abril de 2026
          </p>
          <p>
            En <strong>AquaSaaS</strong>, valoramos su privacidad. Esta política describe cómo manejamos la información en nuestra plataforma de monitoreo comunitario.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">1. Información que Recopilamos</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Datos Personales:</strong> Nombre, correo y teléfono que usted proporciona al registrarse.</li>
            <li><strong>Datos de Gestión (Crowdsourcing):</strong> Niveles de agua ingresados manualmente por los usuarios autorizados.</li>
            <li><strong>Datos Técnicos:</strong> Registros de acceso y dirección IP para auditoría de seguridad.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">2. Uso y Divulgación</h2>
          <p>Los datos se usan para generar proyecciones de suministro y alertas. No vendemos ni compartimos sus datos con fines comerciales. Utilizamos proveedores como <strong>Supabase, Make y Google Cloud</strong> para el funcionamiento técnico.</p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700">3. Seguridad</h2>
          <p>Implementamos medidas técnicas para proteger los datos, aunque recordamos que ningún sistema en internet es 100% impenetrable.</p>
        </section>

        <hr className="border-slate-700" />

        {/* SECTION IN ENGLISH */}
        <section className="prose prose-invert prose-lg max-w-none text-slate-400 space-y-4 italic">
          <h1 className="text-4xl font-bold text-white mb-6 font-sans not-italic">Privacy Policy</h1>
          <p className="text-sm border-l-4 border-slate-600 pl-4 py-1 bg-slate-800/50 not-italic">
            <strong>Last Updated:</strong> April 8, 2026
          </p>
          <p>
            At <strong>AquaSaaS</strong>, we value your privacy. This policy describes how we handle information within our community monitoring platform.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">1. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Personal Data:</strong> Name, email, and phone number provided during registration.</li>
            <li><strong>Management Data (Crowdsourcing):</strong> Water levels manually entered by authorized users.</li>
            <li><strong>Technical Data:</strong> Access logs and IP addresses for security auditing.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">2. Use and Disclosure</h2>
          <p>Data is used to generate supply projections and alerts. We do not sell or share your data for commercial purposes. We use providers such as <strong>Supabase, Make, and Google Cloud</strong> for technical operations.</p>
          
          <h2 className="text-2xl font-semibold text-white pt-6 border-t border-slate-700 not-italic">3. Security</h2>
          <p>We implement technical measures to protect data, although we remind users that no internet-based system is 100% impenetrable.</p>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/80 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} AquaSaaS. [ES] Todos los derechos reservados. [EN] All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
