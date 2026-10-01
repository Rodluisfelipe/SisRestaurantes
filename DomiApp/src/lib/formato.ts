/** Cómo se dicen las cosas en Colombia: pesos sin decimales, 12 horas. */

export function pesos(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}$${s}`;
}

export function km(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1) return `${Math.max(50, Math.round((n * 1000) / 50) * 50)} m`;
  return `${n.toFixed(1).replace('.', ',')} km`;
}

export function minutos(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const m = Math.max(1, Math.round(n));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function hora(fecha: string | number | Date | null | undefined): string {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const pm = h >= 12;
  h = h % 12 || 12;
  return `${h}:${m} ${pm ? 'p. m.' : 'a. m.'}`;
}

/** "hace 3 min", para lo que pasó hace poco. */
export function haceCuanto(fecha: string | number | Date | null | undefined, ahora = Date.now()): string {
  if (!fecha) return '';
  const s = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000));
  if (s < 45) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** "2026-09-29" → "lun 29" */
export function diaCorto(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(a, (m || 1) - 1, d || 1);
  return `${DIAS[f.getDay()]} ${d}`;
}

/** Solo el primer nombre, para no gritar el nombre completo de nadie. */
export function primerNombre(nombre: string | null | undefined): string {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}

/** Celular colombiano mientras se escribe: 300 123 4567 */
export function celularBonito(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/**
 * Los billetes con los que la gente suele pagar un valor, para calcular las
 * vueltas con un toque: $59.000 → exacto, $60.000 o $100.000.
 */
export function sugerirBilletes(total: number): number[] {
  const opciones = new Set<number>([total]);
  for (const b of [2000, 5000, 10000, 20000, 50000, 100000]) {
    const redondo = Math.ceil(total / b) * b;
    if (redondo > total) opciones.add(redondo);
  }
  return [...opciones].sort((a, b) => a - b).slice(0, 4);
}
