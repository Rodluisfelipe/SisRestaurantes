const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { Lead } = require('../Models/Lead');
const { normalizarTelefono, actividad } = require('../services/leads');
const logger = require('../utils/logger');

/**
 * POST /api/leads — el formulario "Te llamamos" de la web de Menuby.
 *
 * Público, así que: límite por IP, un campo trampa que los bots llenan y los
 * humanos no ven, y si el teléfono ya es un lead se suma al que existe en vez
 * de duplicarlo.
 */
const limite = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Ya recibimos tus datos. Te contactamos pronto.' },
});

const limpio = (v, max = 120) => String(v ?? '').trim().slice(0, max);

router.post('/', limite, async (req, res) => {
  const b = req.body || {};
  // Campo trampa: invisible para personas. Si viene lleno, es un bot.
  if (limpio(b.sitioWeb)) return res.status(201).json({ ok: true });

  const telefono = normalizarTelefono(b.telefono);
  const nombre = limpio(b.nombre);
  if (!telefono) return res.status(400).json({ message: 'Escribe un número de WhatsApp válido.' });
  if (!nombre) return res.status(400).json({ message: 'Escribe tu nombre.' });

  const datos = {
    nombre,
    negocio: limpio(b.negocio),
    ciudad: limpio(b.ciudad, 80),
    tipoNegocio: limpio(b.tipoNegocio, 60),
    email: limpio(b.email, 160).toLowerCase(),
    origen: limpio(b.origen),
  };
  const mensaje = limpio(b.mensaje, 1000);

  try {
    let lead = await Lead.findOne({ telefono });
    if (lead) {
      for (const [k, v] of Object.entries(datos)) if (v && !lead[k]) lead[k] = v;
      await lead.save();
      await actividad(lead._id, 'sistema', `Volvió a dejar sus datos en la web${datos.origen ? ` (${datos.origen})` : ''}${mensaje ? `: "${mensaje}"` : ''}`);
    } else {
      lead = await Lead.create({ ...datos, telefono, fuente: 'formulario' });
      await actividad(lead._id, 'sistema', `Dejó sus datos en la web${datos.origen ? ` (${datos.origen})` : ''}${mensaje ? `: "${mensaje}"` : ''}`);
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    logger.error('[CRM] Formulario público', { error: e.message });
    res.status(500).json({ message: 'No se pudo enviar. Escríbenos por WhatsApp.' });
  }
});

module.exports = router;
