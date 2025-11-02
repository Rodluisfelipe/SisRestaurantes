const webpush = require('web-push');
const PushSubscription = require('../Models/PushSubscription');
const logger = require('../utils/logger');

let vapidConfigured = false;

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

const sendPushToBusinessId = async (businessId, payload) => {
  if (!vapidConfigured) {
    logger.debug('Push notifications disabled - VAPID not configured');
    return { sent: 0, failed: 0, removed: 0 };
  }
  if (!payload.title || !payload.body) {
    throw new Error('Push payload must include title and body');
  }

  const subscriptions = await PushSubscription.find({ businessId, isActive: true });
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (error) {
      failed++;
      logger.error(`Failed to send push to subscription ${sub._id}: ${error.message}`, error);
      if (error.statusCode === 410 || error.statusCode === 404) { // Subscription expired or not found
        await PushSubscription.findByIdAndUpdate(sub._id, { isActive: false });
        removed++;
        logger.info(`Removed expired push subscription ${sub._id}`);
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

module.exports = {
  configureVapid,
  sendPushToBusinessId,
  sendOrderStatusPush,
  sendOrderReadyPush,
};
