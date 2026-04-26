
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
 * Convierte markdown simple, tablas y saltos de línea en estructura HTML de alta calidad.
 */
export function formatAiReportToHtml(text: string): string {
  // Limpiar menciones a Gemini o modelos y placeholders de error
  let formatted = text
    .replace(/Gemini/gi, 'aGuaSaaS IA')
    .replace(/Google/gi, 'aGuaSaaS')
    .replace(/\$0/g, '') // Eliminar cualquier placeholder de cero que la IA intente poner
    .replace(/\[Tu Nombre\/Firma\]/g, 'Departamento Técnico aGuaSaaS');

  // --- PROCESAMIENTO DE TABLAS MARKDOWN PROFESIONAL ---
  const tableRegex = /((?:\|.*\|(?:\n|\r))+)/g;
  formatted = formatted.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    if (rows.length < 2) return match;

    let htmlTable = '<div style="margin: 25px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">' +
                    '<table style="width:100%; border-collapse: separate; border-spacing: 0; font-size: 13px; font-family: \'Segoe UI\', Roboto, Arial, sans-serif; background: white;">';
    
    let realRowIndex = 0;
    rows.forEach((row) => {
      if (row.includes('---')) return;

      const cells = row.split('|').filter(cell => cell.trim() !== '');
      if (cells.length === 0) return;

      const isHeader = realRowIndex === 0;
      const tag = isHeader ? 'th' : 'td';
      
      // Estilos dinámicos
      const bgColor = isHeader ? '#1e40af' : (realRowIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
      const textColor = isHeader ? '#ffffff' : '#334155';
      const borderBottom = '1px solid #e2e8f0';
      const padding = '14px 18px';

      htmlTable += `<tr style="background-color: ${bgColor}; transition: background 0.2s;">`;
      cells.forEach((cell, cellIndex) => {
        const textAlign = (cellIndex === 0) ? 'left' : 'center';
        const borderRight = (cellIndex < cells.length - 1) ? '1px solid rgba(226, 232, 240, 0.5)' : 'none';
        
        htmlTable += `<${tag} style="padding: ${padding}; border-bottom: ${borderBottom}; border-right: ${borderRight}; color: ${textColor}; font-weight: ${isHeader ? '700' : '500'}; text-align: ${textAlign};">
                        ${cell.trim()}
                      </${tag}>`;
      });
      htmlTable += '</tr>';
      realRowIndex++;
    });

    htmlTable += '</table></div>';
    return htmlTable;
  });

  // Títulos con mejor jerarquía
  formatted = formatted.replace(/^### (.*$)/gim, '<h3 style="color:#1e3a8a; font-size:17px; margin-top:35px; margin-bottom:12px; font-weight:700; display:flex; align-items:center; gap:8px;">● $1</h3>');
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 style="color:#2563eb; font-size:20px; margin-top:45px; margin-bottom:15px; border-bottom:2px solid #eff6ff; padding-bottom:10px; font-weight:800; text-transform: uppercase; letter-spacing: 0.5px;">$1</h2>');
  formatted = formatted.replace(/^# (.*$)/gim, '<h1 style="color:#1e40af; font-size:24px; margin-top:20px; margin-bottom:30px; text-align:center; font-weight:900; background:#f0f7ff; padding:20px; border-radius:12px;">$1</h1>');

  // Separadores
  formatted = formatted.replace(/^---$/gm, '<hr style="border:0; border-top:1px solid #e2e8f0; margin:40px 0;">');

  // Negritas y resaltados
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111827; font-weight:700; background:#fff7ed; padding:0 2px;">$1</strong>');
  
  // Listas con bullets personalizados
  formatted = formatted.replace(/^\* (.*$)/gim, '<li style="margin-bottom:10px; color:#475569; list-style-type: none; position: relative; padding-left: 20px;"><span style="position:absolute; left:0; color:#3b82f6;">◆</span> $1</li>');
  formatted = formatted.replace(/^- (.*$)/gim, '<li style="margin-bottom:10px; color:#475569; list-style-type: none; position: relative; padding-left: 20px;"><span style="position:absolute; left:0; color:#3b82f6;">◆</span> $1</li>');
  
  formatted = formatted.replace(/(<li.*?>.*?<\/li>)+/g, '<ul style="padding:0; margin: 20px 0;">$0</ul>');

  // Saltos de línea
  formatted = formatted.replace(/\n/g, '<br>');

  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #334155; background: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #e2e8f0; max-width: 900px; margin: auto;">
      ${formatted}
    </div>
  `;
}
