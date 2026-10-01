/**
 * Los domiciliarios desde el panel del negocio (MenuBy Go).
 *
 *  - Sus domis: los crea el negocio con celular y PIN; entran a MenuBy Go.
 *  - Los de la Red MenuBy que el superadmin le asignó: independientes.
 *
 * Enviar un pedido:
 *  - a un domi propio → se le asigna directo (le suena y aparece en su ruta);
 *  - a uno de la Red → se le ofrece y él acepta o rechaza (su tarifa se
 *    congela al aceptar, igual que con las ofertas automáticas).
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');
const { hashPin } = require('../utils/pinDomi');
const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliveryPartner = require('../Models/DeliveryPartner');
const DeliveryOffer = require('../Models/DeliveryOffer');
const BusinessConfig = require('../Models/BusinessConfig');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const DomiCuenta = require('../Models/DomiCuenta');

class ErrorPanel extends Error {
  constructor(status, message, codigo) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

/** Visto hace menos de esto y conectado = disponible de verdad. */
const VIGENCIA_MS = 10 * 60 * 1000;
const TERMINADOS = ['cancelled', 'delivered', 'completed'];
const PIN_FACIL = /^(\d)\1{3}$|^(1234|4321|0000|1212|2580)$/;

const tel10 = (t) => reglas.variantesTelefono(t).find((x) => x.length === 10) || '';

/** Inicio del día en Colombia (UTC-5, sin horario de verano). */
function inicioDelDia(ahora = new Date()) {
  const col = new Date(ahora.getTime() - 5 * 3600000);
  col.setUTCHours(0, 0, 0, 0);
  return new Date(col.getTime() + 5 * 3600000);
}

function posicion(d) {
  const c = d?.lastLocation?.coordinates;
  return c && c.length === 2 ? { lat: c[1], lng: c[0] } : null;
}

async function laRed() {
  return DeliveryPartner.findOne({ esRedMenuby: true }).select('_id').lean();
}

async function negocio(businessId) {
  if (!mongoose.isValidObjectId(businessId)) throw new ErrorPanel(400, 'Negocio inválido.');
  const b = await BusinessConfig.findById(businessId).lean();
  if (!b) throw new ErrorPanel(404, 'Negocio no encontrado.');
  return b;
}

/* ═══════════════ Lista ═══════════════ */

