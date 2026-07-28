const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const MenuPopup = require('../Models/MenuPopup');
const PopupLead = require('../Models/PopupLead');
const { tenantAuth } = require('../middleware/tenantAuth');
const { resolveBusinessId } = require('../utils/businessResolver');
const { isValidObjectId } = require('../utils/validators');
const { stripHtml } = require('../utils/sanitize');
const logger = require('../utils/logger');

const FREQUENCIES = ['once', 'session', 'daily', 'always'];
const FORMATS = ['modal', 'bar-top', 'bar-bottom', 'toast', 'fullscreen'];
const FIELD_KEYS = ['name', 'email', 'phone', 'birthday'];
const FIELD_LABELS = { name: 'Nombre', email: 'Email', phone: 'Teléfono', birthday: 'Cumpleaños' };

// Normaliza la config del formulario que envía el admin
function sanitizeForm(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const seen = new Set();
  const fields = (Array.isArray(raw.fields) ? raw.fields : [])
    .filter(f => f && FIELD_KEYS.includes(f.key) && !seen.has(f.key) && seen.add(f.key))
    .map(f => ({
      key: f.key,
      label: stripHtml(String(f.label || FIELD_LABELS[f.key] || f.key)).slice(0, 40),
      required: !!f.required,
    }));
  return {
    enabled: !!raw.enabled,
    title: stripHtml(String(raw.title || '')).slice(0, 120),
    fields,
    submitText: stripHtml(String(raw.submitText || 'Enviar')).slice(0, 40) || 'Enviar',
    successMessage: stripHtml(String(raw.successMessage || '¡Gracias!')).slice(0, 200) || '¡Gracias!',
  };
}

// Limitar el tracking público para evitar inflado de métricas
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {},
});

// ─────────────── PÚBLICO (menú del cliente) ───────────────

// Popups vigentes de un negocio (activos + dentro de fechas)
router.get('/active', async (req, res) => {
  try {
    const raw = req.query.businessId;
    if (!raw) return res.status(400).json({ message: 'businessId requerido' });
    let businessId;
    try { businessId = await resolveBusinessId(raw); } catch { return res.json([]); }

    const now = new Date();
    const popups = await MenuPopup.find({
      businessId,
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ createdAt: -1 }).limit(5).lean();

    res.json(popups.map(p => ({
      _id: p._id,
      title: p.title,
      body: p.body,
      image: p.image,
      format: p.format || 'modal',
      ctaText: p.ctaText,
      ctaUrl: p.ctaUrl,
      form: p.form && p.form.enabled ? {
        enabled: true,
        title: p.form.title || '',
        fields: p.form.fields || [],
        submitText: p.form.submitText || 'Enviar',
        successMessage: p.form.successMessage || '¡Gracias!',
      } : { enabled: false },
      frequency: p.frequency,
      delaySeconds: p.delaySeconds,
    })));
  } catch (e) {
    logger.error('menu-popups active error', { error: e.message });
    res.status(500).json([]);
  }
});

// Registrar una impresión
router.post('/:id/view', trackLimiter, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({});
    await MenuPopup.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({});
  }
});

// Registrar un clic en el CTA
router.post('/:id/click', trackLimiter, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({});
    await MenuPopup.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({});
  }
});

// Enviar el formulario del popup (captura de lead)
router.post('/:id/submit', trackLimiter, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID inválido' });
    const popup = await MenuPopup.findById(req.params.id).lean();
    if (!popup || !popup.active || !popup.form || !popup.form.enabled) {
      return res.status(404).json({ message: 'Formulario no disponible' });
    }
    const data = (req.body && req.body.data) || {};
    for (const f of (popup.form.fields || [])) {
      if (f.required && !String(data[f.key] || '').trim()) {
        return res.status(400).json({ message: `El campo "${f.label || f.key}" es obligatorio` });
      }
    }
    const clean = (v, max) => stripHtml(String(v || '')).slice(0, max);
    await PopupLead.create({
      businessId: popup.businessId,
      popupId: popup._id,
      popupTitle: popup.title,
      name: clean(data.name, 120),
      email: clean(data.email, 160),
      phone: clean(data.phone, 40),
      birthday: clean(data.birthday, 20),
    });
    await MenuPopup.updateOne({ _id: popup._id }, { $inc: { submissions: 1 } });
    res.json({ ok: true, message: popup.form.successMessage || '¡Gracias!' });
  } catch (e) {
    logger.error('menu-popup submit error', { error: e.message });
    res.status(500).json({ message: 'Error al enviar el formulario' });
  }
});

// ─────────────── ADMIN (dueño del negocio) ───────────────

