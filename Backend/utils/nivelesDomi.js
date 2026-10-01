/**
 * Niveles de los domiciliarios: Go → Go+ → Pro → Élite → MenuBy Black.
 *
 * Reglas justas (lo contrario de los castigos ciegos):
 *  - Se mide lo de los últimos 30 días y solo lo que es culpa del domi.
 *  - Subir es inmediato. Bajar solo se decide en la revisión mensual, nunca
 *    más de un nivel a la vez, y nunca durante el escudo (30 días después de
 *    subir o de bajar).
 *  - Antes de bajar se le avisa ("en riesgo") con lo que le falta.
 *
 * Todo aquí es puro (sin base de datos) para poder probarlo.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
const ESCUDO_DIAS = 30;
const REVISION_DIAS = 30;

const NIVELES = [
  { id: 0, nombre: 'Go', beneficio: 'Recibes ofertas de pedidos' },
  { id: 1, nombre: 'Go+', entregas: 10, cumplimiento: 0.9, beneficio: 'Puedes activar la aceptación automática' },
  { id: 2, nombre: 'Pro', entregas: 40, cumplimiento: 0.93, puntualidad: 0.85, calificacion: 4.5, beneficio: 'Si hay otro domi igual de cerca, la oferta te llega a ti primero' },
  { id: 3, nombre: 'Élite', entregas: 100, cumplimiento: 0.95, puntualidad: 0.9, calificacion: 4.7, beneficio: 'Más prioridad en las ofertas' },
  { id: 4, nombre: 'MenuBy Black', entregas: 200, cumplimiento: 0.97, puntualidad: 0.93, calificacion: 4.8, beneficio: 'La máxima prioridad y tu insignia la ve el negocio' },
];

/** Desempate al elegir domi: km que se le "descuentan" por nivel. Solo pesa entre domis a distancia parecida. */
const BONO_KM = [0, 0, 0.3, 0.6, 1];
/** La aceptación automática también da un pequeño desempate */
const BONO_AUTO_KM = 0.2;
/** Desde qué nivel se puede activar la aceptación automática */
const NIVEL_AUTO_ACEPTA = 1;

const nivelPorId = (id) => NIVELES[Math.max(0, Math.min(NIVELES.length - 1, Number(id) || 0))];

function cumple(m, n) {
  if (!n.entregas) return true;
  return m.entregas >= n.entregas
    && m.cumplimiento >= n.cumplimiento
    && (n.puntualidad == null || m.puntualidad >= n.puntualidad)
    && (n.calificacion == null || m.calificacion >= n.calificacion);
}

/** El nivel que le corresponde por sus números de hoy. */
function nivelCalculado(m) {
  let nivel = 0;
  for (const n of NIVELES) if (cumple(m, n)) nivel = n.id;
  return nivel;
}

const pct = (x) => `${Math.round(x * 100)} %`;

/** Lo que le falta para llegar (o mantenerse) en un nivel, en palabras. */
function faltante(m, id) {
  const n = nivelPorId(id);
  const f = [];
  if (!n.entregas) return f;
  if (m.entregas < n.entregas) f.push(`${n.entregas - m.entregas} ${n.entregas - m.entregas === 1 ? 'entrega más' : 'entregas más'} en los últimos 30 días`);
  if (m.cumplimiento < n.cumplimiento) f.push(`Cumplimiento de ${pct(n.cumplimiento)} (vas en ${pct(m.cumplimiento)})`);
  if (n.puntualidad != null && m.puntualidad < n.puntualidad) f.push(`Puntualidad de ${pct(n.puntualidad)} (vas en ${pct(m.puntualidad)})`);
  if (n.calificacion != null && m.calificacion < n.calificacion) f.push(`Calificación de ${n.calificacion.toFixed(1)} (vas en ${m.calificacion.toFixed(1)})`);
  return f;
}

/**
 * Decide el nivel guardado a partir del calculado.
 * @param {{actual?:number, protegidoHasta?:Date|null, revisadoAt?:Date|null}} guardado
 * @returns {{ actual:number, desde?:Date, protegidoHasta?:Date|null, revisadoAt?:Date|null, cambio:'sube'|'baja'|null, enRiesgo:boolean }}
 */
function revisar(guardado = {}, calculado, ahora = new Date()) {
  const actual = Number(guardado.actual) || 0;
  const protegidoHasta = guardado.protegidoHasta ? new Date(guardado.protegidoHasta) : null;
  const revisadoAt = guardado.revisadoAt ? new Date(guardado.revisadoAt) : null;
  const escudo = (fecha) => new Date(fecha.getTime() + ESCUDO_DIAS * DIA_MS);

  if (calculado > actual) {
    return { actual: calculado, desde: ahora, protegidoHasta: escudo(ahora), revisadoAt: ahora, cambio: 'sube', enRiesgo: false };
  }
  const tocaRevision = !revisadoAt || ahora - revisadoAt >= REVISION_DIAS * DIA_MS;
  if (calculado < actual) {
    const protegido = protegidoHasta && ahora < protegidoHasta;
    if (protegido || !tocaRevision) {
      return { actual, protegidoHasta, revisadoAt, cambio: null, enRiesgo: true };
    }
    const baja = actual - 1;
    return { actual: baja, desde: ahora, protegidoHasta: escudo(ahora), revisadoAt: ahora, cambio: 'baja', enRiesgo: calculado < baja };
  }
  return { actual, protegidoHasta, revisadoAt: tocaRevision ? ahora : revisadoAt, cambio: null, enRiesgo: false };
}

/** ¿Llegó a tiempo? Lo que tarda del local al cliente contra lo esperado en moto (con margen). */
function minutosEsperados(km) {
  const k = Number(km);
  if (!Number.isFinite(k) || k <= 0) return null;
  return (k * 60) / 22 + 6;
}

function fuePuntual(minutosReales, km) {
  const esperado = minutosEsperados(km);
  if (esperado == null || !Number.isFinite(minutosReales)) return null;
  return minutosReales <= esperado * 1.5 + 5;
}

module.exports = {
  NIVELES,
  BONO_KM,
  BONO_AUTO_KM,
  NIVEL_AUTO_ACEPTA,
  nivelPorId,
  nivelCalculado,
  faltante,
  revisar,
  minutosEsperados,
  fuePuntual,
};
