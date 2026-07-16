/**
 * notifeeSetup — top-level registration for background push + notification events.
 * MUST be imported first in index.js so these handlers exist even when the app is
 * launched cold from a notification.
 *
 *  - messaging().setBackgroundMessageHandler → FCM data messages while the app is
 *    backgrounded/killed become a full-screen Notifee incoming-order alert.
 *  - notifee.onBackgroundEvent → Accept / Reject pressed on that alert.
 *  - notifee.registerForegroundService → keeps the "online" service alive.
 */

import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import { displayIncomingOrder, cancelIncomingOrder, displayAssignedOrder } from './services/incomingOrder';
import { offerFromData } from './services/fcm';

// Foreground-service runner: never resolves so the "online" service stays alive.
notifee.registerForegroundService(() => new Promise(() => {}));

// FCM background / killed handler → full-screen incoming-order alert.
messaging().setBackgroundMessageHandler(async (msg) => {
  const d = msg?.data || {};
  if (d.type === 'offer') await displayIncomingOrder(offerFromData(d));
  else if (d.type === 'assigned') await displayAssignedOrder(d);
  else if (d.type === 'cancel_offer') await cancelIncomingOrder();
});

// Respond to an offer straight from the notification (app backgrounded / killed).
async function respondOffer(offerId, action) {
  const token = await AsyncStorage.getItem('domi_token');
  const slug = await AsyncStorage.getItem('domi_slug');
  if (!token || !slug || !offerId) return;
  try {
    await fetch(`${API_URL}/restaurants/${slug}/domi/offers/${offerId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch { /* offline — offer expires server-side */ }
}

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { pressAction, notification } = detail || {};
  const data = notification?.data || {};
  if (type !== EventType.ACTION_PRESS) return;

  if (pressAction?.id === 'accept') {
    await respondOffer(data.offerId, 'accept');
    await cancelIncomingOrder();
  } else if (pressAction?.id === 'reject') {
    await respondOffer(data.offerId, 'reject');
    await cancelIncomingOrder();
  }
});
