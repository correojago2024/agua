/**
 * ARCHIVO: /src/app/privacidad/page.tsx
 * Política de Privacidad - Sistema AquaSaaS
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
            <a href="/" className="hover:text-white transition-colors text-sm">Volver al inicio</a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <section className="prose prose-invert prose-lg max-w-none text-slate-300 space-y-6">
          <h1 className="text-4xl font-bold text-white mb-2">Política de Privacidad</h1>
          <p className="text-sm text-slate-400 mb-8">Última actualización: 24 de abril de 2026</p>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">1. Responsable del tratamiento</h2>
              <p>
                El responsable del tratamiento de datos es <strong>AquaSaaS</strong>. Nos comprometemos a proteger la privacidad y seguridad de la información de nuestros usuarios en cumplimiento con las mejores prácticas y el marco legal aplicable.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">2. Datos recolectados</h2>
              <p>Podemos recopilar y procesar los siguientes tipos de información:</p>
              
              <div className="mt-4 space-y-4">
                <div className="bg-slate-700/30 p-4 rounded-lg">
                  <h3 className="text-blue-400 font-bold">a) Datos personales</h3>
                  <ul className="list-disc pl-6 text-sm">
                    <li>Nombre y Apellido.</li>
                    <li>N° de Identificación o Cédula (opcional/según configuración).</li>
                    <li>Correo electrónico (para envío de reportes).</li>
                  </ul>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg">
                  <h3 className="text-blue-400 font-bold">b) Datos operativos</h3>
                  <ul className="list-disc pl-6 text-sm">
                    <li>Mediciones de niveles hídricos reportados por los usuarios.</li>
                    <li>Información de unidades y propiedades asociadas al monitoreo.</li>
                    <li>Logs de variaciones y caudales registrados.</li>
                  </ul>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg">
                  <h3 className="text-blue-400 font-bold">c) Datos técnicos</h3>
                  <ul className="list-disc pl-6 text-sm">
                    <li>Dirección IP y ubicación aproximada.</li>
                    <li>Navegador y sistema operativo.</li>
                    <li>Logs de actividad del sistema para auditoría y seguridad.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">3. Finalidad del tratamiento</h2>
              <p>Los datos se utilizan exclusivamente para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Operar y mantener la funcionalidad de los dashboards inteligentes.</li>
                <li>Facilitar el monitoreo y control del recurso hídrico para la comunidad.</li>
                <li>Enviar alertas automatizadas sobre estados críticos del tanque.</li>
                <li>Garantizar la seguridad e integridad de los registros históricos.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">4. Base legal (Venezuela)</h2>
              <p>
                El tratamiento de datos se fundamenta en el consentimiento del usuario al reportar mediciones, el interés legítimo de la gestión de servicios comunes y el cumplimiento de las normativas de convivencia y propiedad horizontal.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">5. Compartición de datos</h2>
              <p>Los datos pueden compartirse únicamente con:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Proveedores tecnológicos:</strong> Servicios de infraestructura, base de datos y hosting necesarios para la operación.</li>
                <li><strong>Autoridades:</strong> Cuando sea estrictamente requerido por ley o mandamiento judicial.</li>
              </ul>
              <p className="font-bold text-blue-400 italic">Importante: AquaSaaS NO vende ni comercializa sus datos personales ni de consumo con terceros.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">6. Transferencias internacionales</h2>
              <p>Al utilizar servicios de infraestructura global (nube), el usuario acepta la transferencia técnica de datos bajo estándares internacionales de seguridad adecuados.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">7. Seguridad de la información</h2>
              <p>Aplicamos medidas de seguridad avanzadas, incluyendo:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cifrado de datos en tránsito (SSL/TLS).</li>
                <li>Políticas de control de acceso restringido.</li>
                <li>Monitoreo preventivo de actividad inusual.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">8. Derechos del usuario</h2>
              <p>Usted tiene derecho a:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Acceder a la información registrada sobre sus reportes.</li>
                <li>Solicitar rectificación de datos inexactos a través del administrador.</li>
                <li>Solicitar la eliminación de su registro (siempre que no existan obligaciones administrativas vigentes).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">9. Retención de datos</h2>
              <p>Los datos se conservarán mientras el edificio mantenga el servicio activo para fines estadísticos e históricos de la comunidad.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">10. Cookies</h2>
              <p>Utilizamos cookies técnicas para optimizar la experiencia de navegación y sesiones de administración. No utilizamos cookies de rastreo publicitario.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">11. Cambios en la política</h2>
              <p>Podremos actualizar esta política. Los cambios serán notificados vía plataforma o correo electrónico registrado.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/80 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; 2026 AquaSaaS. Compromiso con la Transparencia Comunitaria.</p>
        </div>
      </footer>
    </div>
  );
}
