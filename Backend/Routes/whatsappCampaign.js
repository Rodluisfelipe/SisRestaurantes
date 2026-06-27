const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const COOLDOWN_HOURS = 24;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menuby.tech';

// Resolve businessId: query param (works for SuperAdmin too) → JWT → Admin doc
async function resolveBusinessId(req) {
  if (req.query.businessId) return req.query.businessId;
  if (req.body.businessId) return req.body.businessId;
  if (req.user.businessId) return req.user.businessId;
  const admin = await Admin.findById(req.user.id, 'businessId').lean();
  return admin?.businessId || null;
}

// GET /api/whatsapp-campaign/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'No se pudo determinar el negocio' });

    const [count, config] = await Promise.all([
      Customer.countDocuments({ businessId, whatsappOptOut: { $ne: true }, phone: { $exists: true, $ne: '' } }),
      BusinessConfig.findById(businessId, 'lastWhatsappCampaign businessName slug').lean()
    ]);

    const last = config?.lastWhatsappCampaign ? new Date(config.lastWhatsappCampaign) : null;
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const nextAllowed = last ? new Date(last.getTime() + cooldownMs) : null;
    const canSend = !nextAllowed || new Date() >= nextAllowed;

    res.json({
      eligibleCount: count,
      lastCampaign: last,
      nextAllowed,
      canSend,
      cooldownHours: COOLDOWN_HOURS,
      menuLink: `${FRONTEND_URL}/${config?.slug || ''}`,
      businessName: config?.businessName || ''
    });
  } catch (err) {
    logger.error('Error fetching campaign stats', err, req);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/whatsapp-campaign/send
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'No se pudo determinar el negocio' });

    const { message } = req.body;

    if (!message || String(message).trim().length < 10) {
      return res.status(400).json({ message: 'El mensaje debe tener al menos 10 caracteres' });
    }
    if (String(message).length > 1000) {
      return res.status(400).json({ message: 'El mensaje no puede superar 1000 caracteres' });
    }

    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return res.status(503).json({ message: 'WhatsApp no está activado en el servidor. Contacta al administrador de MenuBy.' });
    }

    const config = await BusinessConfig.findById(businessId, 'lastWhatsappCampaign businessName slug').lean();
    if (!config) return res.status(404).json({ message: 'Negocio no encontrado' });

    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    if (config.lastWhatsappCampaign && (new Date() - new Date(config.lastWhatsappCampaign)) < cooldownMs) {
      const next = new Date(new Date(config.lastWhatsappCampaign).getTime() + cooldownMs);
      return res.status(429).json({
        message: `Solo puedes enviar una campaña cada ${COOLDOWN_HOURS}h. Próxima disponible: ${next.toLocaleString('es-CO')}`
      });
    }

    const { selectedIds } = req.body;
    const baseFilter = { businessId, whatsappOptOut: { $ne: true }, phone: { $exists: true, $ne: '' } };
    if (selectedIds?.length) baseFilter._id = { $in: selectedIds };

    const customers = await Customer.find(baseFilter, 'phone name').lean();

    if (customers.length === 0) {
      return res.status(400).json({ message: 'No hay clientes con teléfono registrado para enviar' });
    }

    const menuLink = `${FRONTEND_URL}/${config.slug}`;
    const fullMessage = [
      `📢 *${config.businessName}*`,
      '',
      message.trim(),
      '',
      `🔗 Ver menú: ${menuLink}`,
      '',
      `_Para no recibir más mensajes, responde "STOP"_`
    ].join('\n');

    const { enqueueRaw } = require('../services/whatsappService');
    if (typeof enqueueRaw === 'function') {
      for (const customer of customers) {
        enqueueRaw(customer.phone, fullMessage);
      }
    }

    await BusinessConfig.findByIdAndUpdate(businessId, { lastWhatsappCampaign: new Date() });

    logger.info(`[WhatsApp Campaign] ${config.businessName} → ${customers.length} destinatarios`, null, req);

    res.json({
      success: true,
      sent: customers.length,
      estimatedMinutes: Math.ceil(customers.length / 15),
      message: `Campaña encolada para ${customers.length} clientes. Tiempo estimado: ~${Math.ceil(customers.length / 15)} min`
    });
  } catch (err) {
    logger.error('Error sending WhatsApp campaign', err, req);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/whatsapp-campaign/customers — lista de clientes elegibles con info básica
router.get('/customers', authMiddleware, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'No se pudo determinar el negocio' });

    const customers = await Customer.find(
      { businessId, whatsappOptOut: { $ne: true }, phone: { $exists: true, $ne: '' } },
      'name phone status totalOrders totalSpent lastOrderDate tags'
    ).sort({ lastOrderDate: -1 }).lean();

    res.json({ customers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/whatsapp-campaign/optout/:customerId
router.post('/optout/:customerId', authMiddleware, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.customerId, businessId },
      { whatsappOptOut: true },
      { new: true }
    );
    if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
