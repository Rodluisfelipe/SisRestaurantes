/**
 * Aceptación automática: el domi la activa y las ofertas que cumplen sus
 * condiciones quedan suyas al instante, sin tocar el celular (va en la moto).
 *
 * Lo decide el SERVIDOR al ofrecer (no depende de que la app esté despierta).
 * Solo si el domi está de verdad activo: conectado, con GPS fresco y sin
 * trampas recientes. Si acepta solo y no arranca hacia el local:
 *   - a los 3 min se le avisa;
 *   - a los 5 min el pedido se libera, se ofrece al siguiente y le queda una falta;
 *   - con 2 de esas, la aceptación automática se apaga sola.
 */
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');
const niveles = require('../utils/nivelesDomi');

const AVISO_MIN = 3;
const LIBERAR_MIN = 5;
const MAX_FALLOS = 2;
const GPS_FRESCO_MS = 2 * 60 * 1000;
const TRAMPA_RECIENTE_MS = 30 * 60 * 1000;
// Avanzó hacia el local si se acercó esto, o si ya está así de cerca
const AVANCE_KM = 0.15;
const YA_CERCA_KM = 0.25;

class ErrorAuto extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

function km(a, b) {
  if (!a || !b) return null;
  return reglas.distanciaKm(a, b);
}

const puntoDe = (driver) => {
  const c = driver?.lastLocation?.coordinates;
  return Array.isArray(c) && c.length === 2 ? { lat: c[1], lng: c[0] } : null;
};

/**
 * ¿Esta oferta se acepta sola? Puro, para poder probarlo.
 * @returns {{ ok: boolean, motivo?: string }}
 */
function cumple({ config, kmAlLocal, ganancia, carga, lastSeenAt, ahora = Date.now() }) {
  if (!config?.activo) return { ok: false, motivo: 'apagada' };
  if (!lastSeenAt || ahora - new Date(lastSeenAt).getTime() > GPS_FRESCO_MS) return { ok: false, motivo: 'sin_gps_fresco' };
  if (kmAlLocal == null || kmAlLocal > (config.kmMax ?? 3)) return { ok: false, motivo: 'lejos' };
  if (ganancia != null && (config.gananciaMin || 0) > 0 && ganancia < config.gananciaMin) return { ok: false, motivo: 'paga_poco' };
  if ((carga || 0) >= (config.maxPedidos || 1)) return { ok: false, motivo: 'lleva_pedidos' };
  return { ok: true };
}

/** ¿Arrancó hacia el local? */
function avanzo(kmInicial, kmAhora) {
  if (kmAhora == null) return false;
  if (kmAhora <= YA_CERCA_KM) return true;
  return kmInicial != null && kmInicial - kmAhora >= AVANCE_KM;
}

/* ═══════════════════════ Configuración (app) ═══════════════════════ */

function vista(cuenta, maxActivos) {
  const a = cuenta?.autoAcepta || {};
  const nivel = cuenta?.nivel?.actual || 0;
  return {
    disponible: nivel >= niveles.NIVEL_AUTO_ACEPTA,
    nivelNecesario: niveles.nivelPorId(niveles.NIVEL_AUTO_ACEPTA).nombre,
    activo: !!a.activo,
    kmMax: a.kmMax ?? 3,
    gananciaMin: a.gananciaMin ?? 0,
    maxPedidos: Math.min(a.maxPedidos ?? 1, maxActivos),
    maxActivos,
    apagadaPor: a.activo ? null : a.apagadaPor || null,
  };
}

const maxActivosDe = (estadoAfiliaciones) => Math.max(1, ...estadoAfiliaciones.map((x) => x || 1));

