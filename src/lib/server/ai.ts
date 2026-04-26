
/**
 * ARCHIVO: src/lib/server/ai.ts
 * DESCRIPCIÓN: Servicio para interactuar con Gemini AI para el análisis de agua.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyACK6P75MupwOMHFVD3MwkiHYHz-EW5iVs';

// Lista de modelos a probar. Prioridad absoluta al que el usuario confirma que funciona.
const MODELOS_RESPALDO = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

// Versiones de la API a intentar
const API_VERSIONS = ['v1beta', 'v1'];

export async function generateWaterAnalysis(prompt: string) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  let erroresDetallados: string[] = [];

  for (const modelo of MODELOS_RESPALDO) {
    for (const version of API_VERSIONS) {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text.length > 100) {
            console.log(`[AI] ✅ ÉXITO con ${modelo} (${version})`);
            return text;
          }
        } else {
          const msg = data?.error?.message || 'Error desconocido';
          console.warn(`[AI] Falló ${modelo} en ${version}: ${response.status} - ${msg}`);
          erroresDetallados.push(`${modelo}(${version}): ${response.status}`);
          
          // Si es un error de cuota (429) o no encontrado (404), probamos la siguiente combinación
          continue;
        }
      } catch (error: any) {
        console.error(`[AI] Error de red en ${modelo} (${version}):`, error.message);
        erroresDetallados.push(`${modelo}(${version}): Network Error`);
      }
    }
  }

  throw new Error(`No se pudo conectar con los servidores de IA. Intentamos: ${erroresDetallados.join(', ')}. Verifica que la API Key sea válida para estos modelos en Vercel.`);
}

/**
 * Mejora visualmente el texto plano de la IA para mostrarlo en HTML.
 * Convierte markdown simple y saltos de línea en estructura HTML bonita.
 */
export function formatAiReportToHtml(text: string): string {
  // Limpiar menciones a Gemini o modelos
  let formatted = text.replace(/Gemini/gi, 'AquaSaaS IA').replace(/Google/gi, 'AquaSaaS');

  // Convertir MarkDown a HTML simple
  
  // Títulos (###)
  formatted = formatted.replace(/^### (.*$)/gim, '<h3 style="color:#0d6efd; font-size:18px; margin-top:20px; border-bottom:1px solid #dee2e6; padding-bottom:5px;">$1</h3>');
  // Títulos (##)
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 style="color:#0d6efd; font-size:22px; margin-top:25px; border-bottom:2px solid #0d6efd; padding-bottom:8px;">$1</h2>');
  // Títulos (#)
  formatted = formatted.replace(/^# (.*$)/gim, '<h1 style="color:#0d6efd; font-size:26px; margin-top:30px; text-align:center;">$1</h1>');

  // Negritas
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1e293b;">$1</strong>');
  
  // Listas
  formatted = formatted.replace(/^\* (.*$)/gim, '<li style="margin-bottom:8px;">$1</li>');
  formatted = formatted.replace(/^- (.*$)/gim, '<li style="margin-bottom:8px;">$1</li>');
  
  // Agrupar <li> en <ul>
  formatted = formatted.replace(/(<li.*?>.*?<\/li>)+/g, '<ul style="padding-left:20px;">$0</ul>');

  // Saltos de línea
  formatted = formatted.replace(/\n/g, '<br>');

  // Envolver en un contenedor
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
      ${formatted}
    </div>
  `;
}
