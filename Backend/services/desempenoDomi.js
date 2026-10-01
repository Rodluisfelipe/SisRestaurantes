/**
 * Desempeño del domiciliario: métricas justas, faltas con reclamo y nivel.
 *
 * Lo que cuenta en su contra son solo las FALTAS (Models/DomiFalta), y solo se
 * registran cosas que son culpa suya:
 *  - oferta_vencida: dejó vencer una oferta que su app SÍ recibió y le mostró
 *    (si no le llegó por señal o por falla nuestra, no cuenta);
 *  - no_arranco: la aceptó sola (aceptación automática) y no salió hacia el local;
 *  - no_entregado: marcó "no entregado" sin haber llegado donde el cliente;
 *  - gps_falso: se le pilló GPS simulado (una vez por día como mucho).
 * Rechazar una oferta NO es falta. La demora del local tampoco: la
 * puntualidad se mide desde que recoge.
 *
 * El nivel sale de utils/nivelesDomi.js (subir inmediato; bajar solo en la
 * revisión mensual, de a uno y con escudo).
 */
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');
const niveles = require('../utils/nivelesDomi');

const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_DIAS = 30;
const RECALCULO_MS = 60 * 60 * 1000;

const MOTIVOS = {
  oferta_vencida: 'Dejaste vencer una oferta que te llegó',
  no_arranco: 'Aceptaste solo un pedido y no saliste hacia el local',
  no_entregado: 'Marcaste "no entregado" sin haber llegado donde el cliente',
  gps_falso: 'Se detectó GPS falso en tu celular',
};

class ErrorDesempeno extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const tel10 = (t) => reglas.variantesTelefono(t).find((x) => x.length === 10) || reglas.variantesTelefono(t)[0] || '';

/** Anota una falta. Si ya estaba (mismo pedido u oferta), no la repite. */
async function registrarFalta({ telefono, driverId, tipo, refId = null, pedidoNumero = null, negocio = null, at = new Date() }) {
  const DomiFalta = require('../Models/DomiFalta');
  const tel = tel10(telefono);
  if (!tel || !MOTIVOS[tipo]) return null;
  try {
    return await DomiFalta.create({
      telefono: tel, driverId, tipo, at,
      refId: refId != null ? String(refId) : null,
      pedidoNumero: pedidoNumero != null ? String(pedidoNumero) : null,
      negocio,
    });
  } catch (e) {
    if (e.code === 11000) return null; // ya estaba
    logger.warn('No se pudo anotar la falta del domi', { telefono: tel, tipo, error: e.message });
    return null;
  }
}

/** Falta por el teléfono de un perfil (cuando solo se tiene el DeliveryPerson). */
async function registrarFaltaDe(driverId, datos) {
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const d = await DeliveryPerson.findById(driverId).select('phone').lean();
  if (!d?.phone) return null;
  return registrarFalta({ ...datos, telefono: d.phone, driverId });
}

/* ═══════════════════════ Métricas ═══════════════════════ */