async function maxActivos(domi) {
  const BusinessConfig = require('../Models/BusinessConfig');
  const DeliveryPartner = require('../Models/DeliveryPartner');
  const bizIds = domi.docs.filter((d) => d.businessId).map((d) => d.businessId);
  const empIds = domi.docs.filter((d) => d.partnerId).map((d) => d.partnerId);
  const [bs, es] = await Promise.all([
    BusinessConfig.find({ _id: { $in: bizIds } }).select('deliverySettings.maxActivePerDriver').lean(),
    DeliveryPartner.find({ _id: { $in: empIds } }).select('maxActivePerDriver').lean(),
  ]);
  return maxActivosDe([...bs.map((b) => b.deliverySettings?.maxActivePerDriver), ...es.map((e) => e.maxActivePerDriver || 2)]);
}

async function configuracion(domi) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const cuenta = await DomiCuenta.findOne({ telefono: domi.telefono }).lean();
  return vista(cuenta, await maxActivos(domi));
}

async function guardar(domi, cambios = {}) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const cuenta = await DomiCuenta.findOne({ telefono: domi.telefono });
  if (!cuenta) throw new ErrorAuto(404, 'No encontramos tu cuenta.');
  const tope = await maxActivos(domi);
  const nivel = cuenta.nivel?.actual || 0;
  if (cambios.activo === true && nivel < niveles.NIVEL_AUTO_ACEPTA) {
    throw new ErrorAuto(403, `La aceptación automática se activa desde el nivel ${niveles.nivelPorId(niveles.NIVEL_AUTO_ACEPTA).nombre}.`);
  }
  if (cambios.kmMax != null) {
    const k = Number(cambios.kmMax);
    if (!Number.isFinite(k) || k < 0.5 || k > 15) throw new ErrorAuto(400, 'La distancia al local debe estar entre 0,5 y 15 km.');
    cuenta.set('autoAcepta.kmMax', Math.round(k * 10) / 10);
  }
  if (cambios.gananciaMin != null) {
    const g = Number(cambios.gananciaMin);
    if (!Number.isFinite(g) || g < 0 || g > 100000) throw new ErrorAuto(400, 'La ganancia mínima no es válida.');
    cuenta.set('autoAcepta.gananciaMin', Math.round(g));
  }
  if (cambios.maxPedidos != null) {
    const m = Math.round(Number(cambios.maxPedidos));
    if (!Number.isFinite(m) || m < 1 || m > tope) throw new ErrorAuto(400, `Puedes llevar hasta ${tope} ${tope === 1 ? 'pedido' : 'pedidos'} a la vez.`);
    cuenta.set('autoAcepta.maxPedidos', m);
  }
  if (typeof cambios.activo === 'boolean') {
    cuenta.set('autoAcepta.activo', cambios.activo);
    if (cambios.activo) {
      cuenta.set('autoAcepta.fallos', 0);
      cuenta.set('autoAcepta.apagadaPor', null);
      cuenta.set('autoAcepta.apagadaAt', null);
    }
  }
  await cuenta.save();
  await require('./desempenoDomi').sincronizarPrioridad(cuenta, domi.docs);
  return vista(cuenta.toObject(), tope);
}

/* ═══════════════════════ Al ofrecer ═══════════════════════ */

/**
 * Lo llama offerToDriver justo después de crear la oferta. Si se acepta sola,
 * el domi recibe "Aceptaste el pedido #N" en vez de la oferta.
 * @returns {Promise<boolean>} true si quedó aceptada
 */
