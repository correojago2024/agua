
/**
 * ARCHIVO: src/lib/server/ai.ts
 * DESCRIPCIÓN: Servicio para interactuar con Gemini AI para el análisis de agua.
 */

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY;

// Lista de modelos verificados y posibles variaciones
const MODELOS_A_PROBAR = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-2.5-flash' // Mantenemos este por si es una versión especial del usuario
];

const API_VERSIONS = ['v1beta', 'v1'];

export async function generateWaterAnalysis(prompt: string, customApiKey?: string) {
  const apiKey = customApiKey || DEFAULT_API_KEY;
  
  if (!apiKey) {
    throw new Error('Configuración incompleta: No se encontró la variable GEMINI_API_KEY en el servidor ni una llave personalizada para este edificio.');
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  let diagnostico: any[] = [];
  let exito = false;
  let responseText = '';

  for (const modelo of MODELOS_A_PROBAR) {
    for (const version of API_VERSIONS) {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent?key=${apiKey}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        const status = response.status;

        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text.length > 5) {
            console.log(`[AI] ✅ ÉXITO: ${modelo} (${version})`);
            diagnostico.push({ modelo, version, status: 'OK', message: 'Funcionando' });
            return text; // Retorna inmediatamente el primero que funcione
          }
        } else {
          const errorMsg = data?.error?.message || 'Sin mensaje';
          diagnostico.push({ modelo, version, status, message: errorMsg });
          console.warn(`[AI] Fallo ${modelo} (${version}): ${status} - ${errorMsg}`);
        }
      } catch (error: any) {
        diagnostico.push({ modelo, version, status: 'Error', message: error.message });
      }
    }
  }

  // Si llegamos aquí es que nada funcionó
  const errorDetalle = diagnostico.map(d => `${d.modelo}(${d.status})`).join(', ');
  throw new Error(`Diagnóstico de Fallo: ${errorDetalle}. Posiblemente la cuota de la API Key se agotó o el servidor de Google está restringiendo el acceso desde esta región.`);
}

/**
 * Función especial para el botón de TEST que devuelve el diagnóstico completo
 */
export async function testAiConnection(customApiKey?: string) {
  const apiKey = customApiKey || DEFAULT_API_KEY;
  const prompt = 'Responde OK';
  let diagnostico: any[] = [];

  for (const modelo of MODELOS_A_PROBAR) {
    // Para el test rápido probamos solo v1beta por defecto para ahorrar tiempo
    const version = 'v1beta';
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent?key=${apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const status = response.status;
      const data = await response.json();
      
      diagnostico.push({ 
        modelo, 
        status, 
        ok: response.ok,
        msg: response.ok ? 'Disponible' : (data?.error?.message?.substring(0, 50) || 'Error')
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