async function entregasDeLaVentana(ids, desde) {
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const Envio = require('../Models/Envio');
  const filtro = { deliveryPersonId: { $in: ids }, deliveredAt: { $gte: desde } };
  const campos = 'deliveredAt deliveryPickedAt deliveryZoneInfo';
  const [a, b, envios] = await Promise.all([
    Order.find({ ...filtro, status: 'delivered' }).select(campos).lean(),
    CompletedOrder.find(filtro).select(campos).lean(),
    Envio.countDocuments(filtro),
  ]);
  const vistos = new Set();
  const pedidos = [...a, ...b].filter((o) => {
    const k = String(o._id);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return { pedidos, envios };
}

/**
 * Los números de los últimos 30 días.
 * @returns {{entregas:number, faltas:number, cumplimiento:number, puntualidad:number, calificacion:number, medidas:number}}
 */
async function metricas(telefono, docs) {
  const DomiFalta = require('../Models/DomiFalta');
  const desde = new Date(Date.now() - VENTANA_DIAS * DIA_MS);
  const ids = docs.map((d) => d._id);
  const [{ pedidos, envios }, faltas] = await Promise.all([
    entregasDeLaVentana(ids, desde),
    DomiFalta.countDocuments({ telefono: tel10(telefono), at: { $gte: desde }, estado: { $ne: 'anulada' } }),
  ]);
  let medidas = 0;
  let puntuales = 0;
  for (const o of pedidos) {
    if (!o.deliveryPickedAt || !o.deliveredAt) continue;
    const min = (new Date(o.deliveredAt) - new Date(o.deliveryPickedAt)) / 60000;
    const p = niveles.fuePuntual(min, o.deliveryZoneInfo?.distance);
    if (p == null) continue;
    medidas += 1;
    if (p) puntuales += 1;
  }
  const entregas = pedidos.length + envios;
  const total = entregas + faltas;
  const calificaciones = docs.map((d) => d.rating).filter((r) => Number.isFinite(r));
  return {
    entregas,
    faltas,
    cumplimiento: total ? entregas / total : 1,
    puntualidad: medidas ? puntuales / medidas : 1,
    calificacion: calificaciones.length ? Math.min(...calificaciones) : 5,
    medidas,
  };
}

/* ═══════════════════════ Nivel ═══════════════════════ */

/** Copia el nivel y la aceptación automática a los perfiles (los lee el que elige domi). */
async function sincronizarPrioridad(cuenta, docs) {
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const a = cuenta.autoAcepta || {};
  await DeliveryPerson.updateMany({ _id: { $in: docs.map((d) => d._id) } }, {
    $set: {
      'prioridad.nivel': cuenta.nivel?.actual || 0,
      'prioridad.autoAcepta': {
        activo: !!a.activo, kmMax: a.kmMax ?? 3, gananciaMin: a.gananciaMin ?? 0, maxPedidos: a.maxPedidos ?? 1,
      },
    },
  });
}

/**
 * Recalcula métricas y nivel de la persona y guarda el resultado.
 * @returns {{ metricas, revision }}
 */
async function recalcular(cuenta, docs, ahora = new Date()) {
  const m = await metricas(cuenta.telefono, docs);
  const calculado = niveles.nivelCalculado(m);
  const r = niveles.revisar(cuenta.nivel || {}, calculado, ahora);
  cuenta.set('nivel.actual', r.actual);
  if (r.desde) cuenta.set('nivel.desde', r.desde);
  cuenta.set('nivel.protegidoHasta', r.protegidoHasta || null);
  cuenta.set('nivel.revisadoAt', r.revisadoAt || null);
  cuenta.set('nivel.calculadoAt', ahora);
  if (!cuenta.nivel?.desde) cuenta.set('nivel.desde', ahora);
  // La aceptación automática es beneficio de Go+ en adelante
  if (r.actual < niveles.NIVEL_AUTO_ACEPTA && cuenta.autoAcepta?.activo) {
    cuenta.set('autoAcepta.activo', false);
    cuenta.set('autoAcepta.apagadaPor', 'nivel');
    cuenta.set('autoAcepta.apagadaAt', ahora);
  }
  await cuenta.save();
  await sincronizarPrioridad(cuenta, docs);
  if (r.cambio) logger.info('Nivel del domi', { telefono: cuenta.telefono, nivel: r.actual, cambio: r.cambio });
  return { metricas: m, revision: r, calculado };
}

/** Recalcula si hace rato no se hace (lo llama el estado de la app). No frena nada. */
function recalcularSiToca(cuenta, docs) {
  if (!cuenta) return;
  const at = cuenta.nivel?.calculadoAt;
  if (at && Date.now() - new Date(at) < RECALCULO_MS) return;
  recalcular(cuenta, docs).catch((e) => logger.warn('No se pudo recalcular el nivel', { error: e.message }));
}

/** Después de una entrega: subir es inmediato. */
async function recalcularPorTelefono(telefono) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const tel = tel10(telefono);
  const [cuenta, docs] = await Promise.all([
    DomiCuenta.findOne({ telefono: tel }),
    DeliveryPerson.find({ phone: { $in: reglas.variantesTelefono(tel) }, active: true }),
  ]);
  if (!cuenta || !docs.length) return null;
  return recalcular(cuenta, docs);
}

const resumenNivel = (id) => {
  const n = niveles.nivelPorId(id);
  return { id: n.id, nombre: n.nombre, beneficio: n.beneficio };
};

/** Lo que muestra "Mi desempeño" en la app. */
async function desempeno(domi) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const DomiFalta = require('../Models/DomiFalta');
  const cuenta = await DomiCuenta.findOne({ telefono: domi.telefono });
  if (!cuenta) throw new ErrorDesempeno(404, 'No encontramos tu cuenta.');
  const { metricas: m, revision: r, calculado } = await recalcular(cuenta, domi.docs);
  const actual = r.actual;
  const siguiente = actual < niveles.NIVELES.length - 1 ? actual + 1 : null;
  const faltas = await DomiFalta.find({ telefono: domi.telefono, at: { $gte: new Date(Date.now() - VENTANA_DIAS * DIA_MS) } })
    .sort({ at: -1 }).limit(50).lean();
  return {
    nivel: {
      ...resumenNivel(actual),
      desde: cuenta.nivel?.desde || null,
      protegidoHasta: cuenta.nivel?.protegidoHasta || null,
      enRiesgo: r.enRiesgo,
      // Lo que le falta para no bajar en la próxima revisión
      paraMantener: r.enRiesgo ? niveles.faltante(m, actual) : [],
      // La próxima vez que se puede bajar: la revisión mensual, y nunca antes de que acabe el escudo
      revisionAt: (() => {
        const mensual = cuenta.nivel?.revisadoAt ? new Date(cuenta.nivel.revisadoAt).getTime() + 30 * DIA_MS : 0;
        const escudo = cuenta.nivel?.protegidoHasta ? new Date(cuenta.nivel.protegidoHasta).getTime() : 0;
        const t = Math.max(mensual, escudo);
        return t ? new Date(t) : null;
      })(),
    },
    siguiente: siguiente != null ? { ...resumenNivel(siguiente), faltante: niveles.faltante(m, siguiente) } : null,
    niveles: niveles.NIVELES.map((n) => ({
      id: n.id, nombre: n.nombre, beneficio: n.beneficio, logrado: n.id <= actual,
      // Lo que pide cada nivel (en la misma escala que `metricas`), para mostrar "vas en X de Y"
      requisitos: n.entregas ? {
        entregas: n.entregas,
        cumplimiento: Math.round(n.cumplimiento * 100),
        puntualidad: n.puntualidad != null ? Math.round(n.puntualidad * 100) : null,
        calificacion: n.calificacion ?? null,
      } : null,
    })),
    calculado,
    metricas: {
      entregas: m.entregas,
      faltas: m.faltas,
      cumplimiento: Math.round(m.cumplimiento * 100),
      puntualidad: Math.round(m.puntualidad * 100),
      calificacion: Math.round(m.calificacion * 10) / 10,
    },
    faltas: faltas.map((f) => ({
      id: String(f._id),
      tipo: f.tipo,
      motivo: MOTIVOS[f.tipo],
      at: f.at,
      pedido: f.pedidoNumero,
      negocio: f.negocio,
      estado: f.estado,
      reclamo: f.reclamo?.at ? { nota: f.reclamo.nota, respuesta: f.reclamo.respuesta || null } : null,
    })),
  };
}

