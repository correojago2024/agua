/**
 * ARCHIVO: src/app/registro-confirmado/page.tsx
 * VERSION: 2.1
 * FECHA: 2026-04-05
 * CAMBIOS:
 * - CORRECCIÓN CRÍTICA: Renombrada carpeta de "registr-confirmado" (typo) a "registro-confirmado"
 *   para que la URL generada en page.tsx (/registro-confirmado) resuelva correctamente.
 * - Se mantiene toda la lógica original: lectura de params por URL y sessionStorage.
 * - Se mantiene toda la UI y estilos originales sin cambios.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Droplets, Copy, CheckCircle, Building, ArrowRight, Loader2 } from 'lucide-react';

// Componente interno con toda la lógica (requiere Suspense por useSearchParams)
function RegistroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [buildingData, setBuildingData] = useState<{
    name: string;
    slug: string;
    id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validamos que window exista para usar sessionStorage
    if (typeof window === 'undefined') return;

    const name = searchParams.get('name') || sessionStorage.getItem('building_name') || '';
    const slug = searchParams.get('slug') || sessionStorage.getItem('building_slug') || '';
    const id = searchParams.get('id') || sessionStorage.getItem('building_id') || '';

    if (name && slug && id) {
      setBuildingData({ name, slug, id });
    } else {
      router.push('/');
    }
    setLoading(false);

    // Limpiar después de leer
    sessionStorage.removeItem('building_name');
    sessionStorage.removeItem('building_slug');
    sessionStorage.removeItem('building_id');
  }, [searchParams, router]);

  const getReportUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/edificio/${buildingData?.slug}`;
    }
    return `/edificio/${buildingData?.slug}`;
  };

  const copyToClipboard = async () => {
    const url = getReportUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!buildingData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">aGuaSaaS</h1>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header verde de éxito */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mb-3">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">¡Registro Exitoso!</h2>
            <p className="text-green-100 mt-1 text-sm">Tu edificio ha sido registrado en aGuaSaaS</p>
          </div>

          {/* Contenido */}
          <div className="p-6">
            <p className="text-center text-slate-700 text-lg mb-6">
              El edificio <strong className="text-slate-900">{buildingData.name}</strong> ha sido registrado con éxito.
            </p>

            {/* Identificador */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tu Identificador</p>
              <p className="text-blue-600 font-bold text-lg">{buildingData.slug}</p>
              <p className="text-xs text-slate-400 mt-1">Guárdalo junto a tu clave para poder ingresar al sistema.</p>
            </div>

            {/* Link para vecinos */}
            <div className="bg-slate-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-slate-800">Link para tus vecinos:</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4">
                <code className="text-blue-600 text-sm break-all">{getReportUrl()}</code>
              </div>
              <button
                onClick={copyToClipboard}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar enlace
                  </>
                )}
              </button>
            </div>

            {/* Info adicional */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800 font-semibold mb-1">📧 Revisa tu correo electrónico</p>
              <p className="text-sm text-blue-700">
                Te hemos enviado un email de bienvenida con todos los datos de tu edificio y los enlaces importantes.
              </p>
            </div>

            {/* Botón ir al portal */}
            <button
              onClick={() => router.push(`/edificio/${buildingData.slug}`)}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg transition-all mb-3"
            >
              Ir al Portal del Edificio <ArrowRight className="w-4 h-4" />
            </button>

            {/* Botón registrar otro */}
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-all"
            >
              Registrar otro edificio
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          2026 aGuaSaaS - Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}

// Exportamos la página envuelta en Suspense (requerido por useSearchParams en Next.js)
export default function RegistroConfirmadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      }
    >
      <RegistroContent />
    </Suspense>
  );
}
