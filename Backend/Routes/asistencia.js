const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');
const router = express.Router();

const BusinessConfig = require('../Models/BusinessConfig');
const { AsistenciaPersona, AsistenciaSede, AsistenciaMarca, AsistenciaConfig } = require('../Models/Asistencia');
const { tenantAuth } = require('../middleware/tenantAuth');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const telegram = require('../utils/telegram');
const {
  secreto, hashPin, pinValido, codigoAleatorio, siguienteTipo, hora, mensajeTelegram, inicioDelDia, chatDelVinculo,
  candadoMarca, esLinkMaps, coordsValidas, coordsDeMaps, metrosEntre, puedeMarcarEn, fotoDeDataUrl,
} = require('../utils/asistencia');

/**
 * Asistencia del equipo.
 *
 * Público (sin sesión), en este orden:
 *   GET  /pantalla/:clave   la pantalla del local pide el código del QR
 *   POST /escanear          el celular abre el QR: el código se gasta y cambia
 *   POST /identificar       con el PIN: "Hola Ana, vas a marcar ENTRADA"
 *   POST /confirmar         el empleado confirma y queda registrada
 *
 * Panel (admin del negocio): sedes con ubicación, personas con PIN y sedes
 * asignadas, marcas para el reporte y el Telegram que recibe los avisos.
 */

const MAX_INTENTOS_PIN = 5;
const PASE_MIN = 10;
const CONFIRMACION_MIN = 3;

const limitePantalla = rateLimit({ windowMs: 15 * 60 * 1000, max: 3000, standardHeaders: true, legacyHeaders: false });
const limiteMarcar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos.' },
});

// Estado de cada escaneo (pase): intentos de PIN y si ya se usó. En memoria:
// el pase dura 10 minutos. La doble marca la frena además la base (candado).
const escaneos = new Map();
function estadoDe(jti, expiraSeg) {
  const ahora = Date.now();
  for (const [k, v] of escaneos) if (v.expira < ahora) escaneos.delete(k);
  if (!escaneos.has(jti)) escaneos.set(jti, { fallos: 0, usado: false, expira: expiraSeg * 1000 });
  return escaneos.get(jti);
}

function datosNegocio(b) {
  return { nombre: b?.businessName || '', logo: b?.logo || '', color: b?.theme?.buttonColor || '#E8002D' };
}

function leerToken(token, uso) {
  try { return jwt.verify(String(token || ''), secreto(uso)); } catch { return null; }
}

// ─────────────────────────── Público ───────────────────────────

router.get('/pantalla/:clave', limitePantalla, async (req, res) => {
  try {
    const sede = await AsistenciaSede.findOne({ clave: String(req.params.clave) }).select('businessId nombre codigo').lean();
    if (!sede) return res.status(404).json({ message: 'Este link de asistencia no existe o fue cambiado.' });
    const negocio = await BusinessConfig.findById(sede.businessId).select('businessName logo theme').lean();
    res.set('Cache-Control', 'no-store');
    res.json({ negocio: datosNegocio(negocio), sede: sede.nombre, codigo: sede.codigo });
  } catch (err) {
    logger.error('asistencia pantalla', err);
    res.status(500).json({ message: 'Error cargando la pantalla' });
  }
});

router.post('/escanear', limiteMarcar, async (req, res) => {
  try {
    const clave = String(req.body.clave || '');
    const codigo = String(req.body.codigo || '');
    // Gastar el código y poner otro en un solo paso atómico: si dos personas
    // escanean el mismo QR al mismo tiempo, solo una lo gana.
    const sede = await AsistenciaSede.findOneAndUpdate(
      { clave, codigo },
      { $set: { codigo: codigoAleatorio() } },
      { new: true },
    ).select('businessId nombre').lean();
    if (!sede) {
      const existe = await AsistenciaSede.exists({ clave });
      return res.status(existe ? 410 : 404).json({
        message: existe
          ? 'Este QR ya lo escaneó alguien. Escanea el nuevo que está ahora en la pantalla.'
          : 'Este link de asistencia no existe.',
      });
    }
    const negocio = await BusinessConfig.findById(sede.businessId).select('businessName logo theme').lean();
    const pase = jwt.sign(
      { b: String(sede.businessId), s: String(sede._id), j: codigoAleatorio(16) },
      secreto('asistencia-pase'),
      { expiresIn: `${PASE_MIN}m` },
    );
    res.json({ pase, negocio: datosNegocio(negocio), sede: sede.nombre });
  } catch (err) {
    logger.error('asistencia escanear', err);
    res.status(500).json({ message: 'Error al escanear' });
  }
});