/** Sus domis y los de la Red asignados, con cómo están ahora mismo. */
async function listarDomis(businessId) {
  const b = await negocio(businessId);
  const local = reglas.coordenadas(b.location?.coordinates);
  const red = await laRed();
  let [propios, deRed] = await Promise.all([
    DeliveryPerson.find({ businessId: b._id }).lean(),
    red ? DeliveryPerson.find({ partnerId: red._id, negociosAsignados: b._id, active: true, 'independiente.estado': 'aprobado' }).lean() : [],
  ]);
  // Quien ya es domi propio del negocio no aparece otra vez como de la Red
  const telsPropios = new Set(propios.filter((d) => d.active).flatMap((d) => reglas.variantesTelefono(d.phone)));
  deRed = deRed.filter((d) => !reglas.variantesTelefono(d.phone).some((t) => telsPropios.has(t)));
  const todos = [...propios, ...deRed];
  const ids = todos.map((d) => d._id);
  const desde = inicioDelDia();

  const [activos, hoyAbiertos, hoyCerrados] = await Promise.all([
    Order.aggregate([
      { $match: { businessId: b._id, deliveryPersonId: { $in: ids }, status: { $nin: TERMINADOS }, deliveryFailedAt: null } },
      { $group: { _id: '$deliveryPersonId', n: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { businessId: b._id, deliveryPersonId: { $in: ids }, deliveredAt: { $gte: desde } } },
      { $group: { _id: '$deliveryPersonId', n: { $sum: 1 } } },
    ]),
    CompletedOrder.aggregate([
      { $match: { businessId: b._id, deliveryPersonId: { $in: ids }, deliveredAt: { $gte: desde } } },
      { $group: { _id: '$deliveryPersonId', n: { $sum: 1 } } },
    ]),
  ]);
  const cuenta = (lista) => new Map(lista.map((x) => [String(x._id), x.n]));
  const nActivos = cuenta(activos);
  const nHoy = cuenta(hoyAbiertos);
  for (const [k, v] of cuenta(hoyCerrados)) nHoy.set(k, (nHoy.get(k) || 0) + v);

  const ahora = Date.now();
  const vista = (d, tipo) => {
    const p = posicion(d);
    const km = p && local ? reglas.distanciaKm(p, local) : null;
    const reciente = d.lastSeenAt && ahora - new Date(d.lastSeenAt) < VIGENCIA_MS;
    return {
      id: String(d._id),
      tipo,
      nombre: d.name,
      telefono: d.phone || null,
      foto: d.photo || null,
      activo: !!d.active,
      enLinea: !!(d.active && d.isOnline && reciente),
      ultimaVez: d.lastSeenAt || null,
      pedidosActivos: nActivos.get(String(d._id)) || 0,
      cargaTotal: d.activeDeliveries || 0,
      entregasHoy: nHoy.get(String(d._id)) || 0,
      kmAlLocal: km != null ? Math.round(km * 10) / 10 : null,
      vehiculo: d.independiente?.vehiculo?.tipo || null,
    };
  };
  return {
    propios: propios.map((d) => vista(d, 'propio')),
    red: deRed.map((d) => vista(d, 'red')),
    maxActivos: b.deliverySettings?.maxActivePerDriver || 1,
  };
}

/* ═══════════════ Crear y editar domis propios ═══════════════ */

async function crearDomi(businessId, { nombre, telefono, pin }) {
  const b = await negocio(businessId);
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (n.length < 3) throw new ErrorPanel(400, 'Escribe el nombre del domiciliario.');
  const tel = tel10(telefono);
  if (!/^3\d{9}$/.test(tel)) throw new ErrorPanel(400, 'Escribe un celular de 10 dígitos (empieza por 3).');
  const variantes = reglas.variantesTelefono(tel);

  const yaAqui = await DeliveryPerson.findOne({ businessId: b._id, phone: { $in: variantes } });
  if (yaAqui) {
    if (yaAqui.active) throw new ErrorPanel(409, 'Ese celular ya es domiciliario de tu negocio.', 'duplicado');
    yaAqui.active = true;
    yaAqui.name = n;
    await yaAqui.save();
    return { id: String(yaAqui._id), reactivado: true };
  }

  /* ¿Ya tiene cuenta en MenuBy Go (reparte en otro lado)? Entonces entra con
     su PIN de siempre: el negocio no se lo cambia. */
  const cuenta = await DomiCuenta.findOne({ telefono: tel }).select('pinHash').lean();
  const otros = await DeliveryPerson.countDocuments({ phone: { $in: variantes } });
  const tieneCuenta = !!cuenta?.pinHash || otros > 0;

  let codigo;
  if (tieneCuenta) {
    codigo = String(Math.floor(1000 + Math.random() * 9000)); // relleno: su PIN es el de la cuenta
  } else {
    codigo = String(pin || '');
    if (!/^\d{4}$/.test(codigo)) throw new ErrorPanel(400, 'El PIN debe tener 4 números.');
    if (PIN_FACIL.test(codigo)) throw new ErrorPanel(400, 'Ese PIN es muy fácil de adivinar. Elige otro.');
  }
  const d = new DeliveryPerson({ businessId: b._id, name: n, phone: tel, code: codigo, active: true });
  await d.save();
  if (!tieneCuenta) {
    await DomiCuenta.updateOne({ telefono: tel }, { $set: { pinHash: hashPin(codigo) } }, { upsert: true });
  }
  logger.info('Domi creado desde el panel', { businessId: String(b._id), id: String(d._id), tieneCuenta });
  return { id: String(d._id), yaTeniaCuenta: tieneCuenta };
}

async function domiPropio(businessId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorPanel(404, 'Domiciliario no encontrado.');
  const d = await DeliveryPerson.findOne({ _id: id, businessId });
  if (!d) throw new ErrorPanel(404, 'Domiciliario no encontrado.');
  return d;
}

async function editarDomi(businessId, id, { nombre, activo }) {
  const d = await domiPropio(businessId, id);
  if (nombre !== undefined) {
    const n = String(nombre).trim().replace(/\s+/g, ' ');
    if (n.length < 3) throw new ErrorPanel(400, 'Escribe el nombre del domiciliario.');
    d.name = n;
  }
  if (activo !== undefined) {
    if (!activo) {
      const lleva = await Order.countDocuments({ businessId, deliveryPersonId: d._id, status: { $nin: TERMINADOS }, deliveryFailedAt: null });
      if (lleva) throw new ErrorPanel(409, `Lleva ${lleva} ${lleva === 1 ? 'pedido' : 'pedidos'} de tu negocio. Quítaselos o espera a que los entregue.`);
      d.isOnline = false;
    }
    d.active = !!activo;
  }
  await d.save();
  return { ok: true };
}

/**
 * Cambiar el PIN: solo si el domi reparte únicamente para este negocio. Si
 * también trabaja con otros, el PIN es suyo y no lo cambia un negocio.
 */
async function cambiarPin(businessId, id, pin) {
  const d = await domiPropio(businessId, id);
  const p = String(pin || '');
  if (!/^\d{4}$/.test(p)) throw new ErrorPanel(400, 'El PIN debe tener 4 números.');
  if (PIN_FACIL.test(p)) throw new ErrorPanel(400, 'Ese PIN es muy fácil de adivinar. Elige otro.');
  const variantes = reglas.variantesTelefono(d.phone);
  const otros = await DeliveryPerson.countDocuments({ phone: { $in: variantes }, _id: { $ne: d._id } });
  if (otros) throw new ErrorPanel(409, 'Este domiciliario también reparte con otros negocios: el PIN es suyo y solo él lo puede cambiar.', 'pin_compartido');
  d.code = p;
  await d.save();
  // Nuevo PIN y se cierran las sesiones abiertas
  await DomiCuenta.updateOne({ telefono: tel10(d.phone) }, { $set: { pinHash: hashPin(p), refreshHash: null, fallos: 0, bloqueadaHasta: null } }, { upsert: true });
  return { ok: true };
}

/* ═══════════════ Enviar un pedido ═══════════════ */

async function pedidoDelNegocio(businessId, orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw new ErrorPanel(404, 'Pedido no encontrado.');
  const o = await Order.findOne({ _id: orderId, businessId });
  if (!o) throw new ErrorPanel(404, 'Pedido no encontrado.');
  if (o.orderType !== 'delivery') throw new ErrorPanel(400, 'Solo los pedidos a domicilio llevan domiciliario.');
  if (TERMINADOS.includes(o.status)) throw new ErrorPanel(409, 'Este pedido ya se cerró.');
  return o;
}

/** Quién lo lleva o a quién se le ofreció (para mostrarlo en el panel). */
async function asignacionActual(o) {
  if (o.deliveryPersonId) {
    const d = await DeliveryPerson.findById(o.deliveryPersonId).select('name photo phone').lean();
    return {
      estado: 'asignado', id: String(o.deliveryPersonId), nombre: d?.name || 'Domiciliario', foto: d?.photo || null,
      telefono: d?.phone || null, recogido: !!o.deliveryPickedAt,
    };
  }
  const oferta = await DeliveryOffer.findOne({ orderId: o._id, state: 'pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  if (oferta) {
    const d = await DeliveryPerson.findById(oferta.driverId).select('name photo').lean();
    return { estado: 'ofrecido', id: String(oferta.driverId), nombre: d?.name || 'Domiciliario', foto: d?.photo || null, venceAt: oferta.expiresAt };
  }
  return null;
}

/** Para la ventana "Enviar a domiciliario": quiénes pueden llevarlo. */
async function candidatos(businessId, orderId) {
  const o = await pedidoDelNegocio(businessId, orderId);
  const { propios, red, maxActivos } = await listarDomis(businessId);
  const orden = (a, b) => (b.enLinea - a.enLinea) || (a.pedidosActivos - b.pedidosActivos)
    || ((a.kmAlLocal ?? 99) - (b.kmAlLocal ?? 99));
  const empresas = await DeliveryPartner.find({ active: true, esRedMenuby: { $ne: true } }).select('name logo').sort({ name: 1 }).lean();
  return {
    pedido: { id: String(o._id), numero: o.orderNumber, cliente: o.customerName, direccion: o.address || '', tieneUbicacion: !!reglas.coordenadas(o.deliveryCoordinates) },
    actual: await asignacionActual(o),
    propios: propios.filter((d) => d.activo).sort(orden),
    red: red.sort(orden),
    empresas: empresas.map((e) => ({ id: String(e._id), nombre: e.name, logo: e.logo || null })),
    maxActivos,
  };
}

async function avisarCambio(o) {
  const socketService = require('./socketService');
  socketService.emitToBusiness(String(o.businessId), 'orderUpdated', o.toObject ? o.toObject() : o);
}

/** Saca al domi actual (y las ofertas pendientes) sin tocar el pedido. */
async function soltar(o, motivo) {
  const socketService = require('./socketService');
  await DeliveryOffer.updateMany({ orderId: o._id, state: 'pending' }, { $set: { state: 'superseded', respondedAt: new Date() } });
  if (!o.deliveryPersonId) return;
  const anterior = String(o.deliveryPersonId);
  const { releaseDriver } = require('./orderCompletionService');
  await releaseDriver(o.deliveryPersonId, { delivered: false });
  o.deliveryPersonId = null;
  o.deliveryAssignedAt = null;
  o.tarifaRed = undefined;
  o.statusHistory.push({ status: o.status, timestamp: new Date(), note: motivo });
  // La app del domi se entera y el pedido sale de su ruta
  socketService.emitToDeliveryPerson(anterior, 'orderUpdated', { orderId: String(o._id), quitado: true });
}

async function asignar(businessId, orderId, driverId, quien = '') {
  const o = await pedidoDelNegocio(businessId, orderId);
  if (!mongoose.isValidObjectId(driverId)) throw new ErrorPanel(404, 'Domiciliario no encontrado.');
  if (o.deliveryPickedAt) throw new ErrorPanel(409, 'El domiciliario ya recogió este pedido: no se puede cambiar.');
  if (String(o.deliveryPersonId || '') === String(driverId)) return { estado: 'asignado', yaEstaba: true };
  const b = await negocio(businessId);
  const d = await DeliveryPerson.findById(driverId);
  if (!d || !d.active) throw new ErrorPanel(404, 'Ese domiciliario ya no está activo.');

  const esPropio = String(d.businessId || '') === String(b._id);
  const red = await laRed();
  const esDeRed = !!red && String(d.partnerId || '') === String(red._id)
    && (d.negociosAsignados || []).some((n) => String(n) === String(b._id)) && d.independiente?.estado === 'aprobado';
  if (!esPropio && !esDeRed) throw new ErrorPanel(403, 'Ese domiciliario no reparte para tu negocio.');

  const socketService = require('./socketService');
  const dsm = require('./deliveryStateMachine');

  if (esPropio) {
    // Propio: directo. Sale el anterior (si había) y entra este.
    await soltar(o, `Domiciliario cambiado por ${quien || 'el negocio'}`);
    o.deliveryPersonId = d._id;
    o.deliveryAssignedAt = new Date();
    o.assignmentMethod = 'manual';
    o.deliveryMode = 'profile';
    if (!o.confirmationCode) o.confirmationCode = require('./assignmentService').generateConfirmationCode();
    if (o.status !== 'inProgress') {
      o.status = 'inProgress';
      o.statusHistory.push({ status: 'inProgress', timestamp: new Date(), note: `Asignado a ${d.name}${quien ? ` por ${quien}` : ''}` });
    }
    await o.save();
    await DeliveryPerson.updateOne({ _id: d._id }, { $set: { status: 'on_delivery' }, $inc: { activeDeliveries: 1 } });
    try { await dsm.recordForOrder(o, 'assign', { actor: 'admin', assignmentMethod: 'manual', driverId: d._id }); } catch { /* registro de auditoría: no frena */ }
    socketService.emitToDeliveryPerson(String(d._id), 'delivery:assigned', { orderId: String(o._id) });
    if (d.fcmToken) {
      require('./fcmService').notifyAssigned(d, {
        orderId: o._id, orderNumber: o.orderNumber, address: o.address, totalAmount: o.finalAmount || o.totalAmount,
      }).catch(() => {});
    }
    await avisarCambio(o);
    logger.info('Pedido asignado desde el panel', { orderId: String(o._id), driverId: String(d._id) });
    return { estado: 'asignado', nombre: d.name };
  }

  // De la Red: se le ofrece. Si ya lleva otro domi, primero hay que quitarlo.
  if (o.deliveryPersonId) throw new ErrorPanel(409, 'Este pedido ya tiene domiciliario. Quítaselo primero para ofrecerlo a otro.');
  const pendiente = await DeliveryOffer.findOne({ orderId: o._id, driverId: d._id, state: 'pending', expiresAt: { $gt: new Date() } }).lean();
  if (pendiente) return { estado: 'ofrecido', nombre: d.name, venceAt: pendiente.expiresAt, yaEstaba: true };
  await DeliveryOffer.updateMany({ orderId: o._id, state: 'pending' }, { $set: { state: 'superseded', respondedAt: new Date() } });
  const local = reglas.coordenadas(b.location?.coordinates);
  const p = posicion(d);
  const km = p && local ? reglas.distanciaKm(p, local) : null;
  const tarifa = await require('./red').tarifaParaOferta({ order: o, business: b, driver: d }).catch(() => undefined);
  const assignment = require('./assignmentService');
  const { offer } = await assignment.offerToDriver(o, b, d, km != null ? Math.round(km * 100) / 100 : null, 1, tarifa);
  await avisarCambio(o);
  return { estado: 'ofrecido', nombre: d.name, venceAt: offer?.expiresAt || null };
}

/** "Que lo tome el más cercano": la asignación automática, aunque el negocio esté en manual. */
async function automatico(businessId, orderId) {
  const o = await pedidoDelNegocio(businessId, orderId);
  if (o.deliveryPersonId) throw new ErrorPanel(409, 'Este pedido ya tiene domiciliario.');
  const b = await negocio(businessId);
  const ajustes = b.deliverySettings || {};
  const modo = ajustes.assignmentMode && ajustes.assignmentMode !== 'manual' ? ajustes.assignmentMode : 'auto_nearest';
  const r = await require('./assignmentService').pickAndOffer(o, { ...b, deliverySettings: { ...ajustes, assignmentMode: modo } });
  if (r?.offered) return { estado: 'ofrecido', nombre: r.driver?.name || null, venceAt: r.offer?.expiresAt || null };
  if (r?.reason === 'no_coordinates') throw new ErrorPanel(409, 'El pedido no tiene la ubicación del cliente en el mapa: elige el domiciliario tú.');
  throw new ErrorPanel(409, 'No hay domiciliarios conectados cerca en este momento.', 'sin_domis');
}

async function quitar(businessId, orderId, quien = '') {
  const o = await pedidoDelNegocio(businessId, orderId);
  if (o.deliveryPickedAt) throw new ErrorPanel(409, 'El domiciliario ya recogió este pedido: no se le puede quitar.');
  if (!o.deliveryPersonId) {
    await DeliveryOffer.updateMany({ orderId: o._id, state: 'pending' }, { $set: { state: 'superseded', respondedAt: new Date() } });
    return { ok: true };
  }
  await soltar(o, `Domiciliario quitado por ${quien || 'el negocio'}`);
  await o.save();
  await avisarCambio(o);
  return { ok: true };
}

module.exports = {
  ErrorPanel,
  inicioDelDia,
  listarDomis,
  crearDomi,
  editarDomi,
  cambiarPin,
  candidatos,
  asignar,
  automatico,
  quitar,
};
