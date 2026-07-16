/**
 * fcmService — send push to the native DriverApp via Firebase Cloud Messaging
 * (HTTP v1, through firebase-admin). Sends HIGH-PRIORITY DATA messages so the
 * app's background handler wakes and shows a full-screen incoming-order alert
 * even when killed. (No `notification` block — the app renders the UI via Notifee.)
 *
 * Credentials: set ONE of these env vars to a Firebase service-account key:
 *   FIREBASE_SERVICE_ACCOUNT_B64   → base64 of the .json  (recommended: safe in .env)
 *   FIREBASE_SERVICE_ACCOUNT       → the raw JSON content (stringified)
 *   FIREBASE_SERVICE_ACCOUNT_PATH  → a path to the .json file
 * Without credentials the service is a safe no-op (logs a warning once).
 */

const logger = require('../utils/logger');

let messaging = null;
let initTried = false;
let warned = false;

function init() {
  if (initTried) return messaging;
  initTried = true;
  try {
    // firebase-admin v13+ modular API
    const { initializeApp, cert, applicationDefault, getApps } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');

    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      credential = cert(JSON.parse(json));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      credential = cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = applicationDefault();
    } else {
      if (!warned) { logger.warn('FCM disabled — no FIREBASE_SERVICE_ACCOUNT configured'); warned = true; }
      return null;
    }

    const app = getApps().length ? getApps()[0] : initializeApp({ credential });
    messaging = getMessaging(app);
    logger.info('FCM initialized');
  } catch (err) {
    if (!warned) { logger.warn('FCM init failed', { error: err.message }); warned = true; }
    messaging = null;
  }
  return messaging;
}

// FCM data values must all be strings.
function stringifyData(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/**
 * Send a high-priority message to one token. When `notification` is provided it
 * is a HYBRID message (visible notification + data): Android's system shows the
 * heads-up reliably even when the app is backgrounded/killed or under battery
 * optimization (data-only messages get dropped in those cases), while the data
 * still lets the app render its own UI when it's alive.
 * @returns {Promise<{ok:boolean, invalidToken?:boolean}>}
 */
async function sendData(token, data, notification = null) {
  const m = init();
  if (!m || !token) return { ok: false };
  try {
    const msg = {
      token,
      data: stringifyData(data),
      android: {
        priority: 'high',
        ttl: 60 * 1000, // offers are time-sensitive
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: notification ? { sound: 'default' } : { contentAvailable: true } },
      },
    };
    if (notification) {
      msg.notification = { title: notification.title, body: notification.body };
      msg.android.notification = {
        channelId: 'incoming-orders', // created by the app (Notifee) — HIGH importance + sound
        sound: 'default',
        priority: 'high',
        defaultVibrateTimings: true,
        color: '#E11D2A',
      };
    }
    await m.send(msg);
    return { ok: true };
  } catch (err) {
    const code = err.errorInfo?.code || err.code || '';
    const invalidToken = /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(code);
    logger.warn('FCM send failed', { error: err.message, code, invalidToken });
    return { ok: false, invalidToken };
  }
}

/**
 * Notify a driver of a new delivery offer.
 * @param {Object} driver DeliveryPerson doc/lean with fcmToken
 * @param {Object} offer  { offerId, orderId, address, totalAmount, distanceKm, timeoutSec }
 */
async function notifyOffer(driver, offer = {}) {
  if (!driver || !driver.fcmToken) return { ok: false, skipped: true };
  const money = offer.totalAmount ? ` · $${Number(offer.totalAmount).toLocaleString('es-CO')}` : '';
  const res = await sendData(driver.fcmToken, {
    type: 'offer',
    offerId: offer.offerId,
    orderId: offer.orderId,
    address: offer.address,
    totalAmount: offer.totalAmount,
    distanceKm: offer.distanceKm != null ? Number(offer.distanceKm).toFixed(1) : undefined,
    timeoutSec: offer.timeoutSec,
  }, {
    title: '🛵 ¡Nuevo pedido disponible!',
    body: `${offer.address || 'Toca para ver el pedido'}${money}`,
  });
  // Clear a dead token so we stop trying
  if (res.invalidToken) {
    try {
      const DeliveryPerson = require('../Models/DeliveryPerson');
      await DeliveryPerson.updateOne({ _id: driver._id }, { $set: { fcmToken: null } });
    } catch { /* noop */ }
  }
  return res;
}

/** Tell the app to dismiss a pending offer alert (taken/expired elsewhere). */
async function notifyCancel(driver, offerId) {
  if (!driver || !driver.fcmToken) return { ok: false, skipped: true };
  return sendData(driver.fcmToken, { type: 'cancel_offer', offerId });
}

/**
 * Notify a driver that an order was directly assigned to them (manual assign,
 * no accept/reject). High-priority heads-up alert that opens the order.
 */
async function notifyAssigned(driver, order = {}) {
  if (!driver || !driver.fcmToken) return { ok: false, skipped: true };
  const amount = order.totalAmount != null ? order.totalAmount : order.finalAmount;
  const money = amount ? ` · $${Number(amount).toLocaleString('es-CO')}` : '';
  const res = await sendData(driver.fcmToken, {
    type: 'assigned',
    orderId: order.orderId || order._id,
    orderNumber: order.orderNumber,
    address: order.address,
    totalAmount: amount,
  }, {
    title: '🛵 Nuevo pedido asignado',
    body: `${order.address || 'Toca para ver el pedido'}${money}`,
  });
  if (res.invalidToken) {
    try {
      const DeliveryPerson = require('../Models/DeliveryPerson');
      await DeliveryPerson.updateOne({ _id: driver._id }, { $set: { fcmToken: null } });
    } catch { /* noop */ }
  }
  return res;
}

module.exports = { init, sendData, notifyOffer, notifyCancel, notifyAssigned };