async function intentar({ order, business, driver, offer, tarifa }) {
  const config = driver?.prioridad?.autoAcepta;
  if (!config?.activo) return false;
  const DomiCuenta = require('../Models/DomiCuenta');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const fresco = await DeliveryPerson.findById(driver._id).select('lastSeenAt lastLocation activeDeliveries isOnline phone name').lean();
  if (!fresco?.isOnline) return false;
  const local = reglas.coordenadas(business?.location?.coordinates);
  const kmAlLocal = km(puntoDe(fresco), local);
  const veredicto = cumple({
    config,
    kmAlLocal,
    ganancia: tarifa?.pagoDomi ?? null,
    carga: fresco.activeDeliveries,
    lastSeenAt: fresco.lastSeenAt,
  });
  if (!veredicto.ok) return false;

  // Sin trampas recientes ni app alterada
  const cuenta = await DomiCuenta.findOne({ telefono: { $in: reglas.variantesTelefono(fresco.phone) } }).select('seguridad autoAcepta').lean();
  if (!cuenta?.autoAcepta?.activo) return false;
  const trampa = cuenta.seguridad?.ultimaTrampaAt && Date.now() - new Date(cuenta.seguridad.ultimaTrampaAt) < TRAMPA_RECIENTE_MS;
  if (cuenta.seguridad?.alterada || trampa) return false;

  const { acceptOffer } = require('./assignmentService');
  const r = await acceptOffer(offer, { ...driver, name: fresco.name });
  if (!r.ok) return false;

  const Order = require('../Models/Order');
  const DeliveryOffer = require('../Models/DeliveryOffer');
  await Promise.all([
    DeliveryOffer.updateOne({ _id: offer._id }, { $set: { automatica: true } }),
    Order.updateOne({ _id: order._id }, {
      $set: { autoAceptado: { at: new Date(), driverId: driver._id, kmInicial: kmAlLocal } },
      $push: { statusHistory: { status: 'inProgress', timestamp: new Date(), note: `Aceptado automáticamente por ${fresco.name}` } },
    }),
  ]);
  try {
    const socketService = require('./socketService');
    socketService.emitToDeliveryPerson(String(driver._id), 'delivery:assigned', { orderId: String(order._id), automatico: true });
  } catch { /* no crítico */ }
  try {
    const fcm = require('./fcmService');
    await fcm.notifyAssigned({ ...driver, fcmToken: driver.fcmToken }, {
      orderId: order._id, orderNumber: order.orderNumber, address: order.address,
      totalAmount: order.finalAmount || order.totalAmount,
    });
  } catch { /* no crítico */ }
  logger.info('Oferta aceptada automáticamente', { orderId: String(order._id), driverId: String(driver._id), kmAlLocal });
  return true;
}

/* ═══════════════════════ ¿Arrancó? ═══════════════════════ */

const ACTIVOS = { $nin: ['cancelled', 'delivered', 'completed'] };

async function avisarQueArranque(order, driver) {
  if (!driver?.fcmToken) return;
  const fcm = require('./fcmService');
  await fcm.sendData(driver.fcmToken, { type: 'aviso', orderId: String(order._id) }, {
    title: `Arranca hacia el local · pedido #${order.orderNumber}`,
    body: `Aceptaste este pedido solo. Si no sales en ${LIBERAR_MIN - AVISO_MIN} minutos, se le pasa a otro domi.`,
  }, 120);
}

async function liberar(order, driver, kmAhora) {
  const DomiCuenta = require('../Models/DomiCuenta');
  const BusinessConfig = require('../Models/BusinessConfig');
  const { soltar } = require('./panelDomis');
  const desempeno = require('./desempenoDomi');

  await soltar(order, `${driver?.name || 'El domi'} aceptó solo y no arrancó: se le pasa a otro`);
  order.set('autoAceptado.revisadoAt', new Date());
  await order.save();
  // Su oferta aceptada pasa a "vencida": así el reofrecer no se lo vuelve a dar a él
  const DeliveryOffer = require('../Models/DeliveryOffer');
  if (driver?._id) await DeliveryOffer.updateMany({ orderId: order._id, driverId: driver._id, state: 'accepted' }, { $set: { state: 'expired', respondedAt: new Date() } });

  const negocio = await BusinessConfig.findById(order.businessId).lean();
  if (driver?.phone) {
    await desempeno.registrarFalta({
      telefono: driver.phone, driverId: driver._id, tipo: 'no_arranco', refId: order._id,
      pedidoNumero: order.orderNumber, negocio: negocio?.businessName || null,
    });
    const cuenta = await DomiCuenta.findOne({ telefono: { $in: reglas.variantesTelefono(driver.phone) } });
    if (cuenta) {
      const fallos = (cuenta.autoAcepta?.fallos || 0) + 1;
      cuenta.set('autoAcepta.fallos', fallos);
      if (fallos >= MAX_FALLOS) {
        cuenta.set('autoAcepta.activo', false);
        cuenta.set('autoAcepta.apagadaPor', 'no_arranco');
        cuenta.set('autoAcepta.apagadaAt', new Date());
      }
      await cuenta.save();
      const DeliveryPerson = require('../Models/DeliveryPerson');
      const docs = await DeliveryPerson.find({ phone: { $in: reglas.variantesTelefono(cuenta.telefono) }, active: true }).select('_id').lean();
      await desempeno.sincronizarPrioridad(cuenta, docs);
    }
  }
  try {
    require('./socketService').emitToBusiness(String(order.businessId), 'orderUpdated', order.toObject());
  } catch { /* no crítico */ }
  logger.info('Pedido auto-aceptado liberado: el domi no arrancó', { orderId: String(order._id), driverId: String(driver?._id || ''), kmAhora });
  if (negocio) await require('./assignmentService').pickAndOffer(order, negocio).catch(() => {});
}

