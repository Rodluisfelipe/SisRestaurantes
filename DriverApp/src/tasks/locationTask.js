/**
 * Background location task for Expo.
 *
 * This file must be imported at the ROOT of App.js (top-level, not inside any component)
 * so TaskManager registers it before any component mounts.
 *
 * Strategy:
 *   - While the app is in FOREGROUND: useLocation() hook in OrderScreen handles GPS
 *     and emits domi:location via socket.io (real-time, low latency).
 *   - While in BACKGROUND: this TaskManager task fires every ~5s and sends the
 *     location to the backend via HTTP (POST /domi/location/:orderId).
 *     The backend then relays it to the socket room. This adds ~1-2s latency
 *     but keeps tracking alive when the driver minimizes the app.
 *
 * The HTTP relay endpoint needs to be added to Backend/Routes/deliveryPublic.js:
 *   POST /:slug/domi/orders/:id/location  { lat, lng }   (requires domi JWT)
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

export const LOCATION_TASK_NAME = 'domi-background-location';

// Registered at module level — must happen before TaskManager.isTaskRegisteredAsync
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[LocationTask]', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const { latitude: lat, longitude: lng } = data.locations[0].coords;

  try {
    const token   = await AsyncStorage.getItem('domi_token');
    const slug    = await AsyncStorage.getItem('domi_slug');
    const orderId = await AsyncStorage.getItem('domi_active_order');
    if (!token || !slug || !orderId) return;

    await fetch(`${API_URL}/restaurants/${slug}/domi/orders/${orderId}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lat, lng }),
    });
  } catch (err) {
    // Non-critical — location will resume when socket reconnects in foreground
    console.warn('[LocationTask] HTTP relay failed', err.message);
  }
});

export async function startBackgroundLocation(orderId) {
  await AsyncStorage.setItem('domi_active_order', orderId);

  const { granted } = await Location.requestBackgroundPermissionsAsync();
  if (!granted) {
    console.warn('[LocationTask] Background location permission not granted');
    return false;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,       // every 5 seconds
    distanceInterval: 10,     // or every 10 metres, whichever comes first
    foregroundService: {      // Android: keeps task alive with a notification
      notificationTitle: 'Entrega en curso',
      notificationBody: 'Tu ubicación está siendo compartida con el restaurante.',
      notificationColor: '#EF4444',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true, // iOS blue bar
  });

  return true;
}

export async function stopBackgroundLocation() {
  await AsyncStorage.removeItem('domi_active_order');
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