// Paso 1: el PIN dice quién es y qué va a marcar. Todavía no se registra nada.
router.post('/identificar', limiteMarcar, async (req, res) => {
  const pase = leerToken(req.body.pase, 'asistencia-pase');
  if (!pase) return res.status(401).json({ message: 'Se venció el tiempo. Escanea otra vez el QR de la pantalla.', vencido: true });
  const estado = estadoDe(pase.j, pase.exp);
  if (estado.usado) return res.status(409).json({ message: 'Este escaneo ya se usó. Escanea otra vez el QR.', vencido: true });
  if (estado.fallos >= MAX_INTENTOS_PIN) return res.status(429).json({ message: 'Demasiados PIN incorrectos. Escanea otra vez el QR.', vencido: true });

  const pin = String(req.body.pin || '');
  if (!pinValido(pin)) return res.status(400).json({ message: 'El PIN son 4 números.' });

  try {
    const persona = await AsistenciaPersona.findOne({ businessId: pase.b, pinHash: hashPin(pase.b, pin), activo: true }).select('nombre sedes').lean();
    if (!persona) {
      estado.fallos += 1;
      const quedan = MAX_INTENTOS_PIN - estado.fallos;
      return res.status(401).json({
        message: quedan > 0 ? `PIN incorrecto. Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'}.` : 'Demasiados PIN incorrectos. Escanea otra vez el QR.',
        vencido: quedan <= 0,
      });
    }
    const sede = await AsistenciaSede.findById(pase.s).select('nombre').lean();
    if (!puedeMarcarEn(persona, pase.s)) {
      return res.status(403).json({ message: `${persona.nombre.split(' ')[0]}, no estás asignado a ${sede?.nombre || 'esta sede'}. Pídele al administrador que te asigne.` });
    }
    const ultima = await AsistenciaMarca.findOne({ personaId: persona._id }).sort({ fecha: -1 }).select('tipo fecha').lean();
    const tipo = siguienteTipo(ultima, new Date());
    if (!tipo) return res.status(409).json({ message: `Ya quedó registrada tu ${ultima.tipo} de las ${hora(ultima.fecha)}` });

    const confirmacion = jwt.sign({ j: pase.j, b: pase.b, s: pase.s, p: String(persona._id) }, secreto('asistencia-confirmar'), { expiresIn: `${CONFIRMACION_MIN}m` });
    res.json({ confirmacion, nombre: persona.nombre, tipo, sede: sede?.nombre || '' });
  } catch (err) {
    logger.error('asistencia identificar', err);
    res.status(500).json({ message: 'No se pudo verificar el PIN. Intenta de nuevo.' });
  }
});

// Paso 2: el empleado confirma y queda registrada.
router.post('/confirmar', limiteMarcar, async (req, res) => {
  const c = leerToken(req.body.confirmacion, 'asistencia-confirmar');
  if (!c) return res.status(401).json({ message: 'Se venció el tiempo. Escanea otra vez el QR de la pantalla.', vencido: true });
  const estado = estadoDe(c.j, c.exp);
  if (estado.usado) return res.status(409).json({ message: 'Esta marca ya quedó registrada.', yaRegistrada: true });

  const lat = Number(req.body.ubicacion?.lat);
  const lng = Number(req.body.ubicacion?.lng);
  if (!coordsValidas(lat, lng)) return res.status(400).json({ message: 'Necesitamos tu ubicación para registrar la marca.' });
  // La foto del rostro, tomada en el momento con la cámara (no de la galería).
  const foto = fotoDeDataUrl(req.body.foto);
  if (!foto) return res.status(400).json({ message: 'Tómate la foto del rostro para registrar la marca.', sinFoto: true });

  estado.usado = true; // antes de ir a la base: un doble toque no pasa de aquí
  try {
    const [persona, sede] = await Promise.all([
      AsistenciaPersona.findOne({ _id: c.p, businessId: c.b, activo: true }).select('nombre').lean(),
      AsistenciaSede.findById(c.s).select('nombre ubicacion').lean(),
    ]);
    if (!persona) { estado.usado = false; return res.status(404).json({ message: 'Esta persona ya no está activa.' }); }

    const ahora = new Date();
    const ultima = await AsistenciaMarca.findOne({ personaId: persona._id }).sort({ fecha: -1 }).select('tipo fecha').lean();
    const tipo = siguienteTipo(ultima, ahora);
    if (!tipo) return res.status(409).json({ message: `Ya quedó registrada tu ${ultima.tipo} de las ${hora(ultima.fecha)}`, yaRegistrada: true });

    const ubicacion = { lat, lng, precision: Number(req.body.ubicacion?.precision) || undefined };
    const marca = await AsistenciaMarca.create({
      businessId: c.b,
      personaId: persona._id,
      nombre: persona.nombre,
      sedeId: c.s,
      sedeNombre: sede?.nombre || '',
      tipo,
      fecha: ahora,
      ubicacion,
      distancia: metrosEntre(ubicacion, sede?.ubicacion) ?? undefined,
      candado: candadoMarca(persona._id, ahora),
    });

    // Aviso inmediato por Telegram con la foto del rostro, sin hacer esperar
    // al empleado. La foto no se guarda en Menuby: solo viaja en el aviso.
    AsistenciaConfig.findOne({ businessId: c.b }).select('telegram.chats').lean().then((cfg) => {
      const texto = mensajeTelegram({ nombre: marca.nombre, tipo, sedeNombre: marca.sedeNombre, fecha: ahora });
      for (const chat of cfg?.telegram?.chats || []) telegram.enviarFoto(chat.chatId, foto, texto);
    }).catch(() => {});

    res.status(201).json({ tipo, nombre: persona.nombre, hora: hora(ahora), sede: marca.sedeNombre });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Tu marca ya quedó registrada.', yaRegistrada: true });
    estado.usado = false;
    logger.error('asistencia confirmar', err);
    res.status(500).json({ message: 'No se pudo registrar. Intenta de nuevo.' });
  }
});

