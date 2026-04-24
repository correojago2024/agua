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
                El responsable del tratamiento de datos es <strong>AquaSaaS</strong>. Nos comprometemos a proteger 
                la privacidad y seguridad de la información de nuestros usuarios (administradores y colaboradores) 
                en cumplimiento con las mejores prácticas y el marco legal aplicable en Venezuela.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">2. Datos recolectados</h2>
              <p>Podemos recopilar y procesar los siguientes tipos de información:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-blue-400 font-bold mb-2">a) Datos personales</h3>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Nombre y Apellido (Colaboradores).</li>
                    <li>N° de Apartamento o identificación comunitaria.</li>
                    <li>Correo electrónico (para recepción de reportes).</li>
                  </ul>
                </div>
                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-blue-400 font-bold mb-2">b) Datos operativos</h3>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Mediciones de niveles de tanque (litros/porcentaje).</li>
                    <li>Historial de variaciones y caudales.</li>
                    <li>Configuraciones de capacidad de tanques del edificio.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600 mt-4">
                <h3 className="text-blue-400 font-bold mb-2">c) Datos técnicos</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Dirección IP y ubicación aproximada.</li>
                  <li>Navegador y sistema operativo.</li>
                  <li>Logs de actividad del sistema para auditoría de seguridad y depuración.</li>
                </ul>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">3. Finalidad del tratamiento</h2>
              <p>Los datos se utilizan exclusivamente para:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Operar y mantener la funcionalidad de los dashboards inteligentes.</li>
                <li>Facilitar la gestión de suministro de agua por parte de las Juntas de Condominio.</li>
                <li>Enviar alertas automáticas sobre niveles críticos o anomalías.</li>
                <li>Garantizar la seguridad, integridad y auditoría de los registros comunitarios.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">4. Base legal (Venezuela)</h2>
              <p>
                El tratamiento de datos se fundamenta en el consentimiento expreso del usuario al reportar datos, 
                el interés legítimo de la comunidad de vecinos para la gestión de servicios comunes 
                y el cumplimiento de obligaciones derivadas de la Ley de Propiedad Horizontal.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">5. Compartición de datos</h2>
              <p>Los datos pueden compartirse únicamente con:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Proveedores tecnológicos:</strong> Servicios de base de datos (Supabase), hosting (Vercel) e infraestructura necesarios para la operación.</li>
                <li><strong>Autoridades:</strong> Cuando sea estrictamente requerido por ley o mandamiento judicial bajo la legislación venezolana.</li>
              </ul>
              <p className="font-bold text-blue-400 mt-2 italic">
                Importante: AquaSaaS NO vende ni comercializa sus datos personales ni los datos de consumo del edificio con terceros.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">6. Transferencias internacionales</h2>
              <p>Al utilizar nuestra plataforma basada en la nube, el usuario acepta la transferencia técnica de datos a servidores seguros ubicados fuera de Venezuela, operados bajo estándares internacionales de seguridad (SOC2/GDPR).</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">7. Seguridad de la información</h2>
              <p>Aplicamos medidas de seguridad avanzadas, incluyendo:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cifrado de datos en tránsito (SSL/TLS).</li>
                <li>Políticas de control de acceso mediante contraseñas cifradas.</li>
                <li>Monitoreo de actividad para prevenir accesos no autorizados.</li>
              </ul>
              <p className="text-xs text-slate-400 mt-2 italic">Nota: Aunque aplicamos altos estándares, ningún sistema de transmisión electrónica es 100% invulnerable.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">8. Derechos del usuario</h2>
              <p>Usted tiene derecho a:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Acceder a los registros de mediciones asociados a su edificio.</li>
                <li>Rectificar información errónea cargada en el sistema a través del administrador.</li>
                <li>Solicitar la eliminación de registros personales cuando no existan obligaciones de transparencia comunitaria.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">9. Retención de datos</h2>
              <p>Los datos operativos se conservarán mientras el edificio mantenga su cuenta activa para fines históricos y estadísticos, necesarios para la correcta proyección del servicio.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">10. Cookies</h2>
              <p>Utilizamos cookies técnicas estrictamente necesarias para mantener la sesión de administración activa. No utilizamos cookies de rastreo publicitario.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">11. Menores de edad</h2>
              <p>Nuestro servicio está dirigido a la gestión de servicios comunes de vivienda y presupone la actuación de personas con capacidad legal de reporte.</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-white border-b border-slate-700 pb-2">12. Cambios en la política</h2>
              <p>Podremos actualizar esta política para adaptarla a mejoras técnicas o cambios legislativos. La última versión siempre estará disponible en esta dirección.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/80 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>&copy; 2026 AquaSaaS. Compromiso con la Privacidad y Gestión Eficiente.</p>
        </div>
      </footer>
    </div>
  );
}
