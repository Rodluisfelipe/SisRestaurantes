/**
 * /api/domi-app — la app del domiciliario (v2) y el cuadre desde el panel.
 *
 * App (token de domi v2):
 *   POST /entrar            celular + PIN → sesión
 *   POST /renovar           sesión larga sin volver a escribir el PIN
 *   POST /salir
 *   GET  /estado            todo en una sola llamada: pedidos, ofertas, plata
 *   POST /disponible        conectarse / desconectarse
 *   POST /ubicacion         puntos de GPS (en vivo o acumulados sin señal)
 *   POST /push              token de notificaciones
 *   POST /ofertas/:id/aceptar | /rechazar
 *   POST /eventos           llegué / recogí / llegué al cliente / entregué / no pude
 *   POST /pedidos/:id/foto  foto de prueba de entrega
 *   GET  /ganancias         por día
 *   GET  /cuadre            efectivo y pagos pendientes, por negocio
 *
 * Panel (sesión del negocio):
 *   GET  /negocio/cuadre           cuánto trae cada domi y cuánto se le debe
 *   POST /negocio/liquidar         cerrar el cuadre de un domi
 *   GET  /negocio/liquidaciones
 *   GET|PUT /negocio/reglas        cómo se paga, cuántos pedidos a la vez, fotos del local
 *   GET|POST /negocio/domis        sus domiciliarios (y los de la Red asignados); crear
 *   PATCH /negocio/domis/:id       nombre / activo · POST /negocio/domis/:id/pin
 *   GET  /negocio/pedidos/:id/domis      quién puede llevar este pedido
 *   POST /negocio/pedidos/:id/asignar | /automatico | /quitar
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const router = express.Router();
const { tenantAuth } = require('../middleware/tenantAuth');
const servicio = require('../services/domiApp');
const logger = require('../utils/logger');

const foto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

const limiteEntrar = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos.' },
});

/* Un domi en ruta manda GPS cada pocos segundos y consulta su estado seguido;
   el límite es por persona (token), no por IP: varios domis comparten el
   mismo wifi del local. */
const limiteApp = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  keyGenerator: (req) => (req.headers.authorization || req.ip || '').slice(-40),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Vas muy rápido. Espera un momento.' },
});

/** Express 4 no atrapa errores de funciones async. */
const envolver = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof servicio.ErrorDomi) return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  logger.error('Error en la app del domi', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});

/* ═══════════ App ═══════════ */

router.post('/entrar', limiteEntrar, envolver(async (req, res) => {
  const { telefono, pin, clave, dispositivo } = req.body || {};
  res.json(await servicio.entrar({ telefono, pin, clave, dispositivo }));
}));

router.post('/renovar', limiteEntrar, envolver(async (req, res) => {
  res.json(await servicio.renovar(req.body?.renovacion));
}));

/* ═══════════ Registro de domis independientes (Red MenuBy) ═══════════ */

const red = require('../services/red');
const envolverRed = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof red.ErrorRed) return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  logger.error('Error en el registro de domi', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});

const limiteCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Pediste demasiados códigos. Espera unos minutos.' },
});

