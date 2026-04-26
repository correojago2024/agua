
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
 * Convierte markdown simple, tablas y saltos de línea en estructura HTML bonita.
 */
export function formatAiReportToHtml(text: string): string {
  // Limpiar menciones a Gemini o modelos
  let formatted = text.replace(/Gemini/gi, 'AquaSaaS IA').replace(/Google/gi, 'AquaSaaS');

  // --- PROCESAMIENTO DE TABLAS MARKDOWN ---
  // Detecta bloques de tablas | header | header | y los convierte a <table>
  const tableRegex = /((?:\|.*\|(?:\n|\r))+)/g;
  formatted = formatted.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    if (rows.length < 2) return match;

    let htmlTable = '<div style="overflow-x:auto; margin: 20px 0;"><table style="width:100%; border-collapse:collapse; font-size:13px; font-family:Arial,sans-serif; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">';
    
    rows.forEach((row, index) => {
      // Saltar filas de separación tipo |---|---|
      if (row.includes('---')) return;

      const cells = row.split('|').filter(cell => cell.trim() !== '');
      const tag = (index === 0) ? 'th' : 'td';
      const bgColor = (index === 0) ? '#0d6efd' : (index % 2 === 0 ? '#f8fafc' : '#ffffff');
      const textColor = (index === 0) ? '#ffffff' : '#334155';
      const fontWeight = (index === 0) ? 'bold' : 'normal';

      htmlTable += `<tr style="background-color: ${bgColor};">`;
      cells.forEach(cell => {
        htmlTable += `<${tag} style="padding:12px 15px; border:1px solid #e2e8f0; color: ${textColor}; font-weight: ${fontWeight}; text-align:left;">${cell.trim()}</${tag}>`;
      });
      htmlTable += '</tr>';
    });

    htmlTable += '</table></div>';
    return htmlTable;
  });

  // Títulos (###)
  formatted = formatted.replace(/^### (.*$)/gim, '<h3 style="color:#1e40af; font-size:18px; margin-top:30px; margin-bottom:15px; font-weight:800; border-left:4px solid #0d6efd; padding-left:10px;">$1</h3>');
  // Títulos (##)
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 style="color:#0d6efd; font-size:22px; margin-top:35px; margin-bottom:20px; border-bottom:2px solid #0d6efd; padding-bottom:8px; font-weight:800;">$1</h2>');
  // Títulos (#)
  formatted = formatted.replace(/^# (.*$)/gim, '<h1 style="color:#0d6efd; font-size:26px; margin-top:40px; text-align:center; font-weight:900;">$1</h1>');

  // Negritas
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1e293b; font-weight:700;">$1</strong>');
  
  // Listas
  formatted = formatted.replace(/^\* (.*$)/gim, '<li style="margin-bottom:8px; color:#475569;">$1</li>');
  formatted = formatted.replace(/^- (.*$)/gim, '<li style="margin-bottom:8px; color:#475569;">$1</li>');
  
  // Agrupar <li> en <ul>
  formatted = formatted.replace(/(<li.*?>.*?<\/li>)+/g, '<ul style="padding-left:25px; margin-bottom:20px;">$0</ul>');

  // Saltos de línea (evitar dobles saltos en tablas ya procesadas)
  formatted = formatted.replace(/\n/g, '<br>');

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.7; color: #334155; background: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #e2e8f0; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
      ${formatted}
    </div>
  `;
}
