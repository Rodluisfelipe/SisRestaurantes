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
 * Send a high-priority data message to one token.
 * @returns {Promise<{ok:boolean, invalidToken?:boolean}>}
 */
async function sendData(token, data) {
  const m = init();
  if (!m || !token) return { ok: false };
  try {
    await m.send({
      token,
      data: stringifyData(data),
      android: {
        priority: 'high',
        ttl: 60 * 1000, // offers are time-sensitive
      },
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
        payload: { aps: { contentAvailable: true } },
      },
    });
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
  const res = await sendData(driver.fcmToken, {
    type: 'offer',
    offerId: offer.offerId,
    orderId: offer.orderId,
    address: offer.address,
    totalAmount: offer.totalAmount,
    distanceKm: offer.distanceKm != null ? Number(offer.distanceKm).toFixed(1) : undefined,
    timeoutSec: offer.timeoutSec,
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

module.exports = { init, sendData, notifyOffer, notifyCancel };