const fotosRegistro = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
}).fields([{ name: 'frente', maxCount: 1 }, { name: 'reverso', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]);

router.post('/registro/codigo', limiteCodigo, envolverRed(async (req, res) => {
  res.json(await red.enviarCodigo(req.body?.telefono, req.body?.email));
}));

router.post('/registro/verificar', limiteEntrar, envolverRed(async (req, res) => {
  res.json(await red.verificarCodigo(req.body?.telefono, req.body?.codigo));
}));

router.post('/registro', limiteEntrar, fotosRegistro, envolverRed(async (req, res) => {
  const f = req.files || {};
  res.json(await red.registrar(req.body || {}, { frente: f.frente?.[0], reverso: f.reverso?.[0], selfie: f.selfie?.[0] }));
}));

const app = [limiteApp, servicio.autenticar];

router.post('/salir', app, envolver(async (req, res) => {
  await servicio.salir(req.domi.telefono);
  res.json({ ok: true });
}));

router.get('/estado', app, envolver(async (req, res) => {
  res.json(await servicio.estado(req.domi));
}));

router.post('/disponible', app, envolver(async (req, res) => {
  const { enLinea, lat, lng, integridad } = req.body || {};
  res.json(await servicio.ponerDisponible(req.domi, { enLinea, lat, lng, integridad }));
}));

router.post('/ubicacion', app, envolver(async (req, res) => {
  res.json(await servicio.registrarUbicacion(req.domi, req.body?.puntos));
}));

/* La ruta por las calles (Mapbox): orden con tiempos reales y geometría para
   dibujarla. Si no hay llave o Mapbox falla, responde { aproximada: true } y
   la app sigue con su plan en línea recta. */
router.post('/ruta', app, envolver(async (req, res) => {
  const { yo, paradas } = req.body || {};
  const plan = await require('../services/rutas').planRuta(yo, paradas);
  res.json(plan || { aproximada: true });
}));

router.post('/push', app, envolver(async (req, res) => {
  await servicio.guardarPush(req.domi, req.body?.token, req.body?.llamadas);
  res.json({ ok: true });
}));

router.post('/ofertas/:id/aceptar', app, envolver(async (req, res) => {
  res.json(await servicio.responderOferta(req.domi, req.params.id, true));
}));

router.post('/ofertas/:id/rechazar', app, envolver(async (req, res) => {
  res.json(await servicio.responderOferta(req.domi, req.params.id, false));
}));

router.post('/eventos', app, envolver(async (req, res) => {
  res.json(await servicio.aplicarEventos(req.domi, req.body?.eventos));
}));

router.post('/pedidos/:id/foto', app, foto.single('foto'), envolver(async (req, res) => {
  res.json(await servicio.subirFotoEntrega(req.domi, req.params.id, req.file));
}));

router.get('/ganancias', app, envolver(async (req, res) => {
  res.json(await servicio.ganancias(req.domi, { desde: req.query.desde, hasta: req.query.hasta }));
}));

router.get('/cuadre', app, envolver(async (req, res) => {
  const [cuadres, historial] = await Promise.all([servicio.cuadre(req.domi), servicio.liquidacionesDomi(req.domi)]);
  res.json({ cuadres, historial });
}));

/* ═══════════ Panel del negocio ═══════════ */

function negocioDe(req, res) {
  if (req.user?.scope === 'pos') { res.status(403).json({ message: 'Esta consulta es del panel' }); return null; }
  const businessId = req.user?.businessId || req.resolvedBusinessId || req.query.businessId || req.body?.businessId;
  if (!businessId) { res.status(400).json({ message: 'businessId es requerido' }); return null; }
  return businessId;
}

router.get('/negocio/cuadre', tenantAuth, envolver(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await servicio.cuadreNegocio(businessId));
}));

router.post('/negocio/liquidar', tenantAuth, envolver(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  const quien = req.user?.name || req.user?.username || '';
  res.json(await servicio.liquidar(businessId, req.body || {}, quien));
}));

router.get('/negocio/liquidaciones', tenantAuth, envolver(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await servicio.liquidacionesNegocio(businessId, { limite: parseInt(req.query.limite, 10) || 50 }));
}));

router.get('/negocio/reglas', tenantAuth, envolver(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await servicio.reglasNegocio(businessId));
}));

router.put('/negocio/reglas', tenantAuth, envolver(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  if (req.user?.role === 'staff') return res.status(403).json({ message: 'Solo el administrador cambia cómo se paga a los domis' });
  res.json(await servicio.guardarReglasNegocio(businessId, req.body || {}));
}));

/* ═══════════ Panel: domiciliarios y enviar pedidos (services/panelDomis.js) ═══════════ */

const panel = require('../services/panelDomis');
const envolverPanel = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof panel.ErrorPanel) return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  logger.error('Error en domiciliarios del panel', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});
const soloAdmin = (req, res) => {
  if (req.user?.role === 'staff') { res.status(403).json({ message: 'Solo el administrador maneja los domiciliarios' }); return false; }
  return true;
};
const quien = (req) => req.user?.name || req.user?.username || '';

router.get('/negocio/domis', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await panel.listarDomis(businessId));
}));

router.post('/negocio/domis', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId || !soloAdmin(req, res)) return;
  res.status(201).json(await panel.crearDomi(businessId, req.body || {}));
}));

router.patch('/negocio/domis/:id', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId || !soloAdmin(req, res)) return;
  res.json(await panel.editarDomi(businessId, req.params.id, req.body || {}));
}));

router.post('/negocio/domis/:id/pin', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId || !soloAdmin(req, res)) return;
  res.json(await panel.cambiarPin(businessId, req.params.id, req.body?.pin));
}));

router.get('/negocio/pedidos/:id/domis', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await panel.candidatos(businessId, req.params.id));
}));

router.post('/negocio/pedidos/:id/asignar', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await panel.asignar(businessId, req.params.id, req.body?.driverId, quien(req)));
}));

router.post('/negocio/pedidos/:id/automatico', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await panel.automatico(businessId, req.params.id));
}));

router.post('/negocio/pedidos/:id/quitar', tenantAuth, envolverPanel(async (req, res) => {
  const businessId = negocioDe(req, res);
  if (!businessId) return;
  res.json(await panel.quitar(businessId, req.params.id, quien(req)));
}));

module.exports = router;
