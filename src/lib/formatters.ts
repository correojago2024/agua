/**
 * utilidades de formateo para el proyecto aGuaSaaS
 */

/**
 * Formatea un número al estilo: 1.234,56 (puntos para miles, coma para decimales)
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formatea un número entero al estilo: 1.234
 */
export function formatInteger(value: number | string | null | undefined): string {
  return formatNumber(value, 0);
}

/**
 * Formatea una fecha a: dd/mm/aaaa
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formatea una fecha y hora a: dd/mm/aaaa hh:mm AM/PM
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // el reloj de 12 horas tiene 12 en vez de 0
  const hoursStr = String(hours).padStart(2, '0');

  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
}
