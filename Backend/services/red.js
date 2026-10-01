/**
 * La Red MenuBy: domiciliarios independientes.
 *
 * Se registran solos desde la app (celular verificado por WhatsApp, documento,
 * selfie y vehículo), el superadmin los revisa y les asigna los negocios para
 * los que reparten. Pertenecen a una empresa de plataforma ("Red MenuBy") que
 * se crea sola la primera vez; así reutilizan todo lo que ya existe para
 * domis de empresas: ofertas, eventos, GPS, cuadre.
 *
 * Lo que se les paga no sale de la regla del negocio sino del algoritmo de
 * utils/tarifaRed.js, calculado al ofrecer y congelado al aceptar.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { calcularTarifa, normalizarConfig } = require('../utils/tarifaRed');
const { variantesTelefono, distanciaKm, coordenadas } = require('../utils/domiApp');

const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliveryPartner = require('../Models/DeliveryPartner');
const DomiVerificacion = require('../Models/DomiVerificacion');
const ConfigRed = require('../Models/ConfigRed');

const VENCE_CODIGO_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;
const MAX_INTENTOS = 5;
const FACTOR_CALLES = 1.3;

class ErrorRed extends Error {
  constructor(status, mensaje, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const tel10 = (t) => variantesTelefono(t).find((x) => x.length === 10) || '';

/* ═══════════════ La empresa de plataforma ═══════════════ */

let redCache = null;
async function obtenerRed() {
  if (redCache) return redCache;
  /* Atómico: dos pedidos a la vez no crean dos "Red MenuBy". El correo es
     interno y no sirve para entrar: nadie usa el portal de la red. */
  const bcrypt = require('bcryptjs');
  const red = await DeliveryPartner.findOneAndUpdate(
    { esRedMenuby: true },
    {
      $setOnInsert: {
        name: 'Red MenuBy',
        email: 'plataforma.red@interno.menuby.tech',
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        esRedMenuby: true,
        autoDispatch: false, // la red no se ofrece por empresa: va por negocios asignados
        maxActivePerDriver: 2,
        driverPay: { modo: 'domicilio', valor: 0 },
        active: true,
      },
    },
    { upsert: true, new: true },
  ).lean();
  redCache = red;
  return redCache;
}

/* ═══════════════ Verificación del celular por WhatsApp ═══════════════ */

async function cuentaPlataforma() {
  const { PLATAFORMA_ID } = require('./leads');
  const WhatsAppAccount = require('../Models/WhatsAppAccount');
  return WhatsAppAccount.findOne({ businessId: PLATAFORMA_ID, status: { $ne: 'disconnected' } });
}

/**
 * Manda un código de 6 números para verificar el registro. Por ahora va al
 * correo; por WhatsApp cuando exista la plantilla de autenticación en Meta
 * (REGISTRO_CODIGO_CANAL=whatsapp). En desarrollo, si no hay cómo enviarlo,
 * el código se devuelve para poder probar; en producción eso nunca pasa.
 */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const canal = () => (process.env.REGISTRO_CODIGO_CANAL === 'whatsapp' ? 'whatsapp' : 'correo');

