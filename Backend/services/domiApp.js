/**
 * La app del domiciliario (v2): lo que pasa en la base.
 *
 * La persona entra con su celular y su PIN y ve TODO lo suyo junto: los
 * pedidos de cada negocio que la tiene registrada y los de la empresa o red a
 * la que pertenezca. Las reglas de plata y de orden están en utils/domiApp.js;
 * aquí solo se leen y se escriben las colecciones.
 *
 * Convive con las rutas viejas (Routes/deliveryPublic.js): la app anterior
 * sigue funcionando mientras la nueva la reemplaza.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const reglas = require('../utils/domiApp');
const seguridad = require('../utils/seguridadDomi');
const { hashPin, pinCorrecto } = require('../utils/pinDomi');

const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliveryPartner = require('../Models/DeliveryPartner');
const DeliveryOffer = require('../Models/DeliveryOffer');
const BusinessConfig = require('../Models/BusinessConfig');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const DomiCuenta = require('../Models/DomiCuenta');
const DomiEvento = require('../Models/DomiEvento');
const DomiLiquidacion = require('../Models/DomiLiquidacion');

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 15;
const DIAS_CUADRE = 60;

class ErrorDomi extends Error {
  constructor(status, mensaje, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const tel10 = (t) => reglas.variantesTelefono(t).find((x) => x.length === 10) || reglas.variantesTelefono(t)[0] || '';

/* ═══════════════════════ Sesión ═══════════════════════ */

function firmarAcceso(telefono) {
  return jwt.sign({ v: 2, tel: telefono }, process.env.JWT_SECRET, { expiresIn: '12h' });
}
function firmarRenovacion(telefono) {
  return jwt.sign({ v: 2, tel: telefono, tipo: 'renovar', n: crypto.randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '60d' });
}

/** Los registros activos de esta persona, en todos los negocios y empresas. */
async function afiliaciones(telefono) {
  const variantes = reglas.variantesTelefono(telefono);
  if (!variantes.length) return [];
  return DeliveryPerson.find({ phone: { $in: variantes }, active: true });
}

async function entrar({ telefono, pin, clave, dispositivo }) {
  const tel = tel10(telefono);
  if (!tel || tel.length < 7) throw new ErrorDomi(400, 'Escribe tu número de celular.');
  if (!pin && !clave) throw new ErrorDomi(400, 'Escribe tu PIN.');

  let cuenta = await DomiCuenta.findOne({ telefono: tel });
  if (cuenta?.bloqueadaHasta && cuenta.bloqueadaHasta > new Date()) {
    const min = Math.ceil((cuenta.bloqueadaHasta - Date.now()) / 60000);
    throw new ErrorDomi(429, `Demasiados intentos. Espera ${min} min o pídele al negocio que te cambie el PIN.`, 'bloqueada');
  }

  const docs = await afiliaciones(tel);
  // Un solo PIN por persona; los PIN viejos de cada negocio solo valen la primera vez
  // Sin ningún perfil activo no hay a qué entrar (p. ej. un registro aún en revisión)
  let valido = docs.length > 0 && !!pin && pinCorrecto(pin, cuenta, docs);
  if (!valido && clave && docs.length) {
    for (const d of docs) {
      if (d.passwordHash && await d.verifyPassword(String(clave))) { valido = true; break; }
    }
  }

  if (!cuenta) cuenta = new DomiCuenta({ telefono: tel });
  if (valido && pin && !cuenta.pinHash) cuenta.pinHash = hashPin(pin);

  /* Independiente de la Red MenuBy que todavía no puede trabajar: con su PIN
     correcto se le dice en qué va su registro, en vez de "PIN incorrecto". */
  if (!valido) {
    const inactivos = await DeliveryPerson.find({ phone: { $in: reglas.variantesTelefono(tel) }, active: false, 'independiente.estado': { $in: ['pendiente', 'rechazado', 'suspendido'] } });
    const suyo = inactivos.find((d) => pin && pinCorrecto(pin, cuenta, [d]));
    if (suyo) {
      const e = suyo.independiente.estado;
      const mensaje = {
        pendiente: 'Tu registro está en revisión. Te avisamos apenas lo aprueben.',
        rechazado: `Tu registro necesita correcciones: ${suyo.independiente.motivo || 'revisa tus documentos'}.`,
        suspendido: `Tu cuenta está suspendida: ${suyo.independiente.motivo || 'escríbenos para revisarla'}.`,
      }[e];
      throw new ErrorDomi(403, mensaje, `registro_${e}`);
    }
  }
  if (!valido) {
    cuenta.fallos = (cuenta.fallos || 0) + 1;
    if (cuenta.fallos >= MAX_FALLOS) {
      cuenta.fallos = 0;
      cuenta.bloqueadaHasta = new Date(Date.now() + BLOQUEO_MIN * 60000);
    }
    await cuenta.save();
    // Mismo mensaje exista o no el número: no se revela quién es domi.
    throw new ErrorDomi(401, 'Celular o PIN incorrectos.', 'credenciales');
  }

  // App modificada o que no es la oficial: no entra, aunque el PIN esté bien
  const integridad = revisarIntegridad(cuenta, dispositivo?.integridad);
  if (integridad.alterada) {
    await cuenta.save();
    throw new ErrorDomi(403, MENSAJE_APP_ALTERADA, 'app_alterada');
  }

  const renovacion = firmarRenovacion(tel);
  cuenta.fallos = 0;
  cuenta.bloqueadaHasta = null;
  cuenta.refreshHash = hash(renovacion);
  cuenta.ultimoIngreso = new Date();
  if (dispositivo) cuenta.dispositivo = { plataforma: String(dispositivo.plataforma || '').slice(0, 20), version: String(dispositivo.version || '').slice(0, 20) };
  await cuenta.save();
  return { token: firmarAcceso(tel), renovacion };
}

const MENSAJE_APP_ALTERADA = 'Esta copia de la app fue modificada o no es la oficial. Instala MenuBy Go desde la tienda.';

/** Anota en la cuenta lo que reportó la app y dice si hay que frenarla. */
function revisarIntegridad(cuenta, reporte) {
  const r = seguridad.evaluarIntegridad(reporte);
  cuenta.set('seguridad.alterada', r.alterada);
  cuenta.set('seguridad.motivos', r.motivos);
  cuenta.set('seguridad.avisos', r.avisos);
  cuenta.set('seguridad.revisadaAt', new Date());
  if (r.alterada) logger.warn('App del domi alterada', { telefono: cuenta.telefono, motivos: r.motivos });
  return r;
}

