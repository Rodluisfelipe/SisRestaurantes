const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const { sendTestEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * PUT /api/email/settings
 * Save email toggle configuration.
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { businessId, enabled,
            sendOnBookingConfirmed, sendOnBookingCancelled } = req.body;

    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const config = await BusinessConfig.findById(businessId);
    if (!config) return res.status(404).json({ message: 'Business not found' });

    config.emailSettings = {
      enabled: enabled !== false,
      sendOnBookingConfirmed: sendOnBookingConfirmed !== false,
      sendOnBookingCancelled: sendOnBookingCancelled !== false
    };
    await config.save();

    res.json({ message: 'Email settings saved', emailSettings: config.emailSettings });
  } catch (error) {
    logger.error('Error saving email settings', error);
    res.status(500).json({ message: 'Error saving email settings' });
  }
});

/**
 * POST /api/email/test
 * Send a test email to verify providers are working.
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const result = await sendTestEmail(businessId);
    
    if (result.success) {
      res.json({ message: `Correo de prueba enviado vía ${result.provider}.`, success: true });
    } else {
      res.status(400).json({ message: result.error || 'No se pudo enviar', success: false });
    }
  } catch (error) {
    logger.error('Error testing email', error);
    res.status(500).json({ message: 'Error testing email' });
  }
});

module.exports = router;
