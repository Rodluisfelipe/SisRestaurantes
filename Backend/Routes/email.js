const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const { encrypt, sendTestEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * PUT /api/email/settings
 * Save email configuration (encrypts the app password before storing).
 * Requires admin auth.
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { businessId, senderEmail, senderName, appPassword, enabled,
            sendOnBookingCreated, sendOnBookingConfirmed, sendOnBookingCancelled, sendReminder } = req.body;

    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const config = await BusinessConfig.findById(businessId);
    if (!config) return res.status(404).json({ message: 'Business not found' });

    // Build the update object
    const emailSettings = {
      enabled: enabled !== false,
      senderEmail: (senderEmail || '').trim(),
      senderName: (senderName || '').trim(),
      sendOnBookingCreated: sendOnBookingCreated !== false,
      sendOnBookingConfirmed: sendOnBookingConfirmed !== false,
      sendOnBookingCancelled: sendOnBookingCancelled !== false,
      sendReminder: sendReminder !== false
    };

    // Only update password if provided (allows changing other settings without resetting password)
    if (appPassword && appPassword.trim()) {
      emailSettings.appPassword = encrypt(appPassword.trim());
    } else {
      // Keep existing password
      emailSettings.appPassword = config.emailSettings?.appPassword || '';
    }

    config.emailSettings = emailSettings;
    await config.save();

    res.json({
      message: 'Email settings saved',
      emailSettings: {
        enabled: emailSettings.enabled,
        senderEmail: emailSettings.senderEmail,
        senderName: emailSettings.senderName,
        hasAppPassword: !!emailSettings.appPassword,
        sendOnBookingCreated: emailSettings.sendOnBookingCreated,
        sendOnBookingConfirmed: emailSettings.sendOnBookingConfirmed,
        sendOnBookingCancelled: emailSettings.sendOnBookingCancelled,
        sendReminder: emailSettings.sendReminder
      }
    });
  } catch (error) {
    logger.error('Error saving email settings', error);
    res.status(500).json({ message: 'Error saving email settings' });
  }
});

/**
 * POST /api/email/test
 * Send a test email to verify the configuration works.
 * Does NOT save the password — just tests in-memory.
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { senderEmail, appPassword, senderName, businessId } = req.body;

    if (!senderEmail || !appPassword) {
      return res.status(400).json({ message: 'senderEmail and appPassword are required' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      return res.status(400).json({ message: 'Formato de email inválido' });
    }

    const result = await sendTestEmail(senderEmail, appPassword, senderName);
    
    if (result.success) {
      res.json({ message: 'Correo de prueba enviado exitosamente. Revisa tu bandeja de entrada.', success: true });
    } else {
      // Parse common Gmail errors for friendly messages
      let friendlyError = result.error;
      if (result.error?.includes('Invalid login') || result.error?.includes('Username and Password not accepted')) {
        friendlyError = 'Credenciales inválidas. Verifica tu email y contraseña de aplicación de Google.';
      } else if (result.error?.includes('less secure')) {
        friendlyError = 'Debes activar la verificación en 2 pasos y generar una contraseña de aplicación en tu cuenta de Google.';
      }
      res.status(400).json({ message: friendlyError, success: false });
    }
  } catch (error) {
    logger.error('Error testing email', error);
    res.status(500).json({ message: 'Error testing email' });
  }
});

module.exports = router;
