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
  
  // Validar businessId
  if (!businessId) {
    errors.push({ field: 'businessId', message: 'businessId es requerido' });
  } else if (typeof businessId !== 'string') {
    errors.push({ field: 'businessId', message: 'businessId debe ser un string' });
  }
  
  // Validar endpoint
  if (!endpoint) {
    errors.push({ field: 'endpoint', message: 'endpoint es requerido' });
  } else if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    errors.push({ field: 'endpoint', message: 'endpoint debe ser una URL HTTPS válida' });
  }
  
  // Validar keys
  if (!keys) {
    errors.push({ field: 'keys', message: 'keys es requerido' });
  } else {
    if (!keys.p256dh || typeof keys.p256dh !== 'string') {
      errors.push({ field: 'keys.p256dh', message: 'keys.p256dh es requerido y debe ser string' });
    }
    if (!keys.auth || typeof keys.auth !== 'string') {
      errors.push({ field: 'keys.auth', message: 'keys.auth es requerido y debe ser string' });
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

// POST /api/push/subscribe - Suscribirse a notificaciones push
router.post('/subscribe', validatePushSubscriptionInput, async (req, res) => {
  try {
    const { businessId, userId, endpoint, keys } = req.body;
    const userAgent = req.get('user-agent') || '';

    // Resolver businessId (puede ser slug o ObjectId)
    let resolvedBusinessId;
    try {
      resolvedBusinessId = await resolveBusinessId(businessId);
    } catch (error) {
      return res.status(404).json(formatHttpError(req, 'Business not found', 404));
    }

    // Verificar si ya existe una suscripción con este endpoint
    let subscription = await PushSubscription.findOne({ endpoint });

    if (subscription) {
      // Actualizar suscripción existente
      subscription.businessId = resolvedBusinessId;
      subscription.userId = userId || subscription.userId;
      subscription.keys = keys;
      subscription.userAgent = userAgent;
      subscription.isActive = true;
      await subscription.save();

      logger.info('Push subscription updated', { 
        subscriptionId: subscription._id,
        businessId: resolvedBusinessId 
      }, req);

      return res.status(200).json({
        success: true,
        message: 'Suscripción actualizada exitosamente',
        subscriptionId: subscription._id
      });
    }

    // Crear nueva suscripción
    subscription = new PushSubscription({
      businessId: resolvedBusinessId,
      userId: userId || undefined,
      endpoint,
      keys,
      userAgent,
      isActive: true
    });

    await subscription.save();

    logger.info('Push subscription created', { 
      subscriptionId: subscription._id,
      businessId: resolvedBusinessId 
    }, req);

    res.status(201).json({
      success: true,
      message: 'Suscripción creada exitosamente',
      subscriptionId: subscription._id
    });
  } catch (error) {
    logger.error('Error creating push subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear suscripción push', 500));
  }
});

// POST /api/push/unsubscribe - Desuscribirse de notificaciones push
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json(formatHttpError(req, 'endpoint es requerido', 400));
    }

    const subscription = await PushSubscription.findOneAndDelete({ endpoint });

    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'Suscripción no encontrada', 404));
    }

    logger.info('Push subscription removed', { 
      subscriptionId: subscription._id,
      businessId: subscription.businessId 
    }, req);

    res.status(200).json({
      success: true,
      message: 'Desuscripción exitosa'
    });
  } catch (error) {
    logger.error('Error removing push subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar suscripción push', 500));
  }
});

// GET /api/push/subscriptions - Obtener suscripciones del negocio (para debug)
router.get('/subscriptions', async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    // Resolver businessId
    let resolvedBusinessId;
    try {
      resolvedBusinessId = await resolveBusinessId(businessId);
    } catch (error) {
      return res.status(404).json(formatHttpError(req, 'Business not found', 404));
    }

    const subscriptions = await PushSubscription.find({
      businessId: resolvedBusinessId,
      isActive: true
    }).select('endpoint userAgent createdAt');

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        endpoint: sub.endpoint.substring(0, 50) + '...', // Truncar por seguridad
        userAgent: sub.userAgent,
        createdAt: sub.createdAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching push subscriptions', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener suscripciones', 500));
  }
});

module.exports = router;