// ─────────────────────────── Panel ───────────────────────────

const soloAdmin = [tenantAuth, requireRole('admin', 'brand_admin', 'superadmin')];
const negocioDe = (req) => req.resolvedBusinessId || req.user?.businessId;

const sedeParaPanel = (s) => ({ _id: s._id, nombre: s.nombre, clave: s.clave, ubicacion: s.ubicacion?.lat != null ? s.ubicacion : null, mapsUrl: s.mapsUrl || '' });

async function sedesDe(businessId) {
  let sedes = await AsistenciaSede.find({ businessId }).sort({ createdAt: 1 }).lean();
  if (!sedes.length) {
    const b = await BusinessConfig.findById(businessId).select('businessName').lean();
    const nueva = await AsistenciaSede.create({ businessId, nombre: b?.businessName || 'Sede principal', clave: codigoAleatorio(20), codigo: codigoAleatorio() });
    sedes = [nueva.toObject()];
  }
  return sedes.map(sedeParaPanel);
}

/**
 * Ubicación de la sede a partir de lo que mande el panel: coordenadas del GPS
 * del dueño ({ lat, lng }) o un link de Google Maps (largo o corto).
 */
async function ubicacionDe(body) {
  const lat = Number(body.ubicacion?.lat);
  const lng = Number(body.ubicacion?.lng);
  if (coordsValidas(lat, lng)) return { ubicacion: { lat, lng }, mapsUrl: `https://maps.google.com/?q=${lat},${lng}` };
  const link = String(body.mapsUrl || '').trim();
  if (!link) return null;
  if (!esLinkMaps(link)) throw Object.assign(new Error('Pega un link de Google Maps (Compartir → Copiar vínculo).'), { status: 400 });
  let coords = coordsDeMaps(link);
  if (!coords) {
    // Link corto (maps.app.goo.gl): se abre para ver a dónde lleva.
    const r = await axios.get(link, {
      maxRedirects: 5,
      timeout: 8000,
      maxContentLength: 2 * 1024 * 1024,
      validateStatus: () => true,
      beforeRedirect: (opts) => {
        if (!esLinkMaps(`${opts.protocol}//${opts.hostname}${opts.path || '/maps'}`) && !/(^|\.)google\.[a-z.]+$/i.test(opts.hostname)) {
          throw new Error('Redirección fuera de Google Maps');
        }
      },
    });
    const final = r.request?.res?.responseUrl || '';
    coords = coordsDeMaps(final) || coordsDeMaps(typeof r.data === 'string' ? r.data.slice(0, 500000) : '');
  }
  if (!coords) throw Object.assign(new Error('No pudimos leer la ubicación de ese link. Abre el lugar en Google Maps, toca Compartir y copia el vínculo.'), { status: 400 });
  return { ubicacion: coords, mapsUrl: link };
}

router.get('/config', soloAdmin, async (req, res) => {
  try {
    const businessId = negocioDe(req);
    const [sedes, personas, cfg] = await Promise.all([
      sedesDe(businessId),
      AsistenciaPersona.find({ businessId }).sort({ nombre: 1 }).select('nombre activo sedes').lean(),
      AsistenciaConfig.findOne({ businessId }).lean(),
    ]);
    res.json({
      sedes,
      personas,
      telegram: {
        disponible: telegram.configurado(),
        bot: telegram.usuarioBot(),
        chat: cfg?.telegram?.chats?.[0] || null,
      },
    });
  } catch (err) {
    logger.error('asistencia config', err);
    res.status(500).json({ message: 'Error cargando la asistencia' });
  }
});

