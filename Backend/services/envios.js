/**
 * Envíos de las empresas de reparto a sus propios clientes (por fuera de
 * MenuBy): la tecnología de MenuBy puesta al servicio de la empresa.
 *
 *   empresa ──crea──▶ cliente ──pide──▶ envío ──se ofrece──▶ domi de la empresa
 *                                          │
 *                                          └──▶ enlace de seguimiento para el que recibe
 *
 * El domi lo lleva con la misma app y los mismos pasos que un pedido de
 * MenuBy; por eso el envío guarda las mismas marcas de tiempo que un Order y
 * reutiliza las reglas de utils/domiApp. El precio lo calcula siempre el
 * servidor (utils/precioEnvio): lo que mande el navegador no cuenta.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');
const { calcularPrecioEnvio, normalizarTarifaEnvio, normalizarZonas } = require('../utils/precioEnvio');

const DeliveryPartner = require('../Models/DeliveryPartner');
const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliveryOffer = require('../Models/DeliveryOffer');
const ClienteEmpresa = require('../Models/ClienteEmpresa');
const Envio = require('../Models/Envio');
const Counter = require('../Models/Counter');
const DomiLiquidacion = require('../Models/DomiLiquidacion');

const OFERTA_SEG = 45;
const RADIO_KM = 12;

class ErrorEnvio extends Error {
  constructor(status, mensaje, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const tel10 = (t) => reglas.variantesTelefono(t).find((x) => x.length === 10) || '';
const punto = (p) => reglas.coordenadas(p);

/* ═══════════════ Clientes de la empresa ═══════════════ */

function limpiarCliente(c) {
  if (!c) return null;
  return {
    id: String(c._id), nombre: c.nombre, negocio: c.negocio || '', telefono: c.telefono || '', email: c.email || '',
    direccion: c.direccion || '', ubicacion: punto(c.ubicacion), notas: c.notas || '', activo: c.activo !== false,
    totalEnvios: c.totalEnvios || 0, creadoAt: c.createdAt,
  };
}

async function crearCliente(partnerId, datos) {
  const nombre = String(datos.nombre || '').trim();
  if (nombre.length < 3) throw new ErrorEnvio(400, 'Escribe el nombre del cliente.');
  const telefono = datos.telefono ? tel10(datos.telefono) : '';
  const email = String(datos.email || '').trim().toLowerCase();
  if (!telefono && !email) throw new ErrorEnvio(400, 'Pon un celular o un correo: es con lo que va a entrar.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorEnvio(400, 'El correo no es válido.');
  const clave = String(datos.clave || '');
  if (clave.length < 6) throw new ErrorEnvio(400, 'La clave debe tener al menos 6 caracteres.');
  // Además del índice único: la primera vez la colección puede no tenerlo construido aún
  const repetido = await ClienteEmpresa.findOne({ partnerId, $or: [telefono ? { telefono } : null, email ? { email } : null].filter(Boolean) }).lean();
  if (repetido) throw new ErrorEnvio(409, 'Ya tienes un cliente con ese celular o correo.');
  const c = new ClienteEmpresa({
    partnerId, nombre, negocio: String(datos.negocio || '').trim(), telefono, email,
    direccion: String(datos.direccion || '').trim(), ubicacion: punto(datos.ubicacion) || undefined,
    notas: String(datos.notas || '').slice(0, 300), claveHash: 'x',
  });
  await c.ponerClave(clave);
  try {
    await c.save();
  } catch (e) {
    if (e.code === 11000) throw new ErrorEnvio(409, 'Ya tienes un cliente con ese celular o correo.');
    throw e;
  }
  return limpiarCliente(c);
}

async function actualizarCliente(partnerId, id, datos) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorEnvio(404, 'Cliente no encontrado.');
  const c = await ClienteEmpresa.findOne({ _id: id, partnerId });
  if (!c) throw new ErrorEnvio(404, 'Cliente no encontrado.');
  for (const k of ['nombre', 'negocio', 'direccion', 'notas']) if (datos[k] !== undefined) c[k] = String(datos[k]).trim().slice(0, k === 'notas' ? 300 : 160);
  if (datos.ubicacion !== undefined) c.ubicacion = punto(datos.ubicacion) || undefined;
  if (datos.activo !== undefined) { c.activo = !!datos.activo; if (!c.activo) c.refreshHash = null; }
  if (datos.clave) {
    if (String(datos.clave).length < 6) throw new ErrorEnvio(400, 'La clave debe tener al menos 6 caracteres.');
    await c.ponerClave(datos.clave);
    c.refreshHash = null; // cierra sus sesiones abiertas
  }
  await c.save();
  return limpiarCliente(c);
}

async function listarClientes(partnerId) {
  const lista = await ClienteEmpresa.find({ partnerId }).sort({ createdAt: -1 }).limit(500).lean();
  return lista.map(limpiarCliente);
}