/* ═══════════════════════ Reclamos ═══════════════════════ */

async function reclamar(domi, faltaId, nota) {
  const mongoose = require('mongoose');
  const DomiFalta = require('../Models/DomiFalta');
  if (!mongoose.isValidObjectId(faltaId)) throw new ErrorDesempeno(404, 'Esa falta ya no está.');
  const texto = String(nota || '').trim();
  if (texto.length < 5) throw new ErrorDesempeno(400, 'Cuéntanos qué pasó (al menos unas palabras).');
  const f = await DomiFalta.findOne({ _id: faltaId, telefono: domi.telefono });
  if (!f) throw new ErrorDesempeno(404, 'Esa falta ya no está.');
  if (f.estado === 'anulada') throw new ErrorDesempeno(409, 'Esa falta ya fue anulada.');
  if (f.reclamo?.at) throw new ErrorDesempeno(409, 'Ya reclamaste esta falta. Te avisamos cuando la revisemos.');
  f.estado = 'en_revision';
  f.reclamo = { nota: texto.slice(0, 500), at: new Date() };
  await f.save();
  return { ok: true };
}

async function listarFaltas({ estado = 'en_revision', q = '', pagina = 1 } = {}) {
  const DomiFalta = require('../Models/DomiFalta');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const filtro = {};
  if (['vigente', 'en_revision', 'anulada'].includes(estado)) filtro.estado = estado;
  const digitos = String(q || '').replace(/\D/g, '');
  if (digitos.length >= 3) filtro.telefono = { $regex: digitos };
  const POR_PAGINA = 30;
  const [lista, total, conteos] = await Promise.all([
    DomiFalta.find(filtro).sort({ at: -1 }).skip((pagina - 1) * POR_PAGINA).limit(POR_PAGINA).lean(),
    DomiFalta.countDocuments(filtro),
    DomiFalta.aggregate([{ $group: { _id: '$estado', n: { $sum: 1 } } }]),
  ]);
  const tels = [...new Set(lista.map((f) => f.telefono))];
  const perfiles = await DeliveryPerson.find({ phone: { $in: tels.flatMap((t) => reglas.variantesTelefono(t)) } }).select('name phone photo').lean();
  const persona = (t) => perfiles.find((p) => reglas.variantesTelefono(t).includes(p.phone));
  return {
    total,
    conteos: Object.fromEntries(conteos.map((c) => [c._id, c.n])),
    faltas: lista.map((f) => ({
      id: String(f._id),
      telefono: f.telefono,
      nombre: persona(f.telefono)?.name || 'Domiciliario',
      foto: persona(f.telefono)?.photo || null,
      tipo: f.tipo,
      motivo: MOTIVOS[f.tipo],
      at: f.at,
      pedido: f.pedidoNumero,
      negocio: f.negocio,
      estado: f.estado,
      reclamo: f.reclamo || null,
    })),
  };
}