async function renovar(renovacion) {
  let dec;
  try { dec = jwt.verify(String(renovacion || ''), process.env.JWT_SECRET); } catch { dec = null; }
  if (!dec || dec.v !== 2 || dec.tipo !== 'renovar') throw new ErrorDomi(401, 'Tu sesión venció. Entra otra vez.');
  const cuenta = await DomiCuenta.findOne({ telefono: dec.tel });
  if (!cuenta || cuenta.refreshHash !== hash(renovacion)) throw new ErrorDomi(401, 'Tu sesión se cerró. Entra otra vez.');
  const docs = await afiliaciones(dec.tel);
  if (!docs.length) throw new ErrorDomi(401, 'Ya no estás activo en ningún negocio.');
  const nueva = firmarRenovacion(dec.tel);
  cuenta.refreshHash = hash(nueva);
  await cuenta.save();
  return { token: firmarAcceso(dec.tel), renovacion: nueva };
}

async function salir(telefono) {
  await DomiCuenta.updateOne({ telefono }, { $set: { refreshHash: null } });
  const docs = await afiliaciones(telefono);
  await DeliveryPerson.updateMany({ _id: { $in: docs.map((d) => d._id) } }, { $set: { isOnline: false, fcmToken: null } });
}

/** Middleware: token v2 → req.domi = { telefono, docs, ids } (recalcula afiliaciones siempre). */
async function autenticar(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    let dec;
    try { dec = jwt.verify(t, process.env.JWT_SECRET); } catch { dec = null; }
    if (!dec || dec.v !== 2 || !dec.tel || dec.tipo) return res.status(401).json({ message: 'Tu sesión venció.' });
    const docs = await afiliaciones(dec.tel);
    if (!docs.length) return res.status(401).json({ message: 'Ya no estás activo en ningún negocio.' });
    req.domi = { telefono: dec.tel, docs, ids: docs.map((d) => String(d._id)) };
    next();
  } catch (e) {
    next(e);
  }
}

/* ═══════════════════════ Lectura ═══════════════════════ */

const CAMPOS_NEGOCIO = 'businessName slug logo phone phoneCountryCode address location theme requireDeliveryCode deliverySettings';

async function negociosPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  const lista = await BusinessConfig.find({ _id: { $in: unicos } }).select(CAMPOS_NEGOCIO).lean();
  return new Map(lista.map((b) => [String(b._id), b]));
}

async function empresasPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  if (!unicos.length) return new Map();
  const lista = await DeliveryPartner.find({ _id: { $in: unicos } }).select('name logo phone autoDispatch maxActivePerDriver driverPay esRedMenuby').lean();
  return new Map(lista.map((p) => [String(p._id), p]));
}

/** Lo que gana el domi: la tarifa congelada de la Red si la hay, si no la regla de pago. */
function gananciaDe(o, regla) {
  const congelada = Number(o?.tarifaRed?.pagoDomi);
  return Number.isFinite(congelada) && congelada > 0 ? Math.round(congelada) : reglas.gananciaDomi(o, regla);
}

function reglaPago(doc, negocio, empresas) {
  if (doc?.partnerId) return empresas.get(String(doc.partnerId))?.driverPay;
  return negocio?.deliverySettings?.driverPay;
}

function negocioParaDomi(b) {
  if (!b) return null;
  return {
    id: String(b._id),
    nombre: b.businessName,
    logo: b.logo || null,
    telefono: `${b.phoneCountryCode || ''}${b.phone || ''}`.replace(/[^\d+]/g, '') || null,
    direccion: b.location?.address || b.address || '',
    ubicacion: reglas.coordenadas(b.location?.coordinates),
    color: b.theme?.buttonColor || null,
    fotos: (b.location?.fotos || []).filter(Boolean).slice(0, MAX_FOTOS_LOCAL),
  };
}

/** Lo que el domi necesita saber de un pedido. Nunca el código de entrega. */
function pedidoParaDomi(o, { negocio, regla }) {
  const destino = reglas.coordenadas(o.deliveryCoordinates) || reglas.coordenadas(o.deliveryZoneInfo?.coordinates);
  const origen = negocio?.ubicacion || null;
  return {
    id: String(o._id),
    numero: o.orderNumber,
    driverId: o.deliveryPersonId ? String(o.deliveryPersonId) : null,
    estado: reglas.estadoParaDomi(o),
    negocio,
    cliente: {
      nombre: o.customerName || 'Cliente',
      telefono: String(o.phone || o.customerPhone || '').replace(/[^\d+]/g, '') || null,
      direccion: o.address || '',
      notas: o.customerNotes || '',
      ubicacion: destino,
    },
    productos: (o.items || []).map((i) => ({
      nombre: i.name,
      cantidad: i.quantity || 1,
      notas: i.notes || i.specialInstructions || '',
      extras: (i.selectedToppings || []).map((t) => t?.name || t?.optionName || '').filter(Boolean),
    })),
    total: Math.round(o.finalAmount ?? o.totalAmount ?? 0),
    domicilio: Math.round(o.deliveryFee || 0),
    metodoPago: o.paymentMethod || null,
    efectivo: reglas.efectivoACobrar(o),
    ganancia: gananciaDe(o, regla),
    desgloseGanancia: o.tarifaRed?.desglose || null,
    distanciaKm: origen && destino ? Math.round(reglas.distanciaKm(origen, destino) * 10) / 10 : null,
    pideCodigoEntrega: negocio?._pideCodigo !== false,
    pideCodigoRecogida: !!negocio?._pideRecogida,
    asignadoAt: o.deliveryAssignedAt || null,
    // Lo aceptó solo (aceptación automática)
    automatico: !!o.autoAceptado?.at && String(o.autoAceptado.driverId || '') === String(o.deliveryPersonId || ''),
    marcas: {
      llegoLocal: o.deliveryArrivedStoreAt || null,
      recogido: o.deliveryPickedAt || null,
      llegoCliente: o.deliveryArrivedCustomerAt || null,
      entregado: o.deliveredAt || null,
    },
    listoEnLocal: ['ready'].includes(o.status),
  };
}

