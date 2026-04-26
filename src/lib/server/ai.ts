
/**
 * ARCHIVO: src/lib/server/ai.ts
 * DESCRIPCIÓN: Servicio para interactuar con Gemini AI para el análisis de agua.
 */

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY;

// Lista de modelos. Prioridad absoluta al modelo 3 preview que el usuario confirmó.
const MODELOS_A_PROBAR = [
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest'
];

const API_VERSIONS = ['v1beta', 'v1'];

export async function generateWaterAnalysis(prompt: string, customApiKey?: string) {
  const apiKey = customApiKey || DEFAULT_API_KEY;
  
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY');
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
  };

  let ultimoStatus = 0;
  let ultimoError = '';

  for (const modelo of MODELOS_A_PROBAR) {
    for (const version of API_VERSIONS) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (response.ok) {
          return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
        
        ultimoStatus = response.status;
        ultimoError = data?.error?.message || 'Error';
        if (ultimoStatus === 429) continue; // Si es cuota, probamos otro modelo
      } catch (e: any) {
        ultimoError = e.message;
      }
    }
  }

  throw new Error(`Agotados todos los intentos. Último fallo: ${ultimoStatus} - ${ultimoError}`);
}

export async function testAiConnection(customApiKey?: string) {
  const apiKey = customApiKey || DEFAULT_API_KEY;
  let diagnostico: any[] = [];

  for (const modelo of MODELOS_A_PROBAR) {
    // Probamos v1beta que es la más común para flash
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
      });
      const data = await response.json();
      diagnostico.push({ 
        modelo, 
        status: response.status, 
        ok: response.ok,
        msg: response.ok ? 'Disponible' : (data?.error?.message?.substring(0, 40) || 'Error')
      });
    } catch (e: any) {
      diagnostico.push({ modelo, status: 'Error', ok: false, msg: e.message });
    }
  }
  return diagnostico;
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