/** El superadmin decide un reclamo: anular (le da la razón) o dejarla en firme. */
async function resolverFalta(id, { anular, respuesta }, quien) {
  const mongoose = require('mongoose');
  const DomiFalta = require('../Models/DomiFalta');
  if (!mongoose.isValidObjectId(id)) throw new ErrorDesempeno(404, 'Falta no encontrada.');
  const f = await DomiFalta.findById(id);
  if (!f) throw new ErrorDesempeno(404, 'Falta no encontrada.');
  f.estado = anular ? 'anulada' : 'vigente';
  f.set('reclamo.respuesta', String(respuesta || (anular ? 'Tenías razón: la falta se anuló.' : 'Revisamos y la falta se mantiene.')).slice(0, 300));
  f.set('reclamo.resueltoAt', new Date());
  f.set('reclamo.resueltoPor', quien);
  await f.save();
  recalcularPorTelefono(f.telefono).catch(() => {});
  return { ok: true, estado: f.estado };
}

/** Día difícil (lluvia, paro, caída del sistema): se anulan todas las faltas de ese día. */
async function perdonarDia(fecha, quien) {
  const DomiFalta = require('../Models/DomiFalta');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) throw new ErrorDesempeno(400, 'Elige el día.');
  const inicio = new Date(`${fecha}T00:00:00-05:00`);
  const fin = new Date(inicio.getTime() + DIA_MS);
  const filtro = { at: { $gte: inicio, $lt: fin }, estado: { $ne: 'anulada' } };
  const tels = await DomiFalta.distinct('telefono', filtro);
  const r = await DomiFalta.updateMany(filtro, {
    $set: { estado: 'anulada', 'reclamo.respuesta': 'Día difícil: no cuenta.', 'reclamo.resueltoAt': new Date(), 'reclamo.resueltoPor': quien },
  });
  tels.forEach((t) => recalcularPorTelefono(t).catch(() => {}));
  return { anuladas: r.modifiedCount || 0 };
}

module.exports = {
  MOTIVOS,
  ErrorDesempeno,
  registrarFalta,
  registrarFaltaDe,
  metricas,
  recalcular,
  recalcularSiToca,
  recalcularPorTelefono,
  sincronizarPrioridad,
  desempeno,
  reclamar,
  listarFaltas,
  resolverFalta,
  perdonarDia,
};