// Sedes
router.post('/sedes', soloAdmin, async (req, res) => {
  const nombre = String(req.body.nombre || '').trim().slice(0, 60);
  if (!nombre) return res.status(400).json({ message: 'Ponle un nombre a la sede.' });
  try {
    const lugar = await ubicacionDe(req.body);
    if (!lugar) return res.status(400).json({ message: 'Agrega la ubicación de la sede.' });
    const sede = await AsistenciaSede.create({ businessId: negocioDe(req), nombre, clave: codigoAleatorio(20), codigo: codigoAleatorio(), ...lugar });
    res.status(201).json(sedeParaPanel(sede));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('asistencia crear sede', err);
    res.status(500).json({ message: 'No se pudo crear la sede' });
  }
});

router.put('/sedes/:id', soloAdmin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Sede no encontrada' });
  try {
    const cambios = {};
    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim().slice(0, 60);
      if (!nombre) return res.status(400).json({ message: 'Ponle un nombre a la sede.' });
      cambios.nombre = nombre;
    }
    const lugar = await ubicacionDe(req.body);
    if (lugar) Object.assign(cambios, lugar);
    // Link nuevo: el anterior deja de funcionar (por si se filtró).
    if (req.body.nuevoLink) { cambios.clave = codigoAleatorio(20); cambios.codigo = codigoAleatorio(); }
    const sede = await AsistenciaSede.findOneAndUpdate({ _id: req.params.id, businessId: negocioDe(req) }, { $set: cambios }, { new: true }).lean();
    if (!sede) return res.status(404).json({ message: 'Sede no encontrada' });
    res.json(sedeParaPanel(sede));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    logger.error('asistencia editar sede', err);
    res.status(500).json({ message: 'No se pudo guardar la sede' });
  }
});

router.delete('/sedes/:id', soloAdmin, async (req, res) => {
  const businessId = negocioDe(req);
  if ((await AsistenciaSede.countDocuments({ businessId })) <= 1) {
    return res.status(400).json({ message: 'Tiene que quedar al menos una sede.' });
  }
  await AsistenciaSede.deleteOne({ _id: req.params.id, businessId });
  await AsistenciaPersona.updateMany({ businessId }, { $pull: { sedes: new mongoose.Types.ObjectId(req.params.id) } });
  res.json({ ok: true });
});

// Personas con PIN
async function sedesValidas(businessId, lista) {
  const ids = (Array.isArray(lista) ? lista : []).filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return [];
  const existen = await AsistenciaSede.find({ businessId, _id: { $in: ids } }).select('_id').lean();
  return existen.map((s) => s._id);
}

router.post('/personas', soloAdmin, async (req, res) => {
  const businessId = negocioDe(req);
  const nombre = String(req.body.nombre || '').trim().slice(0, 60);
  const pin = String(req.body.pin || '');
  if (!nombre) return res.status(400).json({ message: 'Escribe el nombre de la persona.' });
  if (!pinValido(pin)) return res.status(400).json({ message: 'El PIN son 4 números.' });
  try {
    const sedes = await sedesValidas(businessId, req.body.sedes);
    const p = await AsistenciaPersona.create({ businessId, nombre, pinHash: hashPin(businessId, pin), sedes });
    res.status(201).json({ _id: p._id, nombre: p.nombre, activo: p.activo, sedes: p.sedes });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Ese PIN ya lo tiene otra persona. Elige otro.' });
    logger.error('asistencia crear persona', err);
    res.status(500).json({ message: 'No se pudo crear' });
  }
});

router.put('/personas/:id', soloAdmin, async (req, res) => {
  const businessId = negocioDe(req);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Persona no encontrada' });
  const cambios = {};
  if (req.body.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim().slice(0, 60);
    if (!nombre) return res.status(400).json({ message: 'Escribe el nombre de la persona.' });
    cambios.nombre = nombre;
  }
  if (req.body.pin !== undefined && req.body.pin !== '') {
    if (!pinValido(req.body.pin)) return res.status(400).json({ message: 'El PIN son 4 números.' });
    cambios.pinHash = hashPin(businessId, String(req.body.pin));
  }
  if (req.body.activo !== undefined) cambios.activo = !!req.body.activo;
  try {
    if (req.body.sedes !== undefined) cambios.sedes = await sedesValidas(businessId, req.body.sedes);
    const p = await AsistenciaPersona.findOneAndUpdate({ _id: req.params.id, businessId }, { $set: cambios }, { new: true }).select('nombre activo sedes').lean();
    if (!p) return res.status(404).json({ message: 'Persona no encontrada' });
    res.json(p);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Ese PIN ya lo tiene otra persona. Elige otro.' });
    logger.error('asistencia editar persona', err);
    res.status(500).json({ message: 'No se pudo guardar' });
  }
});

