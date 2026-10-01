/**
 * /api/superadmin/red — la Red MenuBy (domiciliarios independientes).
 *
 * Ver: cualquiera del equipo del superadmin. Decidir (aprobar, rechazar,
 * suspender), asignar negocios y cambiar la tarifa: admin hacia arriba, igual
 * que la revisión de identidad de Crew.
 */
const express = require('express');
const router = express.Router();
const { protectSuperAdmin, requireRole } = require('../middleware/authSuperAdmin');
const multer = require('multer');
const red = require('../services/red');
const desempeno = require('../services/desempenoDomi');
const beneficios = require('../services/beneficios');
const logger = require('../utils/logger');

router.use(protectSuperAdmin);

const envolver = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if ([red.ErrorRed, desempeno.ErrorDesempeno, beneficios.ErrorBeneficio].some((C) => e instanceof C)) {
    return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  }
  logger.error('Error en la Red MenuBy (superadmin)', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});
const quien = (req) => req.user?.name || req.user?.email || req.user?.username || 'superadmin';

router.get('/repartidores', envolver(async (req, res) => {
  res.json(await red.listar({ estado: req.query.estado || 'pendiente', q: req.query.q || '', pagina: parseInt(req.query.pagina, 10) || 1 }));
}));

router.get('/repartidores/:id/documentos', envolver(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await red.documentos(req.params.id));
}));

for (const accion of ['aprobar', 'rechazar', 'suspender']) {
  router.post(`/repartidores/:id/${accion}`, requireRole('admin'), envolver(async (req, res) => {
    res.json(await red.decidir(req.params.id, accion, { motivo: req.body?.motivo, quien: quien(req) }));
  }));
}

router.put('/repartidores/:id/negocios', requireRole('admin'), envolver(async (req, res) => {
  res.json(await red.asignarNegocios(req.params.id, req.body?.negocios));
}));

/** Buscar negocios para asignarlos (nombre o slug). */
router.get('/negocios', envolver(async (req, res) => {
  const BusinessConfig = require('../Models/BusinessConfig');
  const t = String(req.query.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 40);
  const filtro = t ? { $or: [{ businessName: new RegExp(t, 'i') }, { slug: new RegExp(t, 'i') }] } : {};
  const lista = await BusinessConfig.find(filtro).select('businessName slug logo location.address').sort({ businessName: 1 }).limit(20).lean();
  res.json(lista.map((b) => ({ id: String(b._id), nombre: b.businessName, slug: b.slug, logo: b.logo || null, direccion: b.location?.address || '' })));
}));

router.get('/config', envolver(async (req, res) => {
  res.json(await red.leerConfig());
}));

router.put('/config', requireRole('admin'), envolver(async (req, res) => {
  res.json(await red.guardarConfig({ tarifa: req.body?.tarifa, lluviaHoras: req.body?.lluviaHoras }, quien(req)));
}));

/** Simulador: cuánto ganaría un domi con estos datos (para ajustar la tarifa con confianza). */
router.post('/simular', envolver(async (req, res) => {
  const { calcularTarifa } = require('../utils/tarifaRed');
  const b = req.body || {};
  const { tarifa } = await red.leerConfig();
  res.json(calcularTarifa({
    kmEntrega: b.kmEntrega, kmRecogida: b.kmRecogida, demanda: b.demanda, oferta: b.oferta, lluvia: !!b.lluvia,
    fecha: b.hora ? new Date(`2026-01-01T${String(b.hora).padStart(5, '0')}:00-05:00`) : new Date(),
  }, b.tarifa || tarifa));
}));

/* ═══════════ Faltas y reclamos de los domis ═══════════ */

router.get('/faltas', envolver(async (req, res) => {
  res.json(await desempeno.listarFaltas({ estado: req.query.estado || 'en_revision', q: req.query.q || '', pagina: parseInt(req.query.pagina, 10) || 1 }));
}));

router.post('/faltas/:id/resolver', requireRole('admin'), envolver(async (req, res) => {
  res.json(await desempeno.resolverFalta(req.params.id, { anular: req.body?.anular === true, respuesta: req.body?.respuesta }, quien(req)));
}));

// Día difícil (lluvia, paro, caída): ninguna falta de ese día cuenta
router.post('/faltas/perdonar-dia', requireRole('admin'), envolver(async (req, res) => {
  res.json(await desempeno.perdonarDia(req.body?.fecha, quien(req)));
}));

/* ═══════════ Beneficios para los domis ═══════════ */

const imagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
}).single('imagen');

router.get('/beneficios', envolver(async (req, res) => {
  res.json(await beneficios.listarAdmin());
}));

router.post('/beneficios', requireRole('admin'), imagen, envolver(async (req, res) => {
  res.status(201).json(await beneficios.crear(req.body || {}, req.file, quien(req)));
}));

router.patch('/beneficios/:id', requireRole('admin'), imagen, envolver(async (req, res) => {
  res.json(await beneficios.editar(req.params.id, req.body || {}, req.file));
}));

router.delete('/beneficios/:id', requireRole('admin'), envolver(async (req, res) => {
  res.json(await beneficios.eliminar(req.params.id));
}));

router.get('/beneficios/:id/canjes', envolver(async (req, res) => {
  res.json(await beneficios.canjesAdmin(req.params.id));
}));

module.exports = router;
