/**
 * incomingOrder — "incoming call" style alerts for new delivery offers, via Notifee.
 *
 * Two pieces:
 *   1. Full-screen incoming-order notification: wakes the screen, loops a sound,
 *      shows Accept / Reject actions — even when the app is backgrounded or the
 *      phone is locked (Android full-screen intent).
 *   2. Foreground service while "online": a persistent low-priority notification
 *      that keeps the app process alive so the socket stays connected and offers
 *      arrive instantly (this is what makes the alert reliable, Rappi-style).
 *
 * Notifee is a NATIVE module — it only works in a dev/EAS build, not Expo Go.
 * The background-event + foreground-service RUNNERS are registered once at the
 * top level in ../notifeeSetup (imported first in index.js).
 */

import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';

export const INCOMING_CHANNEL = 'incoming-orders';
export const ONLINE_CHANNEL = 'online-status';
export const INCOMING_ID = 'incoming-order';
export const ONLINE_ID = 'online-service';

let channelsReady = false;

export async function setupChannels() {
  if (channelsReady) return;
  // Loud, high-priority channel for incoming offers
  await notifee.createChannel({
    id: INCOMING_CHANNEL,
    name: 'Pedidos entrantes',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  // Silent, ongoing channel for the "online" foreground service
  await notifee.createChannel({
    id: ONLINE_CHANNEL,
    name: 'Estado en línea',
    importance: AndroidImportance.LOW,
  });
  channelsReady = true;
}

/** Ask for POST_NOTIFICATIONS (Android 13+) + notification access. */
export async function requestNotifPermission() {
  try { await notifee.requestPermission(); } catch { /* noop */ }
}

/**
 * Show the full-screen incoming-order alert (loops sound, wakes screen).
 * @param {Object} offer { offerId, orderId, address, totalAmount, distanceKm, timeoutSec }
 */
export async function displayIncomingOrder(offer = {}) {
  await setupChannels();

  const money = offer.totalAmount ? `$${Number(offer.totalAmount).toLocaleString('es-CO')}` : '';
  const dist = offer.distanceKm != null ? `${Number(offer.distanceKm).toFixed(1)} km` : '';
  const body = [offer.address, money, dist].filter(Boolean).join(' · ') || 'Toca para ver el pedido';

  await notifee.displayNotification({
    id: INCOMING_ID,
    title: '🛵 ¡Nuevo pedido disponible!',
    body,
    data: {
      type: 'offer',
      offerId: String(offer.offerId || ''),
      orderId: String(offer.orderId || ''),
    },
    android: {
      channelId: INCOMING_CHANNEL,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.CALL,
      color: '#E11D2A',
      smallIcon: 'ic_notification',
      // Full-screen intent — launches the app over the lock screen
      fullScreenAction: { id: 'incoming', launchActivity: 'default' },
      pressAction: { id: 'open', launchActivity: 'default' },
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      timeoutAfter: (offer.timeoutSec || 45) * 1000,
      actions: [
        { title: 'Aceptar', pressAction: { id: 'accept', launchActivity: 'default' } },
        { title: 'Rechazar', pressAction: { id: 'reject' } },
      ],
    },
  });
}

/** Dismiss the incoming-order alert (accepted / rejected / expired / assigned). */
export async function cancelIncomingOrder() {
  try { await notifee.cancelNotification(INCOMING_ID); } catch { /* noop */ }
}

/**
 * Show a heads-up alert for a DIRECTLY assigned order (manual assign — no
 * accept/reject). Loud + high priority; tapping opens the app.
 */
export async function displayAssignedOrder(data = {}) {
  await setupChannels();
  const money = data.totalAmount ? `$${Number(data.totalAmount).toLocaleString('es-CO')}` : '';
  const body = [data.address, money].filter(Boolean).join(' · ') || 'Toca para ver el pedido';
  await notifee.displayNotification({
    id: `assigned-${data.orderId || Date.now()}`,
    title: '🛵 Nuevo pedido asignado',
    body,
    data: { type: 'assigned', orderId: String(data.orderId || '') },
    android: {
      channelId: INCOMING_CHANNEL,
      importance: AndroidImportance.HIGH,
      color: '#E11D2A',
      smallIcon: 'ic_notification',
      pressAction: { id: 'open', launchActivity: 'default' },
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300],
    },
  });
}

/**
 * Start the "online" foreground service — keeps the app alive so the socket
 * stays connected and offers arrive instantly. Call when the driver goes online.
 */
export async function startOnlineService() {
  await setupChannels();
  await notifee.displayNotification({
    id: ONLINE_ID,
    title: 'En línea · MenuBy Domi',
    body: 'Estás disponible para recibir pedidos',
    android: {
      channelId: ONLINE_CHANNEL,
      asForegroundService: true,
      ongoing: true,
      color: '#12B981',
      smallIcon: 'ic_notification',
      importance: AndroidImportance.LOW,
      pressAction: { id: 'open', launchActivity: 'default' },
    },
  });
}

/** Stop the "online" foreground service. Call when the driver goes offline / logs out. */
export async function stopOnlineService() {
  try { await notifee.stopForegroundService(); } catch { /* noop */ }
  try { await notifee.cancelNotification(ONLINE_ID); } catch { /* noop */ }
}
