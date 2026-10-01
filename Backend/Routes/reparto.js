/**
 * /api/reparto — la cara pública de las empresas de reparto y sus clientes.
 *
 * Público:
 *   GET  /empresa/:slug            la página de la empresa (sin datos internos)
 *   POST /empresa/:slug/entrar     un cliente entra con el usuario que le dio la empresa
 *   GET  /seguimiento/:token       quien recibe sigue su envío (sin sesión)
 *
 * Cliente de la empresa (con sesión):
 *   GET|PUT /cliente/yo            su perfil y su dirección de recogida habitual
 *   POST    /cliente/cotizar       precio antes de pedir
 *   POST    /cliente/envios        pedir un domi
 *   GET     /cliente/envios        sus envíos
 *   GET     /cliente/envios/:id
 *   POST    /cliente/envios/:id/cancelar
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const envios = require('../services/envios');
const logger = require('../utils/logger');

const envolver = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof envios.ErrorEnvio) return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  logger.error('Error en reparto', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});

const limiteEntrar = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Demasiados intentos. Espera unos minutos.' } });
const limitePublico = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { message: 'Demasiadas consultas.' } });
const limiteCliente = rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.headers.authorization || req.ip || '').slice(-40),
  message: { message: 'Vas muy rápido. Espera un momento.' },
});

router.get('/empresa/:slug', limitePublico, envolver(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await envios.paginaPublica(req.params.slug));
}));

router.post('/empresa/:slug/entrar', limiteEntrar, envolver(async (req, res) => {
  res.json(await envios.entrarCliente(req.params.slug, req.body || {}));
}));

router.get('/seguimiento/:token', limitePublico, envolver(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await envios.seguimientoPublico(req.params.token));
}));

const cliente = [limiteCliente, envios.autenticarCliente];

router.get('/cliente/yo', cliente, envolver(async (req, res) => {
  const p = req.empresa;
  res.json({
    cliente: { id: String(req.cliente._id), nombre: req.cliente.nombre, negocio: req.cliente.negocio, telefono: req.cliente.telefono, email: req.cliente.email, direccion: req.cliente.direccion, ubicacion: req.cliente.ubicacion?.lat ? req.cliente.ubicacion : null },
    empresa: { nombre: p.name, slug: p.slug, logo: p.logo || null, color: p.landing?.color || '#E11D2A', whatsapp: p.landing?.whatsapp || p.phone || '' },
  });
}));

router.put('/cliente/yo', cliente, envolver(async (req, res) => {
  const { direccion, ubicacion } = req.body || {};
  if (direccion !== undefined) req.cliente.direccion = String(direccion).trim().slice(0, 160);
  if (ubicacion !== undefined) {
    const lat = Number(ubicacion?.lat);
    const lng = Number(ubicacion?.lng);
    req.cliente.ubicacion = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }
  await req.cliente.save();
  res.json({ ok: true });
}));

router.post('/cliente/cotizar', cliente, envolver(async (req, res) => {
  res.json(await envios.cotizar(req.empresa, req.body || {}));
}));

router.post('/cliente/envios', cliente, envolver(async (req, res) => {
  res.status(201).json(await envios.crearEnvio(req.cliente, req.empresa, req.body || {}));
}));

router.get('/cliente/envios', cliente, envolver(async (req, res) => {
  res.json(await envios.listarEnviosCliente(req.cliente, { limite: parseInt(req.query.limite, 10) || 50 }));
}));

router.get('/cliente/envios/:id', cliente, envolver(async (req, res) => {
  res.json(envios.envioParaCliente((await envios.envioDeCliente(req.cliente, req.params.id)).toObject()));
}));

router.post('/cliente/envios/:id/cancelar', cliente, envolver(async (req, res) => {
  const e = await envios.envioDeCliente(req.cliente, req.params.id);
  res.json(await envios.cancelar(e, `el cliente (${req.cliente.negocio || req.cliente.nombre})`));
}));

module.exports = router;