function negocioConReglas(b) {
  const n = negocioParaDomi(b);
  if (!n) return null;
  // Van ocultas en el objeto para armar el pedido; no salen tal cual.
  Object.defineProperty(n, '_pideCodigo', { value: b.requireDeliveryCode !== false, enumerable: false });
  Object.defineProperty(n, '_pideRecogida', { value: !!b.deliverySettings?.requirePickupCode, enumerable: false });
  return n;
}

const ESTADOS_ACTIVOS = { $nin: ['cancelled', 'delivered', 'completed'] };

async function pedidosActivos(ids) {
  return Order.find({
    deliveryPersonId: { $in: ids },
    orderType: 'delivery',
    status: ESTADOS_ACTIVOS,
    deliveredAt: null,
    deliveryFailedAt: null,
  }).sort({ deliveryAssignedAt: 1 }).lean();
}

async function estado(domi) {
  const { docs, ids } = domi;
  const [pedidos, ofertasRaw, cuentaDoc] = await Promise.all([
    pedidosActivos(ids),
    DeliveryOffer.find({ driverId: { $in: ids }, envioId: { $exists: false }, state: 'pending', expiresAt: { $gt: new Date() } }).sort({ offeredAt: -1 }).lean(),
    DomiCuenta.findOne({ telefono: domi.telefono }),
  ]);
  // La app recibió sus ofertas: desde aquí, dejarlas vencer sí cuenta (ver desempenoDomi)
  await DeliveryOffer.updateMany(
    { driverId: { $in: ids }, state: 'pending', vistaAt: null, expiresAt: { $gt: new Date() } },
    { $set: { vistaAt: new Date() } },
  );
  require('./desempenoDomi').recalcularSiToca(cuentaDoc, docs);
  // Envíos de empresas de reparto (sus clientes propios): se ven igual que un pedido
  const envios = await require('./envios').paraLaApp(ids);
  const pedidosOferta = ofertasRaw.length
    ? await Order.find({ _id: { $in: ofertasRaw.map((o) => o.orderId) } }).lean()
    : [];

  const bizIds = [
    ...docs.map((d) => d.businessId), ...pedidos.map((p) => p.businessId), ...pedidosOferta.map((p) => p.businessId),
  ];
  const [negocios, empresas] = await Promise.all([negociosPorId(bizIds), empresasPorId(docs.map((d) => d.partnerId))]);
  const docPorId = new Map(docs.map((d) => [String(d._id), d]));

  const armar = (o) => {
    const b = negocios.get(String(o.businessId));
    const doc = docPorId.get(String(o.deliveryPersonId)) || docs[0];
    return pedidoParaDomi(o, { negocio: negocioConReglas(b), regla: reglaPago(doc, b, empresas) });
  };

  const ofertas = ofertasRaw.map((of) => {
    const o = pedidosOferta.find((p) => String(p._id) === String(of.orderId));
    if (!o) return null;
    const b = negocios.get(String(o.businessId));
    const doc = docPorId.get(String(of.driverId));
    const p = pedidoParaDomi(o, { negocio: negocioConReglas(b), regla: reglaPago(doc, b, empresas) });
    if (of.tarifa?.pagoDomi) {
      p.ganancia = of.tarifa.pagoDomi;
      p.desgloseGanancia = of.tarifa.desglose || null;
    }
    const yo = doc?.lastLocation?.coordinates ? { lat: doc.lastLocation.coordinates[1], lng: doc.lastLocation.coordinates[0] } : null;
    const km = yo && p.negocio?.ubicacion ? reglas.distanciaKm(yo, p.negocio.ubicacion) : null;
    return {
      id: String(of._id),
      venceAt: of.expiresAt,
      segundos: Math.max(0, Math.round((new Date(of.expiresAt) - Date.now()) / 1000)),
      kmAlLocal: km != null ? Math.round(km * 10) / 10 : null,
      pedido: { ...p, cliente: { ...p.cliente, telefono: null, nombre: (p.cliente.nombre || '').split(' ')[0] } },
    };
  }).filter(Boolean);

  const [hoy, cuadres] = await Promise.all([resumenHoy(domi, negocios, empresas), cuadre(domi)]);

  // Nombre y foto: los verificados en el registro (selfie) mandan sobre perfiles viejos
  const verificado = docs.find((d) => d.independiente?.estado === 'aprobado');
  const principal = verificado || docs.find((d) => d.photo) || docs[0];
  return {
    cuenta: {
      nombre: principal.name,
      telefono: domi.telefono,
      foto: principal.photo || docs.find((d) => d.photo)?.photo || null,
      calificacion: Math.round(Math.min(...docs.map((d) => d.rating ?? 5)) * 10) / 10,
      enLinea: docs.some((d) => d.isOnline),
      totalEntregas: docs.reduce((s, d) => s + (d.totalDeliveries || 0), 0),
      nivel: (() => {
        const n = require('../utils/nivelesDomi').nivelPorId(cuentaDoc?.nivel?.actual || 0);
        return { id: n.id, nombre: n.nombre };
      })(),
      autoAcepta: !!cuentaDoc?.autoAcepta?.activo,
    },
    afiliaciones: docs.map((d) => {
      if (d.partnerId) {
        const e = empresas.get(String(d.partnerId));
        if (e?.esRedMenuby) {
          return { id: String(d._id), tipo: 'red', nombre: 'Red MenuBy', detalle: 'Independiente', logo: null, maxActivos: e.maxActivePerDriver || 2, negocios: (d.negociosAsignados || []).length };
        }
        return { id: String(d._id), tipo: 'empresa', nombre: e?.name || 'Empresa', logo: e?.logo || null, maxActivos: e?.maxActivePerDriver || 2 };
      }
      const b = negocios.get(String(d.businessId));
      return { id: String(d._id), tipo: 'negocio', nombre: b?.businessName || 'Negocio', logo: b?.logo || null, maxActivos: b?.deliverySettings?.maxActivePerDriver || 1 };
    }),
    pedidos: [...pedidos.map(armar), ...envios.pedidos],
    ofertas: [...ofertas, ...envios.ofertas],
    hoy,
    efectivoEnMano: cuadres.reduce((s, c) => s + c.efectivo, 0),
    cuadres,
    servidorAt: new Date(),
  };
}