// Listar todos los popups del negocio (con estadísticas)
router.get('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const popups = await MenuPopup.find({ businessId }).sort({ createdAt: -1 }).lean();
    res.json(popups);
  } catch (e) {
    logger.error('menu-popups list error', { error: e.message });
    res.status(500).json({ message: 'Error al cargar los anuncios' });
  }
});

// Crear
router.post('/', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ message: 'El título es obligatorio' });
    }
    const popup = await MenuPopup.create({
      businessId,
      title: stripHtml(String(b.title)).slice(0, 120),
      body: stripHtml(String(b.body || '')).slice(0, 600),
      image: b.image || null,
      format: FORMATS.includes(b.format) ? b.format : 'modal',
      ctaText: stripHtml(String(b.ctaText || '')).slice(0, 40),
      ctaUrl: String(b.ctaUrl || '').slice(0, 500),
      form: sanitizeForm(b.form),
      active: b.active !== false,
      startsAt: b.startsAt ? new Date(b.startsAt) : null,
      endsAt: b.endsAt ? new Date(b.endsAt) : null,
      frequency: FREQUENCIES.includes(b.frequency) ? b.frequency : 'session',
      delaySeconds: Math.min(60, Math.max(0, parseInt(b.delaySeconds) || 1)),
    });
    res.status(201).json(popup);
  } catch (e) {
    logger.error('menu-popup create error', { error: e.message });
    res.status(500).json({ message: 'Error al crear el anuncio' });
  }
});

// Actualizar
router.patch('/:id', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID inválido' });
    const b = req.body || {};
    const update = {};
    if (b.title != null) update.title = stripHtml(String(b.title)).slice(0, 120);
    if (b.body != null) update.body = stripHtml(String(b.body)).slice(0, 600);
    if (b.image !== undefined) update.image = b.image || null;
    if (b.format && FORMATS.includes(b.format)) update.format = b.format;
    if (b.ctaText != null) update.ctaText = stripHtml(String(b.ctaText)).slice(0, 40);
    if (b.ctaUrl != null) update.ctaUrl = String(b.ctaUrl).slice(0, 500);
    if (b.form !== undefined) update.form = sanitizeForm(b.form);
    if (b.active != null) update.active = !!b.active;
    if (b.startsAt !== undefined) update.startsAt = b.startsAt ? new Date(b.startsAt) : null;
    if (b.endsAt !== undefined) update.endsAt = b.endsAt ? new Date(b.endsAt) : null;
    if (b.frequency && FREQUENCIES.includes(b.frequency)) update.frequency = b.frequency;
    if (b.delaySeconds != null) update.delaySeconds = Math.min(60, Math.max(0, parseInt(b.delaySeconds) || 1));

    const popup = await MenuPopup.findOneAndUpdate({ _id: req.params.id, businessId }, update, { new: true });
    if (!popup) return res.status(404).json({ message: 'Anuncio no encontrado' });
    res.json(popup);
  } catch (e) {
    logger.error('menu-popup update error', { error: e.message });
    res.status(500).json({ message: 'Error al actualizar el anuncio' });
  }
});

// Contactos capturados por un popup (lista JSON o exportación CSV)
router.get('/:id/leads', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID inválido' });
    const popup = await MenuPopup.findOne({ _id: req.params.id, businessId }).select('_id title').lean();
    if (!popup) return res.status(404).json({ message: 'Anuncio no encontrado' });

    const leads = await PopupLead.find({ businessId, popupId: popup._id })
      .sort({ createdAt: -1 }).limit(5000).lean();

    if (req.query.format === 'csv') {
      const rows = [['Fecha', 'Nombre', 'Email', 'Teléfono', 'Cumpleaños']];
      leads.forEach(l => rows.push([
        new Date(l.createdAt).toLocaleString('es-CO'),
        l.name || '', l.email || '', l.phone || '', l.birthday || '',
      ]));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="contactos-${popup._id}.csv"`);
      return res.send('﻿' + csv);
    }
    res.json(leads);
  } catch (e) {
    logger.error('menu-popup leads error', { error: e.message });
    res.status(500).json({ message: 'Error al cargar los contactos' });
  }
});

// Eliminar
router.delete('/:id', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID inválido' });
    const r = await MenuPopup.deleteOne({ _id: req.params.id, businessId });
    if (r.deletedCount === 0) return res.status(404).json({ message: 'Anuncio no encontrado' });
    res.json({ ok: true });
  } catch (e) {
    logger.error('menu-popup delete error', { error: e.message });
    res.status(500).json({ message: 'Error al eliminar el anuncio' });
  }
});

module.exports = router;
