/**
 * ARCHIVO: src/app/edificio/[slug]/page.tsx
 * VERSIÓN: 1.6
 * FECHA: 2026-04-29
 *
 * CAMBIOS v1.6:
 * - Se restaura el campo de fecha y hora a un solo input nativo (datetime-local).
 * - Se asegura el formato dd/mm/aaaa hh:mm AM/PM (dependiente del navegador, pero con lang="es").
 * - Se mantiene la lógica de preservación de hora local al enviar al API.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Droplets, Send, CheckCircle2, AlertTriangle, Info, RefreshCw, Calendar } from 'lucide-react';
import { formatNumber, formatDateTime } from '@/lib/formatters';

export default function ResidentForm() {
  const { slug } = useParams();
  const [building, setBuilding]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState('');

  const [formData, setFormData] = useState({
    recorded_at: (() => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    })(),
    liters:            '',
    percentage:        '',
    email:             '',
    collaborator_name: ''
  });

  // ── Cargar datos del edificio ──────────────────────────────────────────
  useEffect(() => {
    async function fetchBuilding() {
      const slugParam = slug as string;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam);

      const { data, error: fetchError } = isUUID
        ? await supabase.from('buildings').select('*').eq('id',   slugParam).single()
        : await supabase.from('buildings').select('*').eq('slug', slugParam).single();

      if (fetchError || !data) setError('Edificio no encontrado');
      else if (data.status === 'Inactivo') setError('INACTIVO: Este edificio está desactivado y no acepta nuevas mediciones. Contacte al administrador del sistema.');
      else if (data.status === 'Suspendido') setError('SUSPENDIDO: La cuenta de este edificio está suspendida. No se pueden registrar nuevas mediciones. Por favor contacte al administrador del sistema para reactivar su cuenta.');
      else {
        setBuilding(data);
      }
      setLoading(false);
    }
    fetchBuilding();
  }, [slug]);

  // ── Enviar formulario ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lts = formData.liters     ? parseFloat(formData.liters)     : null;
    const pct = formData.percentage ? parseFloat(formData.percentage) : null;

    if (lts === null && pct === null) {
      setError('Por favor ingresa al menos un dato del nivel (Litros o Porcentaje)');
      return;
    }
    if (lts !== null && building?.tank_capacity_liters && lts > building.tank_capacity_liters) {
      setError(`Los litros no pueden superar la capacidad máxima del tanque (${building.tank_capacity_liters.toLocaleString()} LTS)`);
      return;
    }
    if (pct !== null && pct > 100) {
      setError('El porcentaje no puede ser mayor al 100%');
      return;
    }

    setLoading(true);
    try {
      let finalLiters     = lts;
      let finalPercentage = pct;

      if (lts !== null && pct === null && building?.tank_capacity_liters) {
        finalPercentage = (lts / building.tank_capacity_liters) * 100;
      } else if (pct !== null && lts === null && building?.tank_capacity_liters) {
        finalLiters = (pct / 100) * building.tank_capacity_liters;
      }

      const response = await fetch('/api/measurements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          building_id:       building.id,
          recorded_at:       formData.recorded_at, // YYYY-MM-DDTHH:mm (formato nativo)
          liters:            finalLiters,
          percentage:        finalPercentage,
          email:             formData.email             || null,
          collaborator_name: formData.collaborator_name || 'Anónimo',
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);

      setSubmitted(true);
    } catch (err: any) {
      setError('Error al guardar los datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !building) return <div className="p-8 text-center text-blue-600 font-bold">Cargando formulario...</div>;
  if (error && !building) return <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2"><AlertTriangle /> {error}</div>;

  return (
    <main className="min-h-screen bg-slate-100 p-2 md:p-8 flex flex-col items-center justify-start md:justify-center">
      <div className="max-w-2xl w-full bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-4">

        {/* Header */}
        {building?.banner_url ? (
          <div className="relative overflow-hidden h-40 md:h-64 bg-slate-900">
             <img src={building.banner_url} alt={`Banner ${building.name}`} className="w-full h-full object-cover relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-20" />
            <div className="absolute bottom-0 left-0 right-0 p-4 z-30">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <Droplets size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">Reporte Oficial</p>
                  <h1 className="text-xl md:text-2xl font-black text-white">{building?.name}</h1>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-600 p-6 md:p-8 text-white">
            <div className="flex items-center gap-3 md:gap-4 mb-4">
              <div className="bg-white/20 p-2 md:p-3 rounded-2xl">
                <Droplets size={32} className="md:w-10 md:h-10" />
              </div>
              <div>
                <p className="text-blue-100 text-xs md:text-sm font-bold uppercase tracking-wider">Reporte de Agua</p>
                <h1 className="text-xl md:text-3xl font-black">{building?.name}</h1>
              </div>
            </div>
          </div>
        )}

        {submitted ? (
          <div className="p-6 md:p-10 space-y-6 md:y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="space-y-3 md:space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full mb-1">
                <CheckCircle2 size={40} className="text-green-600 md:w-12 md:h-12" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800">✨ ¡MUCHAS GRACIAS por tu reporte! ✨</h2>
              <p className="text-base md:text-lg text-slate-600 font-medium tracking-tight">Tu valiosa información ha sido registrada exitosamente. ✅</p>
            </div>
            <button onClick={() => { setSubmitted(false); setFormData({ ...formData, liters: '', percentage: '' }); }} className="bg-slate-100 text-slate-600 font-bold px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mx-auto text-sm md:text-base">
              <RefreshCw size={18} /> REALIZAR OTRO REPORTE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 md:space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-3 md:p-4 rounded-xl md:rounded-2xl flex gap-3 text-amber-800 text-[11px] md:text-sm">
              <Info className="shrink-0 w-4 h-4 md:w-5 md:h-5" />
              <p>Por favor, transcriba los detalles que visualizó en el panel (<strong>litros o porcentaje</strong>). Indique la hora exacta de la medición.</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 md:p-4 rounded-xl text-xs md:text-sm font-bold border border-red-200 flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" /> {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5">Indique la Fecha y hora de la medición</label>
                <input
                  type="datetime-local"
                  required
                  lang="es-ES"
                  className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-black font-medium text-sm md:text-base"
                  value={formData.recorded_at}
                  onChange={e => setFormData({ ...formData, recorded_at: e.target.value })}
                />
                <p className="text-[10px] text-slate-500 mt-1 italic">* Use el formato día/mes/año hora:minutos.</p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5">Cantidad de Litros (LTS)</label>
                <input type="number" step="0.01" placeholder="Ej: 119237" className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-black font-bold placeholder:text-slate-400 text-sm md:text-base" value={formData.liters} onChange={e => setFormData({ ...formData, liters: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5">Porcentaje (%)</label>
                <input type="number" step="0.1" placeholder="Ej: 68" className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-black font-bold placeholder:text-slate-400 text-sm md:text-base" value={formData.percentage} onChange={e => setFormData({ ...formData, percentage: e.target.value })} />
              </div>
            </div>

            <div className="pt-3 md:pt-4 border-t border-slate-100">
              <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5">Tu Correo Electrónico (Opcional)</label>
              <input type="email" placeholder="vecino@correo.com" className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-black font-medium placeholder:text-slate-400 text-sm md:text-base" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1.5">Su Nombre o N° Apto. (Opcional)</label>
              <input type="text" placeholder="Ej: Carlos - Apto 4B" className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all text-black font-medium placeholder:text-slate-400 text-sm md:text-base" value={formData.collaborator_name} onChange={e => setFormData({ ...formData, collaborator_name: e.target.value })} />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-black text-lg md:text-xl flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all disabled:opacity-50">
              {loading ? 'Procesando...' : <><Send className="w-5 h-5 md:w-6 md:h-6" /> ENVIAR MI REPORTE</>}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
