/**
 * /api/beneficios — lo público de los beneficios para domiciliarios.
 *
 * Lo usa la página de cada beneficio (que puede vivir en otro dominio, por eso
 * va con CORS abierto en server.js; no maneja sesiones ni datos privados):
 *   GET  /                        los beneficios activos
 *   POST /:id/canjear { codigo }  pide el canje con el código del domi → le llega un correo
 *   GET  /:id/estado?codigo=      ¿ese código ya lo canjeó? (sin datos de la persona)
 *   GET  /confirmar?t=            el enlace del correo: confirma y muestra el comprobante
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const beneficios = require('../services/beneficios');
const logger = require('../utils/logger');

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos.' },
});

const envolver = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  if (e instanceof beneficios.ErrorBeneficio) return res.status(e.status).json({ message: e.message, codigo: e.codigo });
  logger.error('Error en beneficios (público)', e, req);
  res.status(500).json({ message: 'Algo falló. Intenta de nuevo.' });
});

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · MenuBy Go</title>
<style>
  body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5f5f4;color:#0f172a}
  main{max-width:440px;margin:0 auto;padding:40px 18px;text-align:center}
  .tarjeta{background:#fff;border-radius:20px;padding:28px 22px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-size:22px;margin:12px 0 6px} p{color:#475569;line-height:1.5;font-size:15px;margin:0 0 14px}
  .icono{width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:32px}
  .ok{background:#dcfce7} .mal{background:#fee2e2}
  img.ben{width:100%;max-height:180px;object-fit:cover;border-radius:14px;margin:0 0 14px}
  .comp{display:inline-block;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:14px;padding:12px 22px;font-size:28px;font-weight:800;letter-spacing:6px;margin:4px 0 14px}
  .dato{font-size:13px;color:#64748b} a.boton{display:inline-block;background:#D30310;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:12px;margin-top:6px}
</style></head><body><main><div class="tarjeta">${cuerpo}</div><p class="dato" style="margin-top:16px">MenuBy Go</p></main></body></html>`;
}

router.get('/', envolver(async (req, res) => {
  res.json(await beneficios.publicos());
}));

router.get('/confirmar', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const r = await beneficios.confirmar(req.query.t);
    const b = r.beneficio;
    res.send(pagina('Canje confirmado', `
      ${b?.imagen ? `<img class="ben" src="${esc(b.imagen)}" alt="">` : '<div class="icono ok">✓</div>'}
      <h1>¡Canje confirmado!</h1>
      <p>${esc(b?.titulo || 'Tu beneficio')}</p>
      <div class="comp">${esc(r.comprobante)}</div>
      <p class="dato">Comprobante del canje · Código del domi ${esc(r.codigo)}</p>
      ${b?.enlace ? `<a class="boton" href="${esc(b.enlace)}">Ver el beneficio</a>` : ''}`));
  } catch (e) {
    const msg = e instanceof beneficios.ErrorBeneficio ? e.message : 'Algo falló. Intenta de nuevo.';
    if (!(e instanceof beneficios.ErrorBeneficio)) logger.error('Error confirmando canje', e, req);
    res.status(e.status || 500).send(pagina('No se pudo confirmar', `<div class="icono mal">!</div><h1>No se pudo confirmar</h1><p>${esc(msg)}</p>`));
  }
});

router.post('/:id/canjear', limite, envolver(async (req, res) => {
  const r = await beneficios.pedirCanje(req.params.id, { codigo: req.body?.codigo, origen: 'web' });
  // El enlace de prueba (sin correo configurado) jamás sale por la página pública
  const { enlacePrueba, ...publico } = r;
  res.json(publico);
}));

router.get('/:id/estado', limite, envolver(async (req, res) => {
  res.json(await beneficios.estadoPorCodigo(req.params.id, req.query.codigo));
}));

module.exports = router;
