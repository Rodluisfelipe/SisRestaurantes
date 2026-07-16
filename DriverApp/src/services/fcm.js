/**
 * fcm — Firebase Cloud Messaging registration + foreground handling.
 *
 * FCM delivers high-priority DATA messages to the device even when the app is
 * killed. We turn each incoming "offer" message into a full-screen Notifee alert
 * (see incomingOrder.js). The background/killed handler lives in notifeeSetup.js
 * (registered at the top of index.js); this file covers permission, token
 * registration, and foreground messages.
 */

import messaging from '@react-native-firebase/messaging';
import { registerPushToken } from './api';
import {
  setupChannels, requestNotifPermission, displayIncomingOrder, cancelIncomingOrder,
} from './incomingOrder';

// Normalize an FCM data payload into the shape displayIncomingOrder expects.
export function offerFromData(d = {}) {
  return {
    offerId: d.offerId,
    orderId: d.orderId,
    address: d.address,
    totalAmount: d.totalAmount != null ? Number(d.totalAmount) : undefined,
    distanceKm: d.distanceKm != null ? Number(d.distanceKm) : undefined,
    timeoutSec: d.timeoutSec != null ? Number(d.timeoutSec) : undefined,
  };
}

/** Ask permission, create channels, fetch the FCM token and send it to the backend. */
export async function registerForPush(slug) {
  try {
    await setupChannels();
    await requestNotifPermission();

    const status = await messaging().requestPermission();
    const ok =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!ok) return null;

    const token = await messaging().getToken();
    if (token && slug) await registerPushToken(slug, token).catch(() => {});
    return token;
  } catch (e) {
    console.warn('[fcm] register failed', e.message);
    return null;
  }
}

/** Foreground messages → show the full-screen incoming-order alert. */
export function listenForegroundMessages() {
  return messaging().onMessage(async (msg) => {
    const d = msg?.data || {};
    if (d.type === 'offer') await displayIncomingOrder(offerFromData(d));
    else if (d.type === 'cancel_offer') await cancelIncomingOrder();
  });
}

/** Re-register the token whenever FCM rotates it. */
export function listenTokenRefresh(slug) {
  return messaging().onTokenRefresh(async (token) => {
    if (token && slug) await registerPushToken(slug, token).catch(() => {});
  });
}