router.delete('/personas/:id', soloAdmin, async (req, res) => {
  // Sus marcas se quedan (con el nombre copiado) para los reportes.
  await AsistenciaPersona.deleteOne({ _id: req.params.id, businessId: negocioDe(req) });
  res.json({ ok: true });
});

// Marcas para el reporte (el Excel se arma en el panel)
router.get('/marcas', soloAdmin, async (req, res) => {
  const desde = inicioDelDia(req.query.desde);
  const hastaInicio = inicioDelDia(req.query.hasta);
  if (!desde || !hastaInicio) return res.status(400).json({ message: 'Fechas inválidas' });
  const hasta = new Date(hastaInicio.getTime() + 24 * 60 * 60 * 1000);
  const businessId = negocioDe(req);
  const filtro = { businessId, fecha: { $gte: desde, $lt: hasta } };
  if (req.query.personaId && mongoose.isValidObjectId(req.query.personaId)) filtro.personaId = req.query.personaId;
  if (req.query.sedeId && mongoose.isValidObjectId(req.query.sedeId)) filtro.sedeId = req.query.sedeId;
  const [marcas, personas, sedes] = await Promise.all([
    AsistenciaMarca.find(filtro).sort({ fecha: 1 }).limit(20000).select('personaId nombre sedeId sedeNombre tipo fecha ubicacion distancia').lean(),
    AsistenciaPersona.find({ businessId }).select('nombre sedes').lean(),
    AsistenciaSede.find({ businessId }).select('nombre').lean(),
  ]);
  res.json({ marcas, personas, sedes });
});

// Telegram: una sola persona recibe todos los avisos.
router.post('/telegram/vincular', soloAdmin, async (req, res) => {
  if (!telegram.configurado()) return res.status(503).json({ message: 'El bot de Telegram todavía no está configurado en el servidor.' });
  const codigo = codigoAleatorio(10);
  await AsistenciaConfig.findOneAndUpdate(
    { businessId: negocioDe(req) },
    { $set: { 'telegram.vinculo': { codigo, expira: new Date(Date.now() + 30 * 60 * 1000) } } },
    { upsert: true },
  );
  res.json({ enlace: `https://t.me/${telegram.usuarioBot()}?start=${codigo}`, codigo });
});

router.post('/telegram/comprobar', soloAdmin, async (req, res) => {
  if (!telegram.configurado()) return res.status(503).json({ message: 'El bot de Telegram todavía no está configurado en el servidor.' });
  const businessId = negocioDe(req);
  try {
    const cfg = await AsistenciaConfig.findOne({ businessId }).lean();
    const vinculo = cfg?.telegram?.vinculo;
    if (!vinculo?.codigo || new Date(vinculo.expira) < new Date()) {
      return res.status(400).json({ message: 'El enlace se venció. Genera uno nuevo.' });
    }
    const chat = chatDelVinculo(await telegram.actualizaciones(), vinculo.codigo);
    if (!chat) return res.status(404).json({ message: 'Todavía no vemos tu mensaje. Abre el enlace, toca "Iniciar" en Telegram y vuelve a comprobar.' });

    // Reemplaza al anterior: los avisos le llegan a una sola persona.
    await AsistenciaConfig.updateOne({ businessId }, { $set: { 'telegram.chats': [chat], 'telegram.vinculo': { codigo: null, expira: null } } });
    const negocio = await BusinessConfig.findById(businessId).select('businessName').lean();
    telegram.enviar(chat.chatId, `✅ Listo. Aquí te avisaremos cada entrada y salida del equipo de <b>${(negocio?.businessName || '').replace(/</g, '&lt;')}</b>.`);
    res.json({ chat });
  } catch (err) {
    logger.error('asistencia telegram comprobar', err);
    res.status(500).json({ message: 'No se pudo comprobar con Telegram' });
  }
});

router.delete('/telegram', soloAdmin, async (req, res) => {
  await AsistenciaConfig.updateOne({ businessId: negocioDe(req) }, { $set: { 'telegram.chats': [] } });
  res.json({ chat: null });
});

module.exports = router;