async function enviarCodigo(telefono, email) {
  const tel = tel10(telefono);
  if (!/^3\d{9}$/.test(tel)) throw new ErrorRed(400, 'Escribe un celular colombiano válido (10 números).');
  const correo = String(email || '').trim().toLowerCase();
  if (canal() === 'correo' && !CORREO.test(correo)) throw new ErrorRed(400, 'Escribe un correo válido: ahí te llega el código.');

  const previo = await DomiVerificacion.findOne({ telefono: tel }).sort({ enviadoAt: -1 });
  if (previo && Date.now() - previo.enviadoAt.getTime() < ESPERA_REENVIO_MS) {
    const s = Math.ceil((ESPERA_REENVIO_MS - (Date.now() - previo.enviadoAt.getTime())) / 1000);
    throw new ErrorRed(429, `Espera ${s} s para pedir otro código.`, 'espera');
  }

  const codigo = String(crypto.randomInt(100000, 1000000));
  await DomiVerificacion.deleteMany({ telefono: tel });
  await DomiVerificacion.create({ telefono: tel, email: correo || undefined, codigoHash: hash(`${tel}:${codigo}`), venceAt: new Date(Date.now() + VENCE_CODIGO_MS) });
  const produccion = process.env.NODE_ENV === 'production';

  if (canal() === 'correo') {
    const { sendCodigoRegistroDomi } = require('./emailService');
    const r = await sendCodigoRegistroDomi({ to: correo, codigo }).catch((e) => ({ sent: false, reason: e.message }));
    if (r?.sent) return { enviado: true, canal: 'correo' };
    if (!produccion) {
      logger.warn('Sin correo configurado: código de registro solo para desarrollo', { telefono: tel });
      return { enviado: false, canal: 'correo', codigoPrueba: codigo };
    }
    await DomiVerificacion.deleteMany({ telefono: tel }); // que pueda pedir otro ya
    throw new ErrorRed(502, 'No pudimos enviarte el correo. Revisa la dirección e intenta de nuevo.');
  }

  const cuenta = await cuentaPlataforma();
  if (!cuenta) {
    if (produccion) throw new ErrorRed(503, 'No pudimos enviar el código por WhatsApp. Intenta más tarde.');
    logger.warn('Sin WhatsApp de plataforma: código de registro solo para desarrollo', { telefono: tel });
    return { enviado: false, codigoPrueba: codigo };
  }
  try {
    const { enviarCodigoVerificacion } = require('./whatsappCloud');
    await enviarCodigoVerificacion({
      account: cuenta, to: tel, codigo,
      plantilla: process.env.WHATSAPP_PLANTILLA_CODIGO || 'codigo_verificacion',
      idioma: process.env.WHATSAPP_PLANTILLA_CODIGO_IDIOMA || 'es',
    });
  } catch (e) {
    logger.error('No se pudo enviar el código de registro por WhatsApp', e, null);
    await DomiVerificacion.deleteMany({ telefono: tel }); // que pueda pedir otro ya
    throw new ErrorRed(502, 'No pudimos enviar el código por WhatsApp. Revisa el número e intenta de nuevo.');
  }
  return { enviado: true };
}

