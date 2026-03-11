// Intentar cargar web-push de forma segura (opcional)
let webpush = null;
try {
  webpush = require('web-push');
} catch (error) {
  console.warn('⚠️ web-push no está instalado. Push notifications estarán deshabilitadas.');
}

const PushSubscription = require('../Models/PushSubscription');
const logger = require('../utils/logger');

let vapidConfigured = false;

const configureVapid = () => {
  if (!webpush) {
    logger.warn('web-push no está instalado. Push notifications estarán deshabilitadas.');
    vapidConfigured = false;
    return false;
  }
  
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

const sendPushToBusinessId = async (businessId, payload) => {
  if (!vapidConfigured) {
    logger.debug('Push notifications disabled - VAPID not configured');
    return { sent: 0, failed: 0, removed: 0 };
  }
  if (!payload.title || !payload.body) {
    throw new Error('Push payload must include title and body');
  }

  const subscriptions = await PushSubscription.find({ businessId, isActive: true }).lean();
  let sent = 0;
  let failed = 0;
  let removed = 0;

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload))
        .then(() => ({ status: 'sent', subId: sub._id }))
        .catch(error => ({ status: 'failed', subId: sub._id, error }))
    )
  );

  for (const result of results) {
    const val = result.status === 'fulfilled' ? result.value : result.reason;
    if (val?.status === 'sent') {
      sent++;
    } else {
      failed++;
      const error = val?.error;
      if (error) {
        logger.error(`Failed to send push to subscription ${val.subId}: ${error.message}`);
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.findByIdAndUpdate(val.subId, { isActive: false });
          removed++;
          logger.info(`Removed expired push subscription ${val.subId}`);
        }
      }
    }
  }
  return { sent, failed, removed };
};

const sendOrderStatusPush = async (businessId, order, newStatus) => {
  const title = `Pedido #${order.orderNumber} - ${newStatus.toUpperCase()}`;
  const body = `El pedido de ${order.customerName} ahora está en estado: ${newStatus}.`;
  const clickUrl = `/admin/orders/${order._id}`; // URL para abrir el pedido en el admin
  const payload = { title, body, clickUrl, data: { orderId: order._id.toString(), orderNumber: order.orderNumber, status: newStatus } };
  return sendPushToBusinessId(businessId, payload);
};

const sendOrderReadyPush = async (businessId, order) => {
  const title = `¡Pedido #${order.orderNumber} LISTO!`;
  const body = `Tu pedido para ${order.customerName} está listo para ser entregado/recogido.`;
  const clickUrl = `/admin/orders/${order._id}`;
  const payload = { title, body, clickUrl, data: { orderId: order._id.toString(), orderNumber: order.orderNumber, status: 'ready' } };
  return sendPushToBusinessId(businessId, payload);
};

/**
 * Send push notification to a customer by their customerToken
 * @param {string} customerToken - Customer's unique token
 * @param {object} payload - Push notification payload
 * @param {string} [businessId] - Optional businessId to scope notifications to a specific business
 */
const sendPushToCustomer = async (customerToken, payload, businessId) => {
  if (!vapidConfigured) {
    logger.debug('Push notifications disabled - VAPID not configured');
    return { sent: 0, failed: 0, removed: 0 };
  }
  if (!customerToken || !payload.title || !payload.body) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const filter = { customerToken, role: 'customer', isActive: true };
  if (businessId) {
    filter.businessId = businessId;
  }
  const subscriptions = await PushSubscription.find(filter).lean();
  let sent = 0, failed = 0, removed = 0;

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload))
        .then(() => ({ status: 'sent', subId: sub._id }))
        .catch(error => ({ status: 'failed', subId: sub._id, error }))
    )
  );

  for (const result of results) {
    const val = result.status === 'fulfilled' ? result.value : result.reason;
    if (val?.status === 'sent') {
      sent++;
    } else {
      failed++;
      const error = val?.error;
      if (error) {
        logger.error(`Failed to send customer push to ${val.subId}: ${error.message}`);
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.findByIdAndUpdate(val.subId, { isActive: false });
          removed++;
        }
      }
    }
  }
  return { sent, failed, removed };
};

/**
 * Send order status update push to a customer
 */
const sendCustomerOrderStatusPush = async (order, newStatus) => {
  if (!order.customerToken) return { sent: 0 };

  const statusMessages = {
    payment_confirmed: { icon: '✅', title: 'Pago confirmado', body: 'Tu pago ha sido verificado. ¡Ya estamos procesando tu pedido!' },
    confirmed: { icon: '✅', title: 'Pedido confirmado', body: 'El restaurante confirmó tu pedido.' },
    preparing: { icon: '👨‍🍳', title: 'Preparando tu pedido', body: '¡Tu pedido está siendo preparado!' },
    inProgress: { icon: '👨‍🍳', title: 'Preparando tu pedido', body: '¡Tu pedido está siendo preparado!' },
    ready: { icon: '🎉', title: '¡Tu pedido está listo!', body: order.orderType === 'delivery' ? 'Tu pedido va en camino' : order.orderType === 'takeaway' ? 'Puedes pasar a recogerlo' : 'Será servido en tu mesa' },
    completed: { icon: '✨', title: 'Pedido completado', body: '¡Gracias por tu compra! Esperamos verte pronto.' },
    delivered: { icon: '🏠', title: 'Pedido entregado', body: '¡Tu pedido ha sido entregado! Buen provecho.' },
    cancelled: { icon: '❌', title: 'Pedido cancelado', body: 'Tu pedido ha sido cancelado.' },
  };

  const msg = statusMessages[newStatus];
  if (!msg) return { sent: 0 };

  const payload = {
    title: `${msg.icon} Pedido #${order.orderNumber} - ${msg.title}`,
    body: msg.body,
    clickUrl: '/',
    data: { orderId: order._id.toString(), orderNumber: order.orderNumber, status: newStatus }
  };

  return sendPushToCustomer(order.customerToken, payload, order.businessId);
};

module.exports = {
  configureVapid,
  sendPushToBusinessId,
  sendOrderStatusPush,
  sendOrderReadyPush,
  sendPushToCustomer,
  sendCustomerOrderStatusPush,
};
