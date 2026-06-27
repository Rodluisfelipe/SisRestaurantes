const express = require('express');
const router = express.Router();
const Customer = require('../Models/Customer');
const BusinessConfig = require('../Models/BusinessConfig');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const COOLDOWN_HOURS = 24;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menuby.tech';

// GET /api/whatsapp-campaign/stats
// Returns: eligible customer count, last campaign time, cooldown status
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;

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
    const businessId = req.user.businessId;
    const { message } = req.body;

    if (!message || String(message).trim().length < 10) {
      return res.status(400).json({ message: 'El mensaje debe tener al menos 10 caracteres' });
    }
    if (String(message).length > 1000) {
      return res.status(400).json({ message: 'El mensaje no puede superar 1000 caracteres' });
    }

    // WhatsApp must be enabled
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return res.status(503).json({ message: 'WhatsApp no está activado en el servidor. Contacta al administrador de MenuBy.' });
    }

    const config = await BusinessConfig.findById(businessId, 'lastWhatsappCampaign businessName slug').lean();
    if (!config) return res.status(404).json({ message: 'Negocio no encontrado' });

    // Cooldown check
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    if (config.lastWhatsappCampaign && (new Date() - new Date(config.lastWhatsappCampaign)) < cooldownMs) {
      const next = new Date(new Date(config.lastWhatsappCampaign).getTime() + cooldownMs);
      return res.status(429).json({
        message: `Solo puedes enviar una campaña cada ${COOLDOWN_HOURS}h. Próxima disponible: ${next.toLocaleString('es-CO')}`
      });
    }

    // Fetch eligible customers
    const customers = await Customer.find(
      { businessId, whatsappOptOut: { $ne: true }, phone: { $exists: true, $ne: '' } },
      'phone name'
    ).lean();

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

    // Enqueue all messages (rate-limited by whatsappService)
    const { enqueueRaw } = require('../services/whatsappService');
    if (typeof enqueueRaw === 'function') {
      for (const customer of customers) {
        enqueueRaw(customer.phone, fullMessage);
      }
    }

    // Save last campaign date
    await BusinessConfig.findByIdAndUpdate(businessId, { lastWhatsappCampaign: new Date() });

    logger.info(`[WhatsApp Campaign] ${config.businessName} → ${customers.length} destinatarios`, null, req);

    const estimatedMinutes = Math.ceil(customers.length / 15);
    res.json({
      success: true,
      sent: customers.length,
      estimatedMinutes,
      message: `Campaña encolada para ${customers.length} clientes. Tiempo estimado: ~${estimatedMinutes} min`
    });
  } catch (err) {
    logger.error('Error sending WhatsApp campaign', err, req);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/whatsapp-campaign/optout/:customerId
router.post('/optout/:customerId', authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.customerId, businessId: req.user.businessId },
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