/* Sesión del cliente: token corto + renovación, como el resto de la plataforma */
function firmarCliente(c) {
  return jwt.sign({ tipo: 'cliente-envios', cid: String(c._id), pid: String(c.partnerId) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function entrarCliente(slug, { usuario, clave }) {
  const partner = await empresaPorSlug(slug);
  const u = String(usuario || '').trim().toLowerCase();
  const filtro = u.includes('@') ? { email: u } : { telefono: tel10(u) || '__nadie__' };
  const c = await ClienteEmpresa.findOne({ partnerId: partner._id, activo: true, ...filtro });
  if (!c || !(await c.verificarClave(clave))) throw new ErrorEnvio(401, 'Usuario o clave incorrectos.');
  return { token: firmarCliente(c), cliente: limpiarCliente(c) };
}

async function autenticarCliente(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    let dec;
    try { dec = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', process.env.JWT_SECRET); } catch { dec = null; }
    if (!dec || dec.tipo !== 'cliente-envios') return res.status(401).json({ message: 'Tu sesión venció. Entra otra vez.' });
    const c = await ClienteEmpresa.findOne({ _id: dec.cid, partnerId: dec.pid, activo: true });
    const p = c && await DeliveryPartner.findOne({ _id: dec.pid, active: true });
    if (!c || !p) return res.status(401).json({ message: 'Tu cuenta no está activa.' });
    req.cliente = c;
    req.empresa = p;
    next();
  } catch (e) {
    next(e);
  }
}

/* ═══════════════ La empresa: página pública, tarifa y zonas ═══════════════ */

async function empresaPorSlug(slug) {
  const s = String(slug || '').toLowerCase();
  const p = /^[a-z0-9-]{2,60}$/.test(s) ? await DeliveryPartner.findOne({ slug: s, active: true, esRedMenuby: { $ne: true } }) : null;
  if (!p) throw new ErrorEnvio(404, 'Esta empresa no existe o ya no está activa.');
  return p;
}

/** Lo que muestra la página pública de la empresa (sin datos internos). */
async function paginaPublica(slug) {
  const p = await empresaPorSlug(slug);
  const t = normalizarTarifaEnvio(p.tarifaEnvios || {});
  const zonas = normalizarZonas(p.zonasEnvio).filter((z) => z.activa && z.precio > 0);
  const desde = Math.min(...[t.minimo || t.base || Infinity, ...zonas.map((z) => z.precio)].filter((x) => x > 0));
  const domis = await DeliveryPerson.countDocuments({ partnerId: p._id, active: true });
  return {
    nombre: p.name, slug: p.slug, logo: p.logo || null, telefono: p.phone || '',
    landing: p.landing || {}, ubicacion: punto(p.ubicacion),
    desde: Number.isFinite(desde) ? desde : null,
    zonas: zonas.map((z) => ({ nombre: z.nombre, precio: z.precio })),
    porKm: t.porKm || null, maximoKm: t.maximoKm || null,
    domiciliarios: domis,
  };
}

async function guardarConfigEmpresa(partner, datos) {
  const set = {};
  if (datos.slug !== undefined) {
    const slug = String(datos.slug || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
    if (slug.length < 3) throw new ErrorEnvio(400, 'La dirección de tu página debe tener al menos 3 letras.');
    const otro = await DeliveryPartner.findOne({ slug, _id: { $ne: partner._id } }).lean();
    if (otro) throw new ErrorEnvio(409, 'Esa dirección ya la usa otra empresa.');
    set.slug = slug;
  }
  if (datos.landing) {
    const l = datos.landing;
    set.landing = {
      descripcion: String(l.descripcion || '').slice(0, 400),
      ciudad: String(l.ciudad || '').slice(0, 60),
      cobertura: String(l.cobertura || '').slice(0, 200),
      whatsapp: String(l.whatsapp || '').replace(/[^\d+]/g, '').slice(0, 20),
      color: /^#[0-9a-fA-F]{6}$/.test(l.color || '') ? l.color : '#E11D2A',
      portada: partner.landing?.portada || null,
      horario: String(l.horario || '').slice(0, 120),
    };
  }
  if (datos.tarifaEnvios) set.tarifaEnvios = normalizarTarifaEnvio(datos.tarifaEnvios);
  if (datos.zonasEnvio) set.zonasEnvio = normalizarZonas(datos.zonasEnvio);
  if (datos.ubicacion !== undefined) set.ubicacion = punto(datos.ubicacion) || undefined;
  if (datos.autoDispatch !== undefined) set.autoDispatch = !!datos.autoDispatch;
  if (!Object.keys(set).length) throw new ErrorEnvio(400, 'Nada que guardar.');
  await DeliveryPartner.updateOne({ _id: partner._id }, { $set: set });
  return configEmpresa(await DeliveryPartner.findById(partner._id).lean());
}

function configEmpresa(p) {
  return {
    slug: p.slug || '', landing: p.landing || {}, ubicacion: punto(p.ubicacion),
    tarifaEnvios: normalizarTarifaEnvio(p.tarifaEnvios || {}), zonasEnvio: normalizarZonas(p.zonasEnvio),
    autoDispatch: !!p.autoDispatch, driverPay: reglas.normalizarReglaPago(p.driverPay),
  };
}

/* ═══════════════ Cotizar y crear ═══════════════ */

async function cotizar(partner, { origen, destino }) {
  const o = punto(origen);
  const d = punto(destino);
  const km = o && d ? await require('./rutas').distanciaKm(o, d) : null;
  return calcularPrecioEnvio(partner.tarifaEnvios || {}, normalizarZonas(partner.zonasEnvio), o, d, km);
}

function limpiarPunto(p, obligatorio) {
  const direccion = String(p?.direccion || '').trim();
  if (direccion.length < 5) throw new ErrorEnvio(400, `Escribe la dirección de ${obligatorio}.`);
  const ubicacion = punto(p?.ubicacion);
  if (!ubicacion) throw new ErrorEnvio(400, `Marca en el mapa el punto de ${obligatorio}.`);
  return {
    nombre: String(p?.nombre || '').trim().slice(0, 80),
    telefono: String(p?.telefono || '').replace(/[^\d+]/g, '').slice(0, 20),
    direccion: direccion.slice(0, 160),
    notas: String(p?.notas || '').trim().slice(0, 200),
    ubicacion,
  };
}

async function siguienteNumero(partnerId) {
  const c = await Counter.findOneAndUpdate({ _id: `envio:${partnerId}` }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

async function crearEnvio(cliente, partner, datos) {
  const origen = limpiarPunto(datos.origen, 'recogida');
  const destino = limpiarPunto(datos.destino, 'entrega');
  if (!destino.nombre) throw new ErrorEnvio(400, 'Escribe a quién se le entrega.');
  if (!/^\+?\d{7,15}$/.test(destino.telefono)) throw new ErrorEnvio(400, 'Escribe el celular de quien recibe.');
  const q = await cotizar(partner, { origen: origen.ubicacion, destino: destino.ubicacion });
  if (!q.cubre) throw new ErrorEnvio(422, q.motivo || 'La empresa no llega a esa dirección.', 'sin_cobertura');
  const valorACobrar = Math.max(0, Math.round(Number(datos.valorACobrar) || 0));
  if (valorACobrar > 5_000_000) throw new ErrorEnvio(400, 'El valor a cobrar es demasiado alto.');

  const envio = await Envio.create({
    partnerId: partner._id, clienteId: cliente._id, numero: await siguienteNumero(partner._id),
    origen, destino,
    descripcion: String(datos.descripcion || '').trim().slice(0, 200),
    valorACobrar, pagaEnvio: datos.pagaEnvio === 'destinatario' ? 'destinatario' : 'cliente',
    precio: q.precio, desglosePrecio: q.desglose, zona: q.zona || null, km: q.km,
    codigoEntrega: String(crypto.randomInt(1000, 10000)),
    seguimiento: crypto.randomBytes(9).toString('base64url'),
    historial: [{ estado: 'buscando', nota: 'Envío creado' }],
  });
  await ClienteEmpresa.updateOne({ _id: cliente._id }, { $inc: { totalEnvios: 1 } });
  avisarEmpresa(partner._id, 'envio:nuevo', envio);
  despachar(envio._id).catch((e) => logger.warn('No se pudo despachar el envío', { error: e.message }));
  return envioParaCliente(envio.toObject());
}

function envioParaCliente(e) {
  return {
    id: String(e._id), numero: e.numero, estado: e.estado, origen: e.origen, destino: e.destino,
    descripcion: e.descripcion, valorACobrar: e.valorACobrar, pagaEnvio: e.pagaEnvio, precio: e.precio,
    desglosePrecio: e.desglosePrecio, zona: e.zona, km: e.km,
    etapa: etapa(e), seguimiento: e.seguimiento, creadoAt: e.createdAt,
    marcas: marcas(e), motivoFalla: e.deliveryFailReason || null,
  };
}

function marcas(e) {
  return {
    asignado: e.deliveryAssignedAt || null, llegoOrigen: e.deliveryArrivedStoreAt || null, recogido: e.deliveryPickedAt || null,
    llegoDestino: e.deliveryArrivedCustomerAt || null, entregado: e.deliveredAt || null, noEntregado: e.deliveryFailedAt || null,
    cancelado: e.canceladoAt || null,
  };
}

/** Etapa legible: buscando domi, va a recoger, en camino, entregado... */
function etapa(e) {
  if (e.estado === 'cancelado') return 'cancelado';
  if (e.estado === 'buscando') return 'buscando';
  const d = reglas.estadoParaDomi(e);
  return { hacia_local: 'va_a_recoger', en_local: 'recogiendo', hacia_cliente: 'en_camino', con_cliente: 'llegando', entregado: 'entregado', no_entregado: 'no_entregado' }[d] || d;
}

async function envioDeCliente(cliente, id) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorEnvio(404, 'Envío no encontrado.');
  const e = await Envio.findOne({ _id: id, clienteId: cliente._id });
  if (!e) throw new ErrorEnvio(404, 'Envío no encontrado.');
  return e;
}

async function listarEnviosCliente(cliente, { limite = 50 } = {}) {
  const lista = await Envio.find({ clienteId: cliente._id }).sort({ createdAt: -1 }).limit(Math.min(200, limite)).lean();
  return lista.map(envioParaCliente);
}

async function cancelar(envio, quien) {
  if (!['buscando', 'asignado'].includes(envio.estado) || envio.deliveryPickedAt) {
    throw new ErrorEnvio(409, 'Ya no se puede cancelar: el domi ya lo recogió.');
  }
  const driverId = envio.deliveryPersonId;
  envio.estado = 'cancelado';
  envio.canceladoAt = new Date();
  envio.canceladoPor = quien;
  envio.historial.push({ estado: 'cancelado', nota: `Cancelado por ${quien}` });
  await envio.save();
  await DeliveryOffer.updateMany({ envioId: envio._id, state: 'pending' }, { $set: { state: 'superseded' } });
  if (driverId) {
    const { releaseDriver } = require('./orderCompletionService');
    await releaseDriver(driverId, { delivered: false });
    require('./socketService').emitToDeliveryPerson(String(driverId), 'delivery:assigned', { envioId: String(envio._id), cancelado: true });
  }
  avisarEmpresa(envio.partnerId, 'envio:actualizado', envio);
  return envioParaCliente(envio.toObject());
}

/* ═══════════════ Despacho: ofrecer al domi de la empresa ═══════════════ */

async function domisDisponibles(partner, excluidos = []) {
  const max = partner.maxActivePerDriver || 2;
  return DeliveryPerson.find({
    partnerId: partner._id, active: true, isOnline: true,
    _id: { $nin: excluidos },
    lastSeenAt: { $gte: new Date(Date.now() - 5 * 60000) },
    'lastLocation.coordinates': { $exists: true },
    $or: [{ activeDeliveries: { $lt: max } }, { activeDeliveries: { $exists: false } }],
  }).lean();
}

/**
 * Si la empresa tiene reparto automático, el envío se le ofrece a su domi
 * libre más cercano al punto de recogida. Si no, queda "buscando" para que la
 * empresa lo asigne a mano desde su portal.
 */
async function despachar(envioId) {
  const envio = await Envio.findById(envioId);
  if (!envio || envio.estado !== 'buscando') return null;
  const partner = await DeliveryPartner.findById(envio.partnerId).lean();
  if (!partner?.autoDispatch) return null;
  const pendiente = await DeliveryOffer.findOne({ envioId: envio._id, state: 'pending', expiresAt: { $gt: new Date() } }).lean();
  if (pendiente) return null;

  const candidatos = await domisDisponibles(partner, envio.rechazadoPor || []);
  const origen = envio.origen.ubicacion;
  const cerca = candidatos
    .map((d) => ({ d, km: reglas.distanciaKm(origen, { lat: d.lastLocation.coordinates[1], lng: d.lastLocation.coordinates[0] }) }))
    .filter((x) => x.km != null && x.km <= RADIO_KM)
    .sort((a, b) => a.km - b.km)[0];
  if (!cerca) {
    avisarEmpresa(envio.partnerId, 'envio:sin_domi', envio);
    return null;
  }
  const offer = await DeliveryOffer.create({
    envioId: envio._id, driverId: cerca.d._id, distanceKm: Math.round(cerca.km * 10) / 10,
    attempt: (envio.rechazadoPor || []).length + 1, expiresAt: new Date(Date.now() + OFERTA_SEG * 1000),
  });
  try {
    require('./socketService').emitToDeliveryPerson(String(cerca.d._id), 'delivery:offer', { offerId: String(offer._id), envioId: String(envio._id) });
    if (cerca.d.fcmToken) {
      await require('./fcmService').notifyOffer(cerca.d, {
        offerId: offer._id, orderId: envio._id, businessName: partner.name, address: envio.destino.direccion,
        ganancia: reglas.gananciaDomi({ deliveryFee: envio.precio }, partner.driverPay), distanceKm: cerca.km, timeoutSec: OFERTA_SEG,
      });
    }
  } catch { /* aviso no crítico */ }
  return offer;
}

async function aceptarOferta(offer, driver) {
  if (offer.state !== 'pending') return { ok: false, reason: 'offer_not_pending' };
  if (offer.expiresAt < new Date()) {
    offer.state = 'expired'; offer.respondedAt = new Date(); await offer.save();
    return { ok: false, reason: 'expired' };
  }
  // Atómico: si dos domis aceptan a la vez, solo uno se lo lleva
  const envio = await Envio.findOneAndUpdate(
    { _id: offer.envioId, estado: 'buscando', deliveryPersonId: null },
    { $set: { estado: 'asignado', deliveryPersonId: driver._id, deliveryAssignedAt: new Date() }, $push: { historial: { estado: 'asignado', nota: `Lo tomó ${driver.name}` } } },
    { new: true },
  );
  if (!envio) {
    offer.state = 'superseded'; await offer.save();
    return { ok: false, reason: 'already_assigned' };
  }
  offer.state = 'accepted'; offer.respondedAt = new Date(); await offer.save();
  await DeliveryOffer.updateMany({ envioId: envio._id, state: 'pending', _id: { $ne: offer._id } }, { $set: { state: 'superseded' } });
  await DeliveryPerson.updateOne({ _id: driver._id }, { $set: { status: 'on_delivery' }, $inc: { activeDeliveries: 1 } });
  avisarEmpresa(envio.partnerId, 'envio:actualizado', envio);
  return { ok: true, envio };
}

async function rechazarOferta(offer) {
  if (offer.state !== 'pending') return { ok: false };
  offer.state = 'rejected'; offer.respondedAt = new Date(); await offer.save();
  await Envio.updateOne({ _id: offer.envioId }, { $addToSet: { rechazadoPor: offer.driverId } });
  await despachar(offer.envioId);
  return { ok: true };
}

/** Barrido: ofertas de envío vencidas se re-ofrecen al siguiente domi. */
async function expirarOfertas() {
  const vencidas = await DeliveryOffer.find({ envioId: { $exists: true }, state: 'pending', expiresAt: { $lt: new Date() } }).limit(50);
  for (const o of vencidas) {
    o.state = 'expired'; o.respondedAt = new Date(); await o.save();
    await Envio.updateOne({ _id: o.envioId }, { $addToSet: { rechazadoPor: o.driverId } });
    // Falta solo si su app SÍ le mostró la oferta
    if (o.vistaAt) {
      const envio = await Envio.findById(o.envioId).select('numero').lean();
      await require('./desempenoDomi').registrarFaltaDe(o.driverId, { tipo: 'oferta_vencida', refId: o._id, pedidoNumero: envio?.numero }).catch(() => {});
    }
    await despachar(o.envioId).catch(() => {});
  }
  return vencidas.length;
}

async function asignarManual(partner, envioId, driverId) {
  if (!mongoose.isValidObjectId(envioId) || !mongoose.isValidObjectId(driverId)) throw new ErrorEnvio(400, 'Datos inválidos.');
  const driver = await DeliveryPerson.findOne({ _id: driverId, partnerId: partner._id, active: true });
  if (!driver) throw new ErrorEnvio(404, 'Ese domiciliario no es de tu empresa.');
  const envio = await Envio.findOneAndUpdate(
    { _id: envioId, partnerId: partner._id, estado: 'buscando', deliveryPersonId: null },
    { $set: { estado: 'asignado', deliveryPersonId: driver._id, deliveryAssignedAt: new Date() }, $push: { historial: { estado: 'asignado', nota: `Asignado a ${driver.name}` } } },
    { new: true },
  );
  if (!envio) throw new ErrorEnvio(409, 'Ese envío ya no está buscando domi.');
  await DeliveryOffer.updateMany({ envioId: envio._id, state: 'pending' }, { $set: { state: 'superseded' } });
  await DeliveryPerson.updateOne({ _id: driver._id }, { $set: { status: 'on_delivery' }, $inc: { activeDeliveries: 1 } });
  try {
    require('./socketService').emitToDeliveryPerson(String(driver._id), 'delivery:assigned', { envioId: String(envio._id) });
    if (driver.fcmToken) await require('./fcmService').notifyAssigned(driver, { _id: envio._id, orderNumber: envio.numero, address: envio.destino.direccion });
  } catch { /* aviso no crítico */ }
  avisarEmpresa(partner._id, 'envio:actualizado', envio);
  return envioParaCliente(envio.toObject());
}

function avisarEmpresa(partnerId, evento, envio) {
  try { require('./socketService').emitToPartner(String(partnerId), evento, { envioId: String(envio._id), numero: envio.numero, estado: envio.estado }); } catch { /* no crítico */ }
}

/* ═══════════════ La app del domi ═══════════════ */

/** Un envío con la forma de un pedido, para que la app lo muestre igual. */
function envioParaDomi(e, { partner, regla }) {
  const origen = punto(e.origen?.ubicacion);
  const destino = punto(e.destino?.ubicacion);
  const cobraEnvio = e.pagaEnvio === 'destinatario';
  return {
    id: String(e._id),
    tipo: 'envio',
    numero: e.numero,
    driverId: e.deliveryPersonId ? String(e.deliveryPersonId) : null,
    estado: reglas.estadoParaDomi(e),
    negocio: {
      id: `envio-${e._id}`,
      nombre: e.origen?.nombre || 'Recogida',
      logo: partner?.logo || null,
      telefono: e.origen?.telefono || null,
      direccion: e.origen?.direccion || '',
      ubicacion: origen,
      color: partner?.landing?.color || null,
      empresa: partner?.name || null,
      notas: e.origen?.notas || '',
    },
    cliente: {
      nombre: e.destino?.nombre || 'Quien recibe',
      telefono: e.destino?.telefono || null,
      direccion: e.destino?.direccion || '',
      notas: e.destino?.notas || '',
      ubicacion: destino,
    },
    productos: [{ nombre: e.descripcion || 'Paquete', cantidad: 1, notas: '', extras: [] }],
    total: (e.valorACobrar || 0) + (cobraEnvio ? e.precio : 0),
    domicilio: e.precio,
    metodoPago: (e.valorACobrar || 0) + (cobraEnvio ? e.precio : 0) > 0 ? 'efectivo' : 'pagado',
    efectivo: (e.valorACobrar || 0) + (cobraEnvio ? e.precio : 0),
    ganancia: reglas.gananciaDomi({ deliveryFee: e.precio }, regla),
    desgloseGanancia: null,
    distanciaKm: origen && destino ? Math.round(reglas.distanciaKm(origen, destino) * 10) / 10 : e.km,
    pideCodigoEntrega: true,
    pideCodigoRecogida: false,
    asignadoAt: e.deliveryAssignedAt || null,
    marcas: {
      llegoLocal: e.deliveryArrivedStoreAt || null, recogido: e.deliveryPickedAt || null,
      llegoCliente: e.deliveryArrivedCustomerAt || null, entregado: e.deliveredAt || null,
    },
    listoEnLocal: true,
  };
}

async function empresasPorId(ids) {
  const u = [...new Set(ids.filter(Boolean).map(String))];
  if (!u.length) return new Map();
  const l = await DeliveryPartner.find({ _id: { $in: u } }).select('name logo landing driverPay').lean();
  return new Map(l.map((p) => [String(p._id), p]));
}

async function paraLaApp(driverIds) {
  const [activos, ofertas] = await Promise.all([
    Envio.find({ deliveryPersonId: { $in: driverIds }, estado: 'asignado', deliveredAt: null, deliveryFailedAt: null }).sort({ deliveryAssignedAt: 1 }).lean(),
    DeliveryOffer.find({ envioId: { $exists: true }, driverId: { $in: driverIds }, state: 'pending', expiresAt: { $gt: new Date() } }).lean(),
  ]);
  const deOfertas = ofertas.length ? await Envio.find({ _id: { $in: ofertas.map((o) => o.envioId) }, estado: 'buscando' }).lean() : [];
  const empresas = await empresasPorId([...activos, ...deOfertas].map((e) => e.partnerId));
  const armar = (e) => { const p = empresas.get(String(e.partnerId)); return envioParaDomi(e, { partner: p, regla: p?.driverPay }); };
  return {
    pedidos: activos.map(armar),
    ofertas: ofertas.map((o) => {
      const e = deOfertas.find((x) => String(x._id) === String(o.envioId));
      if (!e) return null;
      const p = armar(e);
      return {
        id: String(o._id), venceAt: o.expiresAt,
        segundos: Math.max(0, Math.round((new Date(o.expiresAt) - Date.now()) / 1000)),
        kmAlLocal: o.distanceKm, pedido: { ...p, cliente: { ...p.cliente, telefono: null } },
      };
    }).filter(Boolean),
  };
}

/** Aplica un evento de la app (llegué, recogí, entregué...) a un envío. */
async function aplicarEvento(envio, ev) {
  if (envio.estado === 'cancelado') return { ok: false, error: 'cancelado', estado: 'cancelado', definitivo: true, partnerId: String(envio.partnerId) };
  const actual = reglas.estadoParaDomi(envio);
  const puede = reglas.puedeAplicar(ev.tipo, actual);
  const partnerId = String(envio.partnerId);
  if (puede.yaEstaba) return { ok: true, yaEstaba: true, estado: actual, partnerId };
  if (!puede.aplicar) return { ok: false, error: puede.motivo, estado: actual, definitivo: true, partnerId };
  const cerca = reglas.revisarCercania(ev.tipo, ev.ubicacion, reglas.coordenadas(envio.destino?.ubicacion));
  if (!cerca.ok) return { ok: false, error: cerca.error, metros: cerca.metros, estado: actual, definitivo: true, partnerId };

  const nota = (t) => envio.historial.push({ estado: envio.estado, nota: t, at: ev.at });
  if (ev.tipo === 'llegue_local') { envio.deliveryArrivedStoreAt = ev.at; nota('El domi llegó a recoger'); }
  if (ev.tipo === 'recogido') {
    if (!envio.deliveryArrivedStoreAt) envio.deliveryArrivedStoreAt = ev.at;
    envio.deliveryPickedAt = ev.at; nota('Recogido');
  }
  if (ev.tipo === 'llegue_cliente') { envio.deliveryArrivedCustomerAt = ev.at; nota('El domi llegó a la entrega'); }
  if (ev.tipo === 'no_entregado') {
    const motivo = reglas.MOTIVOS_NO_ENTREGA[ev.datos.motivo] || 'Otro motivo';
    envio.estado = 'no_entregado';
    envio.deliveryFailedAt = ev.at;
    envio.deliveryFailReason = ev.datos.nota ? `${motivo}: ${ev.datos.nota}` : motivo;
    nota(`No entregado — ${envio.deliveryFailReason}`);
    await envio.save();
    const { releaseDriver } = require('./orderCompletionService');
    await releaseDriver(envio.deliveryPersonId, { delivered: false });
    avisarEmpresa(partnerId, 'envio:actualizado', envio);
    return { ok: true, estado: 'no_entregado', partnerId };
  }
  if (ev.tipo === 'entregado') {
    if (envio.intentosCodigo >= 3) return { ok: false, error: 'codigo_bloqueado', estado: actual, definitivo: true, partnerId };
    if (!ev.datos.codigo || ev.datos.codigo !== envio.codigoEntrega) {
      envio.intentosCodigo += 1;
      await envio.save();
      const restantes = Math.max(0, 3 - envio.intentosCodigo);
      if (!restantes) { avisarEmpresa(partnerId, 'envio:bloqueado', envio); return { ok: false, error: 'codigo_bloqueado', estado: actual, definitivo: true, partnerId }; }
      return { ok: false, error: 'codigo_incorrecto', intentosRestantes: restantes, estado: actual, definitivo: true, partnerId };
    }
    if (!envio.deliveryPickedAt) envio.deliveryPickedAt = ev.at;
    envio.estado = 'entregado';
    envio.deliveredAt = ev.at;
    if (ev.datos.fotoUrl) envio.deliveryProofPhoto = ev.datos.fotoUrl;
    nota('Entregado');
    await envio.save();
    const { releaseDriver } = require('./orderCompletionService');
    await releaseDriver(envio.deliveryPersonId, { delivered: true });
    avisarEmpresa(partnerId, 'envio:actualizado', envio);
    return { ok: true, estado: 'entregado', partnerId };
  }
  await envio.save();
  avisarEmpresa(partnerId, 'envio:actualizado', envio);
  return { ok: true, estado: reglas.estadoParaDomi(envio), partnerId };
}

/* ═══════════════ Plata: ganancias y cuadre de los envíos ═══════════════ */

async function liquidados(driverIds) {
  const ids = await DomiLiquidacion.distinct('orderIds', { driverId: { $in: driverIds }, partnerId: { $exists: true } });
  return new Set(ids.map(String));
}

/** Envíos entregados sin liquidar de estos domis, con su efectivo y su ganancia. */
async function pendientesEnvios(driverIds, filtro = {}) {
  const desde = new Date(Date.now() - 60 * 86400000);
  const [lista, ya] = await Promise.all([
    Envio.find({ deliveryPersonId: { $in: driverIds }, estado: 'entregado', deliveredAt: { $gte: desde }, ...filtro }).lean(),
    liquidados(driverIds),
  ]);
  const sin = lista.filter((e) => !ya.has(String(e._id)));
  const empresas = await empresasPorId(sin.map((e) => e.partnerId));
  return sin.map((e) => {
    const p = empresas.get(String(e.partnerId));
    return {
      orderId: String(e._id), numero: e.numero, partnerId: String(e.partnerId), businessId: `empresa:${e.partnerId}`,
      driverId: String(e.deliveryPersonId), negocio: p?.name || 'Empresa', cliente: e.destino?.nombre || '',
      entregadoAt: e.deliveredAt,
      efectivo: (e.valorACobrar || 0) + (e.pagaEnvio === 'destinatario' ? e.precio : 0),
      ganancia: reglas.gananciaDomi({ deliveryFee: e.precio }, p?.driverPay),
      metodoPago: 'envio',
    };
  });
}

async function entregadosEntre(driverIds, desde, hasta) {
  const lista = await Envio.find({ deliveryPersonId: { $in: driverIds }, estado: 'entregado', deliveredAt: { $gte: desde, ...(hasta ? { $lte: hasta } : {}) } }).lean();
  const empresas = await empresasPorId(lista.map((e) => e.partnerId));
  return lista.map((e) => ({ deliveredAt: e.deliveredAt, ganancia: reglas.gananciaDomi({ deliveryFee: e.precio }, empresas.get(String(e.partnerId))?.driverPay) }));
}

/* ═══════════════ Portal de la empresa ═══════════════ */

async function listarEnviosEmpresa(partner, { estado, limite = 100 } = {}) {
  const f = { partnerId: partner._id };
  if (estado === 'activos') f.estado = { $in: ['buscando', 'asignado'] };
  else if (estado) f.estado = estado;
  const lista = await Envio.find(f).sort({ createdAt: -1 }).limit(Math.min(300, limite)).lean();
  const [clientes, domis] = await Promise.all([
    ClienteEmpresa.find({ _id: { $in: lista.map((e) => e.clienteId) } }).select('nombre negocio').lean(),
    DeliveryPerson.find({ _id: { $in: lista.map((e) => e.deliveryPersonId).filter(Boolean) } }).select('name phone').lean(),
  ]);
  const c = new Map(clientes.map((x) => [String(x._id), x]));
  const d = new Map(domis.map((x) => [String(x._id), x]));
  return lista.map((e) => ({
    ...envioParaCliente(e),
    cliente: { nombre: c.get(String(e.clienteId))?.negocio || c.get(String(e.clienteId))?.nombre || '—' },
    domi: e.deliveryPersonId ? { id: String(e.deliveryPersonId), nombre: d.get(String(e.deliveryPersonId))?.name || '—' } : null,
  }));
}

async function cuadreEmpresa(partner) {
  const domis = await DeliveryPerson.find({ partnerId: partner._id }).select('name phone photo isOnline').lean();
  const lista = await pendientesEnvios(domis.map((d) => d._id), { partnerId: partner._id });
  return domis.map((d) => {
    const suyas = lista.filter((e) => e.driverId === String(d._id));
    return { driverId: String(d._id), nombre: d.name, telefono: d.phone, foto: d.photo || null, enLinea: !!d.isOnline, ...reglas.cuadrar(suyas), detalle: suyas };
  }).sort((a, b) => b.entregas - a.entregas);
}

async function liquidarEmpresa(partner, { driverId, nota }, quien) {
  if (!mongoose.isValidObjectId(driverId)) throw new ErrorEnvio(400, 'Domiciliario inválido.');
  const d = await DeliveryPerson.findOne({ _id: driverId, partnerId: partner._id });
  if (!d) throw new ErrorEnvio(404, 'Ese domiciliario no es de tu empresa.');
  const lista = await pendientesEnvios([d._id], { partnerId: partner._id });
  if (!lista.length) throw new ErrorEnvio(409, 'No hay envíos pendientes por liquidar.');
  const c = reglas.cuadrar(lista);
  const liq = await DomiLiquidacion.create({
    partnerId: partner._id, driverId: d._id, orderIds: lista.map((e) => e.orderId),
    entregas: c.entregas, efectivo: c.efectivo, ganancias: c.ganancias, neto: c.neto,
    nota: String(nota || '').slice(0, 200), creadoPor: quien || partner.name,
  });
  return liq.toObject();
}

/* ═══════════════ Seguimiento público (para quien recibe) ═══════════════ */

async function seguimientoPublico(token) {
  if (!/^[A-Za-z0-9_-]{8,30}$/.test(String(token || ''))) throw new ErrorEnvio(404, 'Enlace no válido.');
  const e = await Envio.findOne({ seguimiento: token }).lean();
  if (!e) throw new ErrorEnvio(404, 'Enlace no válido.');
  const [p, d] = await Promise.all([
    DeliveryPartner.findById(e.partnerId).select('name logo slug landing phone').lean(),
    e.deliveryPersonId ? DeliveryPerson.findById(e.deliveryPersonId).select('name photo independiente.vehiculo lastLocation lastSeenAt rating').lean() : null,
  ]);
  const enRuta = !!e.deliveryPickedAt && !e.deliveredAt && !e.deliveryFailedAt;
  const fresca = d?.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 3 * 60000;
  return {
    numero: e.numero,
    etapa: etapa(e),
    empresa: p ? { nombre: p.name, logo: p.logo || null, slug: p.slug || null, color: p.landing?.color || null, telefono: p.landing?.whatsapp || p.phone || null } : null,
    origen: { direccion: e.origen?.direccion, nombre: e.origen?.nombre },
    destino: { direccion: e.destino?.direccion, nombre: e.destino?.nombre, ubicacion: punto(e.destino?.ubicacion) },
    valorACobrar: e.valorACobrar + (e.pagaEnvio === 'destinatario' ? e.precio : 0),
    // Quien recibe se lo dicta al domi: se muestra mientras no se haya entregado
    codigoEntrega: ['entregado', 'cancelado'].includes(e.estado) ? null : e.codigoEntrega,
    domi: d ? { nombre: String(d.name || '').split(' ')[0], foto: d.photo || null, vehiculo: d.independiente?.vehiculo || null, calificacion: d.rating ?? 5 } : null,
    ubicacionDomi: enRuta && fresca && d?.lastLocation?.coordinates ? { lat: d.lastLocation.coordinates[1], lng: d.lastLocation.coordinates[0] } : null,
    marcas: marcas(e),
    motivoFalla: e.deliveryFailReason || null,
  };
}

module.exports = {
  ErrorEnvio,
  crearCliente, actualizarCliente, listarClientes, entrarCliente, autenticarCliente,
  empresaPorSlug, paginaPublica, guardarConfigEmpresa, configEmpresa,
  cotizar, crearEnvio, envioDeCliente, listarEnviosCliente, cancelar, envioParaCliente,
  despachar, aceptarOferta, rechazarOferta, expirarOfertas, asignarManual,
  paraLaApp, aplicarEvento, pendientesEnvios, entregadosEntre,
  listarEnviosEmpresa, cuadreEmpresa, liquidarEmpresa, seguimientoPublico,
  hash,
};
