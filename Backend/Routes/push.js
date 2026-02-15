const express = require('express');
const router = express.Router();
const PushSubscription = require('../Models/PushSubscription');
const { resolveBusinessId } = require('../utils/businessResolver');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

// Validación de entrada para suscripción push
const validatePushSubscriptionInput = (req, res, next) => {
  const errors = [];
  const { businessId, endpoint, keys } = req.body;
  
  if (!businessId) { errors.push({ field: 'businessId', message: 'businessId es requerido' }); }
  else if (typeof businessId !== 'string') { errors.push({ field: 'businessId', message: 'businessId debe ser un string' }); }
  
  if (!endpoint) { errors.push({ field: 'endpoint', message: 'endpoint es requerido' }); }
  else if (typeof endpoint !== 'string') { errors.push({ field: 'endpoint', message: 'endpoint debe ser un string' }); }
  
  if (!keys) { errors.push({ field: 'keys', message: 'keys es requerido' }); }
  else if (typeof keys !== 'object' || !keys.p256dh || !keys.auth) { errors.push({ field: 'keys', message: 'keys debe contener p256dh y auth' }); }
  
  if (errors.length > 0) {
    return res.status(400).json(formatHttpError(req, 'Errores de validación en la entrada', 400, errors));
  }
  next();
};

// POST /api/push/subscribe - Registrar una nueva suscripción
router.post('/subscribe', validatePushSubscriptionInput, async (req, res) => {
  try {
    const { businessId, userId, endpoint, keys } = req.body;
    
    let resolvedBusinessId;
    try {
      resolvedBusinessId = await resolveBusinessId(businessId);
    } catch (error) {
      return res.status(404).json(formatHttpError(req, error.message, 404));
    }

    // Buscar si ya existe una suscripción con este endpoint
    let subscription = await PushSubscription.findOne({ endpoint });

    if (subscription) {
      // Actualizar si ya existe (por si cambian las keys o el estado)
      subscription.businessId = resolvedBusinessId;
      subscription.userId = userId;
      subscription.customerToken = req.body.customerToken || null;
      subscription.role = req.body.customerToken ? 'customer' : (userId ? 'admin' : 'admin');
      subscription.keys = keys;
      subscription.isActive = true; // Reactivar si estaba inactiva
      await subscription.save();
      logger.info('Updated existing push subscription', { id: subscription._id, businessId: resolvedBusinessId, userId, role: subscription.role }, req);
    } else {
      // Crear nueva suscripción
      subscription = new PushSubscription({
        businessId: resolvedBusinessId,
        userId,
        customerToken: req.body.customerToken || null,
        role: req.body.customerToken ? 'customer' : (userId ? 'admin' : 'admin'),
        endpoint,
        keys,
        isActive: true,
      });
      await subscription.save();
      logger.info('Created new push subscription', { id: subscription._id, businessId: resolvedBusinessId, userId, role: subscription.role }, req);
    }

    res.status(201).json({ message: 'Suscripción registrada exitosamente', subscriptionId: subscription._id });
  } catch (error) {
    logger.error('Error subscribing to push notifications', error, req);
    res.status(500).json(formatHttpError(req, 'Error al registrar la suscripción', 500));
  }
});

// POST /api/push/unsubscribe - Eliminar una suscripción
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json(formatHttpError(req, 'Endpoint es requerido', 400));
    }

    const result = await PushSubscription.deleteOne({ endpoint });

    if (result.deletedCount === 0) {
      return res.status(404).json(formatHttpError(req, 'Suscripción no encontrada', 404));
    }

    logger.info('Push subscription unsubscribed', { endpoint }, req);
    res.status(200).json({ message: 'Suscripción eliminada exitosamente' });
  } catch (error) {
    logger.error('Error unsubscribing from push notifications', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar la suscripción', 500));
  }
});

// GET /api/push/subscriptions - Obtener suscripciones por businessId (para debug/admin)
router.get('/subscriptions', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    let resolvedBusinessId;
    try {
      resolvedBusinessId = await resolveBusinessId(businessId);
    } catch (error) {
      return res.status(404).json(formatHttpError(req, error.message, 404));
    }

    const subscriptions = await PushSubscription.find({ businessId: resolvedBusinessId });
    res.status(200).json(subscriptions);
  } catch (error) {
    logger.error('Error fetching push subscriptions', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener suscripciones', 500));
  }
});

module.exports = router;