/** Barrido (cada 10 s con el de ofertas). */
async function revisarArranques(ahora = new Date()) {
  const Order = require('../Models/Order');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const BusinessConfig = require('../Models/BusinessConfig');
  const pendientes = await Order.find({
    'autoAceptado.at': { $lte: new Date(ahora - AVISO_MIN * 60000) },
    'autoAceptado.revisadoAt': null,
    deliveryArrivedStoreAt: null,
    deliveryPickedAt: null,
    status: ACTIVOS,
  }).limit(50);

  for (const o of pendientes) {
    try {
      // Ya no lo lleva quien lo aceptó solo (se lo quitaron o se cambió): nada que revisar
      if (!o.deliveryPersonId || String(o.deliveryPersonId) !== String(o.autoAceptado.driverId)) {
        o.set('autoAceptado.revisadoAt', ahora);
        await o.save();
        continue;
      }
      const [driver, negocio] = await Promise.all([
        DeliveryPerson.findById(o.deliveryPersonId).lean(),
        BusinessConfig.findById(o.businessId).select('location businessName').lean(),
      ]);
      const kmAhora = km(puntoDe(driver), reglas.coordenadas(negocio?.location?.coordinates));
      if (avanzo(o.autoAceptado.kmInicial, kmAhora)) {
        o.set('autoAceptado.revisadoAt', ahora);
        await o.save();
        continue;
      }
      const minutos = (ahora - new Date(o.autoAceptado.at)) / 60000;
      if (minutos >= LIBERAR_MIN) {
        await liberar(o, driver, kmAhora);
      } else if (!o.autoAceptado.avisadoAt) {
        o.set('autoAceptado.avisadoAt', ahora);
        await o.save();
        await avisarQueArranque(o, driver).catch(() => {});
      }
    } catch (e) {
      logger.warn('revisarArranques falló en un pedido', { orderId: String(o._id), error: e.message });
    }
  }
  return pendientes.length;
}

/** Entregó bien un pedido que aceptó solo: los fallos vuelven a cero. */
async function entregoBien(order) {
  if (!order?.autoAceptado?.at || !order.deliveryPersonId) return;
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const DomiCuenta = require('../Models/DomiCuenta');
  const d = await DeliveryPerson.findById(order.deliveryPersonId).select('phone').lean();
  if (!d?.phone) return;
  await DomiCuenta.updateOne({ telefono: { $in: reglas.variantesTelefono(d.phone) } }, { $set: { 'autoAcepta.fallos': 0 } });
}

module.exports = {
  ErrorAuto,
  AVISO_MIN,
  LIBERAR_MIN,
  MAX_FALLOS,
  cumple,
  avanzo,
  configuracion,
  guardar,
  intentar,
  revisarArranques,
  entregoBien,
};