/** Comprueba el código y entrega un pase de 30 min para completar el registro. */
async function verificarCodigo(telefono, codigo) {
  const tel = tel10(telefono);
  const v = await DomiVerificacion.findOne({ telefono: tel }).sort({ enviadoAt: -1 });
  if (!v || v.venceAt < new Date()) throw new ErrorRed(400, 'El código venció. Pide uno nuevo.', 'vencido');
  if (v.intentos >= MAX_INTENTOS) throw new ErrorRed(429, 'Demasiados intentos. Pide un código nuevo.', 'bloqueado');
  if (hash(`${tel}:${String(codigo || '').trim()}`) !== v.codigoHash) {
    v.intentos += 1;
    await v.save();
    const quedan = MAX_INTENTOS - v.intentos;
    throw new ErrorRed(400, quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intentos.` : 'Demasiados intentos. Pide un código nuevo.', 'incorrecto');
  }
  await DomiVerificacion.deleteMany({ telefono: tel });
  const pase = jwt.sign({ tipo: 'registro-domi', tel, email: v.email || undefined }, process.env.JWT_SECRET, { expiresIn: '30m' });
  return { pase };
}

function leerPase(pase) {
  try {
    const d = jwt.verify(String(pase || ''), process.env.JWT_SECRET);
    if (d.tipo === 'registro-domi' && d.tel) return { tel: d.tel, email: d.email || null };
  } catch { /* vencido o falso */ }
  throw new ErrorRed(401, 'Tu verificación venció. Vuelve a pedir el código.', 'pase');
}

/* ═══════════════ Registro ═══════════════ */

const TIPOS_DOC = { cc: 'Cédula', ce: 'Cédula de extranjería', ppt: 'PPT', pasaporte: 'Pasaporte' };
const VEHICULOS = ['moto', 'bicicleta', 'carro', 'a_pie'];

/**
 * Crea (o vuelve a enviar, si lo rechazaron) el registro de un independiente.
 * @param {Object} datos { pase, nombre, tipoDocumento, numeroDocumento, vehiculo, placa, pin }
 * @param {Object} archivos { frente, reverso, selfie } (buffers de multer)
 */
async function registrar(datos, archivos) {
  const { tel, email } = leerPase(datos.pase);
  const nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 5 || !/\s/.test(nombre)) throw new ErrorRed(400, 'Escribe tu nombre y apellido completos.');
  if (!TIPOS_DOC[datos.tipoDocumento]) throw new ErrorRed(400, 'Elige el tipo de documento.');
  const numero = String(datos.numeroDocumento || '').replace(/[^\dA-Za-z]/g, '').toUpperCase();
  if (numero.length < 5 || numero.length > 20) throw new ErrorRed(400, 'Revisa el número del documento.');
  if (!VEHICULOS.includes(datos.vehiculo)) throw new ErrorRed(400, 'Elige en qué vas a repartir.');
  const placa = String(datos.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  if (['moto', 'carro'].includes(datos.vehiculo) && placa.length < 5) throw new ErrorRed(400, 'Escribe la placa del vehículo.');
  if (!/^\d{4}$/.test(String(datos.pin || ''))) throw new ErrorRed(400, 'El PIN debe tener 4 números.');
  if (/^(\d)\1{3}$|^(1234|4321|0000)$/.test(String(datos.pin))) throw new ErrorRed(400, 'Ese PIN es muy fácil de adivinar. Elige otro.');
  if (!archivos?.frente?.buffer || !archivos?.selfie?.buffer) throw new ErrorRed(400, 'Faltan las fotos del documento y tu selfie.');
  if (datos.tipoDocumento !== 'pasaporte' && !archivos?.reverso?.buffer) throw new ErrorRed(400, 'Falta la foto del reverso del documento.');

  const red = await obtenerRed();
  const variantes = variantesTelefono(tel);

  // Un celular que ya reparte con un negocio o empresa no se duplica como independiente
  let doc = await DeliveryPerson.findOne({ phone: { $in: variantes }, partnerId: red._id });
  if (doc && ['pendiente', 'aprobado'].includes(doc.independiente?.estado)) {
    throw new ErrorRed(409, doc.independiente.estado === 'aprobado' ? 'Ya estás registrado. Entra con tu celular y tu PIN.' : 'Tu registro ya está en revisión.', doc.independiente.estado);
  }
  if (doc?.independiente?.estado === 'suspendido') throw new ErrorRed(403, 'Tu cuenta está suspendida. Escríbenos para revisarla.', 'suspendido');
  const otroDoc = await DeliveryPerson.findOne({ 'independiente.documento.numero': numero, partnerId: red._id, phone: { $nin: variantes } }).lean();
  if (otroDoc) throw new ErrorRed(409, 'Ese documento ya está registrado con otro celular.', 'documento');

  const { subirPrivado, configurado } = require('./archivosPrivados');
  if (!configurado()) throw new ErrorRed(503, 'No podemos recibir fotos en este momento. Intenta más tarde.');
  const carpeta = `domis/${tel}`;
  const [frente, reverso, selfie] = await Promise.all([
    subirPrivado(archivos.frente.buffer, carpeta),
    archivos.reverso?.buffer ? subirPrivado(archivos.reverso.buffer, carpeta) : Promise.resolve(null),
    subirPrivado(archivos.selfie.buffer, carpeta),
  ]);

  const independiente = {
    estado: 'pendiente',
    documento: { tipo: datos.tipoDocumento, numero, frente, reverso },
    selfie,
    vehiculo: { tipo: datos.vehiculo, placa: placa || undefined },
    telefonoVerificadoAt: new Date(),
    email: email || undefined,
    enviadoAt: new Date(),
  };
  if (!doc) {
    doc = new DeliveryPerson({ partnerId: red._id, phone: tel, name: nombre, code: String(datos.pin), active: false, independiente });
  } else {
    // Reenvío después de un rechazo: se borran las fotos viejas
    const { borrarPrivado } = require('./archivosPrivados');
    const viejo = doc.independiente || {};
    [viejo.documento?.frente, viejo.documento?.reverso, viejo.selfie].forEach((k) => borrarPrivado(k));
    doc.name = nombre;
    doc.code = String(datos.pin);
    doc.active = false;
    doc.independiente = independiente;
  }
  await doc.save();
  logger.info('Registro de domi independiente recibido', { id: String(doc._id) });
  return { estado: 'pendiente' };
}

/** Estado del registro (para la pantalla "En revisión"), con el pase de WhatsApp o celular+PIN. */
async function estadoRegistro(telefono) {
  const red = await obtenerRed();
  const doc = await DeliveryPerson.findOne({ phone: { $in: variantesTelefono(telefono) }, partnerId: red._id })
    .select('independiente.estado independiente.motivo independiente.enviadoAt').lean();
  if (!doc) return { estado: 'sin_registro' };
  return { estado: doc.independiente?.estado || 'sin_registro', motivo: doc.independiente?.motivo || null, enviadoAt: doc.independiente?.enviadoAt || null };
}

/* ═══════════════ Superadmin ═══════════════ */

const CAMPOS_LISTA = 'name phone photo independiente negociosAsignados isOnline lastSeenAt totalDeliveries rating active createdAt';

async function listar({ estado = 'pendiente', q = '', pagina = 1 } = {}) {
  const red = await obtenerRed();
  const filtro = { partnerId: red._id };
  if (estado !== 'todos') filtro['independiente.estado'] = estado;
  if (q) {
    const t = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40);
    filtro.$or = [{ name: new RegExp(t, 'i') }, { phone: new RegExp(t) }, { 'independiente.documento.numero': new RegExp(t, 'i') }];
  }
  const porPagina = 30;
  const [lista, conteo] = await Promise.all([
    DeliveryPerson.find(filtro).select(CAMPOS_LISTA).sort({ 'independiente.enviadoAt': -1 }).skip((Math.max(1, pagina) - 1) * porPagina).limit(porPagina).lean(),
    DeliveryPerson.aggregate([{ $match: { partnerId: red._id } }, { $group: { _id: '$independiente.estado', n: { $sum: 1 } } }]),
  ]);
  const conteos = Object.fromEntries(conteo.map((c) => [c._id || 'sin_estado', c.n]));
  const BusinessConfig = require('../Models/BusinessConfig');
  const negocios = await BusinessConfig.find({ _id: { $in: lista.flatMap((d) => d.negociosAsignados || []) } }).select('businessName slug logo').lean();
  const porId = new Map(negocios.map((b) => [String(b._id), { id: String(b._id), nombre: b.businessName, slug: b.slug, logo: b.logo || null }]));
  return {
    conteos,
    repartidores: lista.map((d) => ({
      id: String(d._id),
      nombre: d.name,
      telefono: d.phone,
      email: d.independiente?.email || null,
      estado: d.independiente?.estado,
      documento: { tipo: d.independiente?.documento?.tipo, numero: d.independiente?.documento?.numero },
      vehiculo: d.independiente?.vehiculo || null,
      enviadoAt: d.independiente?.enviadoAt,
      revisadoAt: d.independiente?.revisadoAt,
      revisadoPor: d.independiente?.revisadoPor,
      motivo: d.independiente?.motivo,
      enLinea: !!d.isOnline,
      entregas: d.totalDeliveries || 0,
      calificacion: d.rating ?? 5,
      negocios: (d.negociosAsignados || []).map((id) => porId.get(String(id))).filter(Boolean),
    })),
  };
}

/** Las fotos del registro, con enlaces que vencen en 5 minutos. */
async function documentos(id) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorRed(404, 'No encontrado.');
  const red = await obtenerRed();
  const d = await DeliveryPerson.findOne({ _id: id, partnerId: red._id }).select('independiente').lean();
  if (!d) throw new ErrorRed(404, 'No encontrado.');
  const { enlaceFirmado } = require('./archivosPrivados');
  const i = d.independiente || {};
  const [frente, reverso, selfie] = await Promise.all([enlaceFirmado(i.documento?.frente), enlaceFirmado(i.documento?.reverso), enlaceFirmado(i.selfie)]);
  return { frente, reverso, selfie, vencenEn: 300 };
}

async function decidir(id, accion, { motivo, quien } = {}) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorRed(404, 'No encontrado.');
  const red = await obtenerRed();
  const d = await DeliveryPerson.findOne({ _id: id, partnerId: red._id });
  if (!d) throw new ErrorRed(404, 'No encontrado.');
  const permitido = {
    aprobar: ['pendiente', 'rechazado', 'suspendido'],
    rechazar: ['pendiente'],
    suspender: ['aprobado'],
  };
  if (!permitido[accion]) throw new ErrorRed(400, 'Acción inválida.');
  if (!permitido[accion].includes(d.independiente?.estado)) throw new ErrorRed(409, `No se puede ${accion} un registro ${d.independiente?.estado}.`);
  if ((accion === 'rechazar' || accion === 'suspender') && String(motivo || '').trim().length < 4) {
    throw new ErrorRed(400, 'Escribe el motivo: el domi lo va a ver.');
  }
  const estado = { aprobar: 'aprobado', rechazar: 'rechazado', suspender: 'suspendido' }[accion];
  d.independiente.estado = estado;
  d.independiente.revisadoAt = new Date();
  d.independiente.revisadoPor = quien || '';
  d.independiente.motivo = accion === 'aprobar' ? undefined : String(motivo).trim().slice(0, 300);
  d.active = estado === 'aprobado';
  if (estado !== 'aprobado') { d.isOnline = false; d.refreshTokenHash = null; }
  await d.save();
  avisarDomi(d, estado, d.independiente.motivo).catch(() => {});
  logger.info('Registro de domi independiente revisado', { id: String(d._id), estado, quien });
  return { estado };
}

/** Un aviso al celular (si ya tiene la app con notificaciones). */
async function avisarDomi(d, estado, motivo) {
  if (!d.fcmToken) return;
  const fcm = require('./fcmService');
  const textos = {
    aprobado: ['¡Ya puedes repartir! 🛵', 'Tu registro fue aprobado. Conéctate para recibir pedidos.'],
    rechazado: ['Revisa tu registro', motivo || 'Hay algo que corregir en tus documentos.'],
    suspendido: ['Tu cuenta está suspendida', motivo || 'Escríbenos para revisarla.'],
  };
  const [title, body] = textos[estado] || [];
  if (title) await fcm.sendData(d.fcmToken, { type: 'registro', estado }, { title, body });
}

async function asignarNegocios(id, businessIds = []) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorRed(404, 'No encontrado.');
  const ids = [...new Set((Array.isArray(businessIds) ? businessIds : []).filter((x) => mongoose.isValidObjectId(x)).map(String))].slice(0, 100);
  const BusinessConfig = require('../Models/BusinessConfig');
  const existentes = await BusinessConfig.find({ _id: { $in: ids } }).select('_id').lean();
  const red = await obtenerRed();
  const d = await DeliveryPerson.findOneAndUpdate(
    { _id: id, partnerId: red._id },
    { $set: { negociosAsignados: existentes.map((b) => b._id) } },
    { new: true },
  );
  if (!d) throw new ErrorRed(404, 'No encontrado.');
  return { negocios: existentes.length };
}

/* ═══════════════ Tarifa ═══════════════ */

async function leerConfig() {
  const c = await ConfigRed.findOne({ clave: 'red' }).lean();
  return {
    tarifa: normalizarConfig(c?.tarifa || {}),
    lluviaHasta: c?.lluviaHasta && c.lluviaHasta > new Date() ? c.lluviaHasta : null,
  };
}

async function guardarConfig({ tarifa, lluviaHoras }, quien) {
  const set = { actualizadoPor: quien || '' };
  if (tarifa) set.tarifa = normalizarConfig(tarifa);
  if (lluviaHoras !== undefined) {
    const h = Math.min(12, Math.max(0, Number(lluviaHoras) || 0));
    set.lluviaHasta = h ? new Date(Date.now() + h * 3600000) : null;
  }
  await ConfigRed.updateOne({ clave: 'red' }, { $set: set }, { upsert: true });
  return leerConfig();
}

/**
 * Tarifa para ofrecerle un pedido a un independiente. La demanda se mide con
 * los pedidos que esperan domi cerca del local; la oferta, con los domis
 * independientes libres cerca.
 */
async function tarifaParaOferta({ order, business, driver }) {
  const { tarifa, lluviaHasta } = await leerConfig();
  const local = coordenadas(business?.location?.coordinates);
  const destino = coordenadas(order?.deliveryCoordinates) || coordenadas(order?.deliveryZoneInfo?.coordinates);
  const yo = driver?.lastLocation?.coordinates ? { lat: driver.lastLocation.coordinates[1], lng: driver.lastLocation.coordinates[0] } : null;
  // Por calle si Mapbox responde; si no, la recta × 1,3 de siempre
  const rutas = require('./rutas');
  const [calleEntrega, calleRecogida] = await Promise.all([
    local && destino ? rutas.distanciaKm(local, destino) : null,
    yo && local ? rutas.distanciaKm(yo, local) : null,
  ]);
  const kmEntrega = calleEntrega ?? (distanciaKm(local, destino) ?? 3) * FACTOR_CALLES;
  const kmRecogida = calleRecogida ?? (distanciaKm(yo, local) ?? 1) * FACTOR_CALLES;

  let demanda = 0;
  let oferta = 1;
  try {
    const Delivery = require('../Models/Delivery');
    const hace30 = new Date(Date.now() - 30 * 60000);
    demanda = await Delivery.countDocuments({ state: { $in: ['no_courier', 'offered', 'created', 'ready'] }, createdAt: { $gte: hace30 } });
    if (local) {
      const red = await obtenerRed();
      oferta = await DeliveryPerson.countDocuments({
        partnerId: red._id, active: true, isOnline: true, 'independiente.estado': 'aprobado',
        lastSeenAt: { $gte: new Date(Date.now() - 5 * 60000) },
        lastLocation: { $geoWithin: { $centerSphere: [[local.lng, local.lat], 4 / 6371] } },
      });
    }
  } catch (e) {
    logger.warn('No se pudo medir la demanda de la red', { error: e.message });
  }
  return calcularTarifa({ kmEntrega, kmRecogida, fecha: new Date(), demanda, oferta, lluvia: !!lluviaHasta }, tarifa);
}

/** Independientes aprobados, conectados, con cupo y asignados a este negocio. */
async function candidatosPara(businessId, maxActivos) {
  const red = await obtenerRed();
  const desde = new Date(Date.now() - 5 * 60000);
  return DeliveryPerson.find({
    partnerId: red._id,
    active: true,
    'independiente.estado': 'aprobado',
    negociosAsignados: businessId,
    isOnline: true,
    lastSeenAt: { $gte: desde },
    'lastLocation.coordinates': { $exists: true },
    $or: [{ activeDeliveries: { $lt: maxActivos } }, { activeDeliveries: { $exists: false } }],
  }).lean();
}

module.exports = {
  ErrorRed,
  TIPOS_DOC,
  obtenerRed,
  enviarCodigo,
  verificarCodigo,
  registrar,
  estadoRegistro,
  listar,
  documentos,
  decidir,
  asignarNegocios,
  leerConfig,
  guardarConfig,
  tarifaParaOferta,
  candidatosPara,
};