/* ═══════════════════════ Plata ═══════════════════════ */

const CAMPOS_ENTREGA = 'orderNumber businessId deliveryPersonId deliveredAt finalAmount totalAmount deliveryFee paymentMethod customerName address tarifaRed';

async function entregadas(filtro) {
  const [a, b] = await Promise.all([
    Order.find({ ...filtro, status: 'delivered' }).select(CAMPOS_ENTREGA).lean(),
    CompletedOrder.find(filtro).select(CAMPOS_ENTREGA).lean(),
  ]);
  const vistos = new Set();
  return [...a, ...b].filter((o) => {
    const k = String(o._id);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

function inicioDiaBogota(fecha = new Date()) {
  const dia = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return new Date(`${dia}T00:00:00-05:00`);
}

async function resumenHoy(domi, negocios, empresas) {
  const lista = await entregadas({ deliveryPersonId: { $in: domi.ids }, deliveredAt: { $gte: inicioDiaBogota() } });
  const docPorId = new Map(domi.docs.map((d) => [String(d._id), d]));
  let ganancias = 0;
  for (const o of lista) {
    ganancias += gananciaDe(o, reglaPago(docPorId.get(String(o.deliveryPersonId)), negocios.get(String(o.businessId)), empresas));
  }
  const envios = await require('./envios').entregadosEntre(domi.ids, inicioDiaBogota());
  for (const e of envios) ganancias += e.ganancia;
  return { entregas: lista.length + envios.length, ganancias };
}

async function liquidadas(driverIds) {
  const ids = await DomiLiquidacion.distinct('orderIds', { driverId: { $in: driverIds } });
  return new Set(ids.map(String));
}

/** Entregas sin liquidar de estos domis, con su efectivo y su ganancia. */
async function pendientes(driverDocs, filtroExtra = {}) {
  const ids = driverDocs.map((d) => d._id);
  const desde = new Date(Date.now() - DIAS_CUADRE * 86400000);
  const [lista, yaLiquidadas] = await Promise.all([
    entregadas({ deliveryPersonId: { $in: ids }, deliveredAt: { $gte: desde }, ...filtroExtra }),
    liquidadas(ids),
  ]);
  const sinLiquidar = lista.filter((o) => !yaLiquidadas.has(String(o._id)));
  const [negocios, empresas] = await Promise.all([
    negociosPorId(sinLiquidar.map((o) => o.businessId)),
    empresasPorId(driverDocs.map((d) => d.partnerId)),
  ]);
  const docPorId = new Map(driverDocs.map((d) => [String(d._id), d]));
  return sinLiquidar.map((o) => ({
    orderId: String(o._id),
    numero: o.orderNumber,
    businessId: String(o.businessId),
    driverId: String(o.deliveryPersonId),
    negocio: negocios.get(String(o.businessId))?.businessName || 'Negocio',
    cliente: o.customerName || '',
    entregadoAt: o.deliveredAt,
    efectivo: reglas.efectivoACobrar(o),
    ganancia: gananciaDe(o, reglaPago(docPorId.get(String(o.deliveryPersonId)), negocios.get(String(o.businessId)), empresas)),
    metodoPago: o.paymentMethod || null,
  }));
}

/** El cuadre del domi, separado por negocio (cada negocio liquida lo suyo). */
async function cuadre(domi) {
  const lista = [...await pendientes(domi.docs), ...await require('./envios').pendientesEnvios(domi.ids)];
  const porNegocio = new Map();
  for (const e of lista) {
    if (!porNegocio.has(e.businessId)) porNegocio.set(e.businessId, { businessId: e.businessId, negocio: e.negocio, entregasLista: [] });
    porNegocio.get(e.businessId).entregasLista.push(e);
  }
  return [...porNegocio.values()].map((g) => ({
    businessId: g.businessId,
    negocio: g.negocio,
    ...reglas.cuadrar(g.entregasLista),
    detalle: g.entregasLista.sort((a, b) => new Date(b.entregadoAt) - new Date(a.entregadoAt)),
  }));
}

/** Ganancias por día en un rango (máximo 62 días). */
async function ganancias(domi, { desde, hasta } = {}) {
  let fin = hasta ? new Date(hasta) : new Date();
  let ini = desde ? new Date(desde) : new Date(inicioDiaBogota().getTime() - 6 * 86400000);
  if (Number.isNaN(fin.getTime())) fin = new Date();
  if (Number.isNaN(ini.getTime()) || fin - ini > 62 * 86400000) ini = new Date(fin.getTime() - 6 * 86400000);
  const lista = await entregadas({ deliveryPersonId: { $in: domi.ids }, deliveredAt: { $gte: ini, $lte: fin } });
  const [negocios, empresas] = await Promise.all([negociosPorId(lista.map((o) => o.businessId)), empresasPorId(domi.docs.map((d) => d.partnerId))]);
  const docPorId = new Map(domi.docs.map((d) => [String(d._id), d]));
  const dias = new Map();
  let total = 0;
  for (const o of lista) {
    const g = gananciaDe(o, reglaPago(docPorId.get(String(o.deliveryPersonId)), negocios.get(String(o.businessId)), empresas));
    total += g;
    const dia = new Date(o.deliveredAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const d = dias.get(dia) || { dia, entregas: 0, ganancias: 0 };
    d.entregas += 1;
    d.ganancias += g;
    dias.set(dia, d);
  }
  for (const e of await require('./envios').entregadosEntre(domi.ids, ini, fin)) {
    total += e.ganancia;
    const dia = new Date(e.deliveredAt).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const d = dias.get(dia) || { dia, entregas: 0, ganancias: 0 };
    d.entregas += 1;
    d.ganancias += e.ganancia;
    dias.set(dia, d);
  }
  const cuantas = [...dias.values()].reduce((s, d) => s + d.entregas, 0);
  return {
    desde: ini, hasta: fin, entregas: cuantas, ganancias: total,
    promedio: cuantas ? Math.round(total / cuantas) : 0,
    dias: [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

/* ═══════════════════════ Disponibilidad y ubicación ═══════════════════════ */

function punto(lat, lng) {
  const c = reglas.coordenadas({ lat, lng });
  return c ? { type: 'Point', coordinates: [c.lng, c.lat] } : null;
}

async function ponerDisponible(domi, { enLinea, lat, lng, integridad }) {
  // Para recibir pedidos la app se revisa otra vez (pudo cambiar desde que entró)
  if (enLinea) {
    const cuenta = await DomiCuenta.findOne({ telefono: domi.telefono });
    if (cuenta) {
      const r = revisarIntegridad(cuenta, integridad);
      await cuenta.save();
      if (r.alterada) throw new ErrorDomi(403, MENSAJE_APP_ALTERADA, 'app_alterada');
    }
  }
  const set = { isOnline: !!enLinea, lastSeenAt: new Date() };
  const p = punto(lat, lng);
  if (p) set.lastLocation = p;
  await DeliveryPerson.updateMany({ _id: { $in: domi.ids } }, { $set: set });
  if (enLinea) reofrecerSinDomi(domi).catch((e) => logger.warn('reofrecerSinDomi', { error: e.message }));
  return { enLinea: !!enLinea };
}

/**
 * Al conectarse un domi, los pedidos que se quedaron "sin domiciliario" en sus
 * negocios vuelven a ofrecerse: si no, esperan a que alguien los reasigne a mano.
 */
async function reofrecerSinDomi(domi) {
  const Delivery = require('../Models/Delivery');
  const bizIds = domi.docs.filter((d) => d.businessId).map((d) => d.businessId);
  if (!bizIds.length) return;
  const esperando = await Delivery.find({ businessId: { $in: bizIds }, state: 'no_courier' }).sort({ createdAt: -1 }).limit(5).lean();
  if (!esperando.length) return;
  const assignment = require('./assignmentService');
  for (const d of esperando) {
    const order = await Order.findById(d.orderId);
    if (!order || order.deliveryPersonId || ['cancelled', 'delivered', 'completed'].includes(order.status)) continue;
    const business = await BusinessConfig.findById(order.businessId).lean();
    if (business) await assignment.pickAndOffer(order, business);
  }
}

/**
 * Puntos de GPS (en vivo o acumulados sin señal). El último manda para la
 * asignación; todos se retransmiten al seguimiento de los pedidos en ruta.
 */
/** El último punto bueno sirve de ancla para pillar saltos solo si es reciente. */
const ANCLA_MAX_MS = 30 * 60 * 1000;

async function registrarUbicacion(domi, puntos = []) {
  const recibidos = (Array.isArray(puntos) ? puntos : [])
    .slice(-200)
    .map((p) => ({ ...reglas.coordenadas(p), at: p.at ? new Date(p.at) : new Date(), rumbo: Number(p.rumbo) || null, velocidad: Number(p.velocidad) || null, simulada: p.simulada === true }))
    .filter((p) => p.lat != null && !Number.isNaN(p.at.getTime()))
    .sort((a, b) => a.at - b.at);
  if (!recibidos.length) return { recibidos: 0 };

  // GPS falso: lo que Android marca como simulado y los saltos imposibles no cuentan
  const cuenta = await DomiCuenta.findOne({ telefono: domi.telefono });
  const ancla = cuenta?.seguridad?.ultimoPunto;
  const anclaVigente = ancla?.at && Date.now() - new Date(ancla.at) < ANCLA_MAX_MS ? ancla : null;
  const { buenos: validos, simulados, saltos } = seguridad.filtrarPuntos(recibidos, anclaVigente);
  if (cuenta && (simulados || saltos)) {
    cuenta.set('seguridad.simuladas', (cuenta.seguridad?.simuladas || 0) + simulados);
    cuenta.set('seguridad.saltos', (cuenta.seguridad?.saltos || 0) + saltos);
    cuenta.set('seguridad.ultimaTrampaAt', new Date());
    logger.warn('GPS falso del domi', { telefono: domi.telefono, simulados, saltos });
  }
  if (cuenta && validos.length) {
    const u = validos[validos.length - 1];
    cuenta.set('seguridad.ultimoPunto', { lat: u.lat, lng: u.lng, at: u.at });
  }
  if (cuenta && (simulados || saltos || validos.length)) await cuenta.save();
  if (simulados) {
    // Falta (una por día como mucho). Los saltos solos no: pueden ser fallas del GPS.
    const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    require('./desempenoDomi').registrarFalta({ telefono: domi.telefono, driverId: domi.ids[0], tipo: 'gps_falso', refId: `gps:${dia}` }).catch(() => {});
    // Con GPS falso no se reciben pedidos: se desconecta
    await DeliveryPerson.updateMany({ _id: { $in: domi.ids } }, { $set: { isOnline: false } });
    return { recibidos: validos.length, simulada: true };
  }
  if (!validos.length) return { recibidos: 0, descartados: saltos };
  const ultimo = validos[validos.length - 1];
  await DeliveryPerson.updateMany({ _id: { $in: domi.ids } }, { $set: { lastSeenAt: new Date(), lastLocation: punto(ultimo.lat, ultimo.lng) } });

  const enRuta = await Order.find({
    deliveryPersonId: { $in: domi.ids }, deliveredAt: null, deliveryFailedAt: null, status: ESTADOS_ACTIVOS,
  }).select('_id businessId deliveryPersonId deliveryPickedAt').lean();
  if (enRuta.length) {
    const socketService = require('./socketService');
    const Delivery = require('../Models/Delivery');
    for (const o of enRuta) {
      const dato = { lat: ultimo.lat, lng: ultimo.lng, orderId: String(o._id), timestamp: ultimo.at.getTime(), rumbo: ultimo.rumbo };
      // El cliente solo ve al domi cuando ya lleva su pedido
      if (o.deliveryPickedAt) socketService.emitToOrder(String(o._id), 'domi:location', dato);
      socketService.emitToBusiness(String(o.businessId), 'domi:location', { ...dato, deliveryPersonId: String(o.deliveryPersonId) });
    }
    await Delivery.updateMany({ orderId: { $in: enRuta.map((o) => o._id) } }, { $set: { lastLocation: { lat: ultimo.lat, lon: ultimo.lng, at: ultimo.at } } });
  }
  return { recibidos: validos.length, ...(saltos ? { descartados: saltos } : {}) };
}

async function guardarPush(domi, fcmToken, llamadas = false) {
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 20 || fcmToken.length > 400) {
    throw new ErrorDomi(400, 'Token de notificaciones inválido.');
  }
  // `llamadas`: la app trae el aviso nativo de llamada (las versiones viejas no)
  await DeliveryPerson.updateMany({ _id: { $in: domi.ids } }, { $set: { fcmToken, fcmLlamadas: llamadas === true } });
}

/* ═══════════════════════ Ofertas ═══════════════════════ */

async function responderOferta(domi, ofertaId, acepta) {
  if (!mongoose.isValidObjectId(ofertaId)) throw new ErrorDomi(404, 'Esa oferta ya no está.');
  const offer = await DeliveryOffer.findOne({ _id: ofertaId, driverId: { $in: domi.ids } });
  if (!offer) throw new ErrorDomi(404, 'Esa oferta ya no está.');
  if (offer.envioId) {
    const envios = require('./envios');
    if (!acepta) { await envios.rechazarOferta(offer); return { ok: true }; }
    const driverEnvio = domi.docs.find((d) => String(d._id) === String(offer.driverId));
    const r = await envios.aceptarOferta(offer, driverEnvio);
    if (!r.ok) throw new ErrorDomi(409, r.reason === 'expired' ? 'Se acabó el tiempo para aceptarla.' : 'Otro domiciliario lo tomó primero.', r.reason);
    return { ok: true, pedidoId: String(offer.envioId) };
  }
  const assignment = require('./assignmentService');
  if (!acepta) {
    await assignment.rejectOffer(offer);
    return { ok: true };
  }
  const driver = domi.docs.find((d) => String(d._id) === String(offer.driverId));
  const r = await assignment.acceptOffer(offer, driver);
  if (!r.ok) {
    const msg = r.reason === 'expired' ? 'Se acabó el tiempo para aceptarla.'
      : r.reason === 'already_assigned' ? 'Otro domiciliario la tomó primero.'
      : 'Esa oferta ya no está disponible.';
    throw new ErrorDomi(409, msg, r.reason);
  }
  return { ok: true, pedidoId: String(offer.orderId) };
}

/* ═══════════════════════ Eventos (en línea o sin señal) ═══════════════════════ */

async function aplicarEventos(domi, eventos) {
  const lista = Array.isArray(eventos) ? eventos.slice(0, 50) : [];
  const resultados = [];
  // En orden: "recogí" tiene que aplicarse antes que "entregué" del mismo pedido
  for (const ev of lista) {
    resultados.push({ id: ev?.id, ...(await aplicarEvento(domi, ev)) });
  }
  return { resultados };
}

async function aplicarEvento(domi, crudo) {
  const v = reglas.validarEvento(crudo);
  if (!v.ok) return { ok: false, error: v.error, definitivo: true };
  const ev = v.evento;

  // Reclamar el id ANTES de aplicar: dos reenvíos simultáneos no aplican dos veces.
  let registro;
  try {
    registro = await DomiEvento.create({
      eventoId: ev.id, driverId: domi.ids[0], orderId: ev.pedidoId, tipo: ev.tipo,
      ocurrioAt: ev.at, ubicacion: ev.ubicacion || undefined, resultado: { procesando: true },
    });
  } catch (e) {
    if (e.code !== 11000) throw e;
    const previo = await DomiEvento.findOne({ eventoId: ev.id }).lean();
    if (previo?.resultado?.procesando) return { ok: false, error: 'procesando' }; // reintentar luego
    return { ...(previo?.resultado || { ok: true }), repetido: true };
  }

  let resultado;
  try {
    resultado = await ejecutar(domi, ev);
  } catch (e) {
    logger.error('Evento de domi falló', e, null);
    // Un error del servidor no es definitivo: se libera el id para reintentar.
    await DomiEvento.deleteOne({ _id: registro._id });
    return { ok: false, error: 'servidor' };
  }
  await DomiEvento.updateOne({ _id: registro._id }, { $set: { resultado, businessId: resultado.businessId || undefined } });
  return resultado;
}

async function ejecutar(domi, ev) {
  const order = await Order.findOne({ _id: ev.pedidoId, deliveryPersonId: { $in: domi.ids } });
  if (!order) {
    const Envio = require('../Models/Envio');
    const envio = await Envio.findOne({ _id: ev.pedidoId, deliveryPersonId: { $in: domi.ids } });
    if (envio) return require('./envios').aplicarEvento(envio, ev);
    // ¿Ya se entregó y se archivó? Entonces un "entregado" repetido está bien.
    const archivado = await CompletedOrder.findOne({ _id: ev.pedidoId, deliveryPersonId: { $in: domi.ids } }).select('_id businessId').lean();
    if (archivado) return { ok: true, yaEstaba: true, estado: 'entregado', businessId: String(archivado.businessId) };
    return { ok: false, error: 'no_es_tuyo', definitivo: true };
  }
  const businessId = String(order.businessId);
  const actual = reglas.estadoParaDomi(order);
  const puede = reglas.puedeAplicar(ev.tipo, actual);
  if (puede.yaEstaba) return { ok: true, yaEstaba: true, estado: actual, businessId };
  if (!puede.aplicar) return { ok: false, error: puede.motivo, estado: actual, definitivo: true, businessId };

  const destino = reglas.coordenadas(order.deliveryCoordinates) || reglas.coordenadas(order.deliveryZoneInfo?.coordinates);
  const cerca = reglas.revisarCercania(ev.tipo, ev.ubicacion, destino);
  if (!cerca.ok) return { ok: false, error: cerca.error, metros: cerca.metros, estado: actual, definitivo: true, businessId };

  const dsm = require('./deliveryStateMachine');
  const socketService = require('./socketService');
  const driverId = String(order.deliveryPersonId);
  const driver = domi.docs.find((d) => String(d._id) === driverId);
  const ctx = {
    actor: 'driver', actorId: driverId, actorName: driver?.name,
    location: ev.ubicacion ? { lat: ev.ubicacion.lat, lon: ev.ubicacion.lng } : undefined,
    meta: { app: 'v2', eventoId: ev.id, ocurrioAt: ev.at },
  };
  const business = await BusinessConfig.findById(order.businessId).select('requireDeliveryCode deliverySettings location').lean();
  const avisar = () => {
    socketService.emitToBusiness(businessId, 'orderUpdated', order.toObject());
    socketService.emitToOrder(String(order._id), 'order:status', {
      status: order.status, pickedAt: order.deliveryPickedAt, domiLlego: !!order.deliveryArrivedCustomerAt, updatedAt: new Date(),
    });
  };

  if (ev.tipo === 'llegue_local') {
    order.deliveryArrivedStoreAt = ev.at;
    await order.save();
    await dsm.recordForOrder(order, 'arrive_store', ctx);
    avisar();
    return { ok: true, estado: 'en_local', businessId };
  }

  if (ev.tipo === 'recogido') {
    if (business?.deliverySettings?.requirePickupCode) {
      const { verifyDailyPickupCode } = require('../utils/dailyPickupCode');
      if (!ev.datos.codigo || !(await verifyDailyPickupCode(order.businessId, ev.datos.codigo))) {
        return { ok: false, error: 'codigo_recogida_incorrecto', estado: actual, definitivo: true, businessId };
      }
    }
    if (!order.deliveryArrivedStoreAt) {
      order.deliveryArrivedStoreAt = ev.at;
      await dsm.recordForOrder(order, 'arrive_store', ctx);
    }
    order.deliveryPickedAt = ev.at;
    order.trackingEnabled = true;
    await order.save();
    await dsm.recordForOrder(order, 'pickup', ctx);
    avisar();
    return { ok: true, estado: 'hacia_cliente', businessId };
  }

  if (ev.tipo === 'llegue_cliente') {
    order.deliveryArrivedCustomerAt = ev.at;
    await order.save();
    await dsm.recordForOrder(order, 'arrive_customer', ctx);
    avisar();
    socketService.emitToOrder(String(order._id), 'domi:llego', { at: ev.at });
    return { ok: true, estado: 'con_cliente', businessId };
  }

  if (ev.tipo === 'no_entregado') {
    const motivo = reglas.MOTIVOS_NO_ENTREGA[ev.datos.motivo] || 'Otro motivo';
    order.deliveryFailedAt = ev.at;
    order.deliveryFailReason = ev.datos.nota ? `${motivo}: ${ev.datos.nota}` : motivo;
    order.trackingEnabled = false;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: order.status, timestamp: new Date(), note: `No entregado — ${order.deliveryFailReason}` });
    await order.save();
    await dsm.recordForOrder(order, 'fail', { ...ctx, failureReason: order.deliveryFailReason });
    const { releaseDriver } = require('./orderCompletionService');
    await releaseDriver(order.deliveryPersonId, { delivered: false });
    // Falta solo si nunca llegó donde el cliente (si llegó y el cliente no estaba, no es culpa suya)
    if (!order.deliveryArrivedCustomerAt) {
      const negocio = await BusinessConfig.findById(order.businessId).select('businessName').lean();
      require('./desempenoDomi').registrarFalta({
        telefono: domi.telefono, driverId: order.deliveryPersonId, tipo: 'no_entregado', refId: order._id,
        pedidoNumero: order.orderNumber, negocio: negocio?.businessName || null,
      }).catch(() => {});
    }
    socketService.emitToBusiness(businessId, 'delivery:failed', {
      orderId: String(order._id), orderNumber: order.orderNumber, reason: order.deliveryFailReason, driverName: driver?.name,
    });
    avisar();
    return { ok: true, estado: 'no_entregado', businessId };
  }

  // entregado
  const pideCodigo = business?.requireDeliveryCode !== false;
  if (pideCodigo) {
    if ((order.confirmationAttempts || 0) >= 3) {
      return { ok: false, error: 'codigo_bloqueado', estado: actual, definitivo: true, businessId };
    }
    if (!ev.datos.codigo || ev.datos.codigo !== order.confirmationCode) {
      order.confirmationAttempts = (order.confirmationAttempts || 0) + 1;
      await order.save();
      const restantes = Math.max(0, 3 - order.confirmationAttempts);
      if (!restantes) {
        socketService.emitToBusiness(businessId, 'delivery:blocked', { orderId: String(order._id), reason: 'max_attempts' });
        return { ok: false, error: 'codigo_bloqueado', estado: actual, definitivo: true, businessId };
      }
      return { ok: false, error: 'codigo_incorrecto', intentosRestantes: restantes, estado: actual, definitivo: true, businessId };
    }
  }
  if (!order.deliveryPickedAt) order.deliveryPickedAt = ev.at;
  order.status = 'delivered';
  order.deliveredAt = ev.at;
  order.trackingEnabled = false;
  if (ev.datos.fotoUrl) order.deliveryProofPhoto = ev.datos.fotoUrl;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: pideCodigo ? 'Entregado (código confirmado)' : 'Entregado' });
  await order.save();
  await dsm.recordForOrder(order, 'deliver', { ...ctx, proofPhoto: ev.datos.fotoUrl, meta: { ...ctx.meta, codeUsed: pideCodigo } });
  const { finalizeDeliveredOrder } = require('./orderCompletionService');
  await finalizeDeliveredOrder(order);
  // Subir de nivel es inmediato; y si lo aceptó solo, sus fallos vuelven a cero
  require('./autoAceptar').entregoBien(order).catch(() => {});
  require('./desempenoDomi').recalcularPorTelefono(domi.telefono).catch(() => {});
  return { ok: true, estado: 'entregado', businessId };
}

/** Foto de prueba de entrega. Se sube antes del evento "entregado" y viaja en él. */
async function subirFotoEntrega(domi, pedidoId, archivo) {
  if (!mongoose.isValidObjectId(pedidoId)) throw new ErrorDomi(404, 'Pedido no encontrado.');
  if (!archivo?.buffer) throw new ErrorDomi(400, 'No llegó la foto.');
  const order = await Order.findOne({ _id: pedidoId, deliveryPersonId: { $in: domi.ids } }).select('_id').lean()
    || await require('../Models/Envio').findOne({ _id: pedidoId, deliveryPersonId: { $in: domi.ids } }).select('_id').lean();
  if (!order) throw new ErrorDomi(404, 'Pedido no encontrado.');
  const { uploadImage, isSpacesConfigured } = require('./imageUploadService');
  if (!isSpacesConfigured()) throw new ErrorDomi(503, 'La subida de fotos no está disponible.');
  const r = await uploadImage(archivo.buffer, 'domi-entregas', { maxWidth: 1280, quality: 75 });
  const url = r?.url || r;
  await Order.updateOne({ _id: pedidoId }, { $set: { deliveryProofPhoto: url } });
  await require('../Models/Envio').updateOne({ _id: pedidoId }, { $set: { deliveryProofPhoto: url } });
  return { url };
}

/* ═══════════════════════ Panel del negocio ═══════════════════════ */

/** Cuadre de todos los domis que le han entregado a este negocio. */
async function cuadreNegocio(businessId) {
  const desde = new Date(Date.now() - DIAS_CUADRE * 86400000);
  const idsQueEntregaron = [
    ...(await Order.distinct('deliveryPersonId', { businessId, status: 'delivered', deliveredAt: { $gte: desde } })),
    ...(await CompletedOrder.distinct('deliveryPersonId', { businessId, deliveredAt: { $gte: desde } })),
  ].filter(Boolean);
  const propios = await DeliveryPerson.find({ businessId }).select('_id').lean();
  const todos = [...new Set([...idsQueEntregaron.map(String), ...propios.map((d) => String(d._id))])];
  const docs = await DeliveryPerson.find({ _id: { $in: todos } });
  const lista = await pendientes(docs, { businessId });
  return docs.map((d) => {
    const suyas = lista.filter((e) => e.driverId === String(d._id));
    return {
      driverId: String(d._id), nombre: d.name, telefono: d.phone, foto: d.photo || null,
      enLinea: !!d.isOnline, externo: !!d.partnerId,
      ...reglas.cuadrar(suyas),
      detalle: suyas,
    };
  }).filter((c) => c.entregas > 0 || !c.externo)
    .sort((a, b) => b.entregas - a.entregas);
}

/** Cierra el cuadre de un domi. Los montos se recalculan aquí, no vienen del navegador. */
async function liquidar(businessId, { driverId, orderIds, nota }, quien) {
  if (!mongoose.isValidObjectId(driverId)) throw new ErrorDomi(400, 'Domiciliario inválido.');
  const doc = await DeliveryPerson.findById(driverId);
  if (!doc) throw new ErrorDomi(404, 'Domiciliario no encontrado.');
  let lista = await pendientes([doc], { businessId });
  if (Array.isArray(orderIds) && orderIds.length) {
    const pedidos = new Set(orderIds.map(String));
    lista = lista.filter((e) => pedidos.has(e.orderId));
  }
  if (!lista.length) throw new ErrorDomi(409, 'No hay entregas pendientes por liquidar.');
  const c = reglas.cuadrar(lista);
  const liq = await DomiLiquidacion.create({
    businessId, driverId, orderIds: lista.map((e) => e.orderId),
    entregas: c.entregas, efectivo: c.efectivo, ganancias: c.ganancias, neto: c.neto,
    nota: String(nota || '').slice(0, 200), creadoPor: quien || '',
  });
  try {
    require('./socketService').emitToDeliveryPerson(String(driverId), 'domi:liquidado', { neto: c.neto, entregas: c.entregas });
  } catch { /* no crítico */ }
  return liq.toObject();
}

async function liquidacionesNegocio(businessId, { limite = 50 } = {}) {
  const lista = await DomiLiquidacion.find({ businessId }).sort({ createdAt: -1 }).limit(Math.min(200, limite)).lean();
  const docs = await DeliveryPerson.find({ _id: { $in: lista.map((l) => l.driverId) } }).select('name').lean();
  const nombres = new Map(docs.map((d) => [String(d._id), d.name]));
  return lista.map((l) => ({ ...l, domi: nombres.get(String(l.driverId)) || 'Domiciliario' }));
}

async function liquidacionesDomi(domi) {
  return DomiLiquidacion.find({ driverId: { $in: domi.ids } }).sort({ createdAt: -1 }).limit(30)
    .select('businessId entregas efectivo ganancias neto nota createdAt').lean();
}

const MAX_FOTOS_LOCAL = 3;

/** Solo fotos subidas por nosotros (https), máximo 3. */
function limpiarFotosLocal(fotos) {
  if (!Array.isArray(fotos)) throw new ErrorDomi(400, 'Las fotos no son válidas.');
  return fotos.map((f) => String(f || '').trim()).filter((f) => /^https:\/\/\S+$/.test(f) && f.length < 500).slice(0, MAX_FOTOS_LOCAL);
}

function reglasDe(b) {
  return {
    driverPay: reglas.normalizarReglaPago(b?.deliverySettings?.driverPay),
    maxActivePerDriver: b?.deliverySettings?.maxActivePerDriver || 1,
    requirePickupCode: !!b?.deliverySettings?.requirePickupCode,
    fotosLocal: (b?.location?.fotos || []).slice(0, MAX_FOTOS_LOCAL),
  };
}

async function reglasNegocio(businessId) {
  return reglasDe(await BusinessConfig.findById(businessId).select('deliverySettings location.fotos').lean());
}

async function guardarReglasNegocio(businessId, { driverPay, maxActivePerDriver, requirePickupCode, fotosLocal }) {
  const set = {};
  if (fotosLocal !== undefined) set['location.fotos'] = limpiarFotosLocal(fotosLocal);
  if (driverPay) {
    const r = reglas.normalizarReglaPago(driverPay);
    set['deliverySettings.driverPay'] = r;
  }
  if (maxActivePerDriver != null) {
    set['deliverySettings.maxActivePerDriver'] = Math.min(5, Math.max(1, parseInt(maxActivePerDriver, 10) || 1));
  }
  if (requirePickupCode != null) set['deliverySettings.requirePickupCode'] = !!requirePickupCode;
  if (!Object.keys(set).length) throw new ErrorDomi(400, 'Nada que guardar.');
  await BusinessConfig.updateOne({ _id: businessId }, { $set: set });
  return reglasNegocio(businessId);
}

module.exports = {
  ErrorDomi,
  entrar,
  renovar,
  salir,
  autenticar,
  afiliaciones,
  estado,
  ganancias,
  cuadre,
  liquidacionesDomi,
  ponerDisponible,
  registrarUbicacion,
  guardarPush,
  responderOferta,
  aplicarEventos,
  subirFotoEntrega,
  cuadreNegocio,
  liquidar,
  liquidacionesNegocio,
  guardarReglasNegocio,
  reglasNegocio,
};
