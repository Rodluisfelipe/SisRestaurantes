const webpush = require('web-push');
const PushSubscription = require('../Models/PushSubscription');
const logger = require('../utils/logger');

// Variable para verificar si VAPID está configurado
let vapidConfigured = false;

// Configurar VAPID (debe hacerse al iniciar el servidor)
const configureVapid = () => {
  const vapidPublic = process.env.VAPID_PUBLIC;
  const vapidPrivate = process.env.VAPID_PRIVATE;
  const vapidMailto = process.env.VAPID_MAILTO || 'mailto:admin@menuby.tech';

  if (!vapidPublic || !vapidPrivate) {
    logger.warn('VAPID keys not configured. Push notifications will be DISABLED. Set VAPID_PUBLIC and VAPID_PRIVATE in .env to enable.');
    vapidConfigured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(
      vapidMailto,
      vapidPublic,
      vapidPrivate
    );
    vapidConfigured = true;
    logger.info('✅ VAPID configured successfully - Push notifications ENABLED');
    return true;
  } catch (error) {
    logger.error('Error configuring VAPID', error);
    vapidConfigured = false;
    return false;
  }
};

/**
 * Enviar notificación push a todas las suscripciones de un negocio
 * @param {string} businessId - ID del negocio
 * @param {object} payload - { title, body, clickUrl, data? }
 * @returns {Promise<{sent: number, failed: number, removed: number}>}
 */
const sendPushToBusinessId = async (businessId, payload) => {
  try {
    // Si VAPID no está configurado, no enviar push (sin fallar)
    if (!vapidConfigured) {
      logger.debug('Push notifications disabled - VAPID not configured');
      return { sent: 0, failed: 0, removed: 0 };
    }

    // Validar payload (sin PII)
    if (!payload.title || !payload.body) {
      throw new Error('Push payload must include title and body');
    }

    // Obtener todas las suscripciones activas del negocio
    const subscriptions = await PushSubscription.find({
      businessId,
      isActive: true
    });

    if (subscriptions.length === 0) {
      logger.debug('No active push subscriptions found', { businessId });
      return { sent: 0, failed: 0, removed: 0 };
    }

    logger.info(`Sending push to ${subscriptions.length} subscriptions`, { businessId });

    const results = {
      sent: 0,
      failed: 0,
      removed: 0
    };

    // Enviar a cada suscripción
    const promises = subscriptions.map(async (sub) => {
      try {
        const pushPayload = JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/icon-96x96.png',
          clickUrl: payload.clickUrl || '/',
          data: payload.data || {}
        });

        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          },
          pushPayload
        );

        results.sent++;
        logger.debug('Push sent successfully', { endpoint: sub.endpoint.substring(0, 50) });
      } catch (error) {
        results.failed++;
        logger.warn('Failed to send push', { 
          endpoint: sub.endpoint.substring(0, 50),
          error: error.message 
        });

        // Si el endpoint expiró (410 Gone) o es inválido, eliminar la suscripción
        if (error.statusCode === 410 || error.statusCode === 404) {
          try {
            await PushSubscription.findByIdAndDelete(sub._id);
            results.removed++;
            logger.info('Removed expired push subscription', { 
              subscriptionId: sub._id,
              endpoint: sub.endpoint.substring(0, 50)
            });
          } catch (deleteError) {
            logger.error('Error removing expired subscription', deleteError);
          }
        }
      }
    });

    await Promise.all(promises);

    logger.info('Push notification batch completed', { 
      businessId, 
      ...results 
    });

    return results;
  } catch (error) {
    logger.error('Error in sendPushToBusinessId', error);
    throw error;
  }
};

/**
 * Enviar notificación de cambio de estado de pedido
 * @param {string} businessId - ID del negocio
 * @param {object} order - Objeto de pedido
 * @param {string} newStatus - Nuevo estado
 */
const sendOrderStatusPush = async (businessId, order, newStatus) => {
  const statusMessages = {
    pending: 'Pedido recibido',
    preparing: 'Pedido en preparación',
    ready: 'Pedido listo para recoger/entregar',
    delivered: 'Pedido entregado',
    cancelled: 'Pedido cancelado'
  };

  const title = statusMessages[newStatus] || 'Actualización de pedido';
  const body = `Pedido #${order.orderNumber} - ${order.customerInfo?.name || 'Cliente'}`;
  const clickUrl = `/admin?orderId=${order._id}`;

  return await sendPushToBusinessId(businessId, {
    title,
    body,
    clickUrl,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: newStatus,
      type: 'order_status_change'
    }
  });
};

/**
 * Enviar notificación de pedido listo
 * @param {string} businessId - ID del negocio
 * @param {object} order - Objeto de pedido
 */
const sendOrderReadyPush = async (businessId, order) => {
  const title = '🔔 Pedido listo';
  const body = `Pedido #${order.orderNumber} está listo`;
  const clickUrl = `/admin?orderId=${order._id}`;

  return await sendPushToBusinessId(businessId, {
    title,
    body,
    clickUrl,
    data: {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: 'ready',
      type: 'order_ready'
    }
  });
};

module.exports = {
  configureVapid,
  sendPushToBusinessId,
  sendOrderStatusPush,
  sendOrderReadyPush
};

