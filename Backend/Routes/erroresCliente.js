const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const logger = require('../utils/logger');

/**
 * POST /api/errores-cliente — un error que tumbó una pantalla en el navegador.
 *
 * El usuario ve solo un código corto ("MB-K3X9QZ"); el detalle técnico queda
 * acá, en los logs del servidor, para buscarlo por ese código cuando alguien
 * lo reporte. Público (el error puede pasar antes de iniciar sesión), con
 * límite por IP y todo recortado.
 */
const limite = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false },
});

const corto = (v, max) => String(v ?? '').slice(0, max);

router.post('/', limite, (req, res) => {
  const b = req.body || {};
  const codigo = corto(b.codigo, 20);
  if (!/^MB-[A-Z0-9]{4,12}$/.test(codigo)) return res.status(400).json({ ok: false });
  logger.warn('[ErrorCliente]', {
    codigo,
    tipo: corto(b.tipo, 30),
    mensaje: corto(b.mensaje, 500),
    stack: corto(b.stack, 2000),
    componente: corto(b.componente, 1500),
    url: corto(b.url, 300),
    seccion: corto(b.seccion, 80),
    navegador: corto(req.get('user-agent'), 250),
  });
  res.status(201).json({ ok: true });
});

module.exports = router;
