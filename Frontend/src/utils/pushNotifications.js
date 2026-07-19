import api from '../services/api';

// Convertir VAPID public key de base64 a Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Safe Uint8Array to base64 (mobile-safe, avoids stack overflow with large arrays)
const uint8ArrayToBase64 = (uint8Array) => {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
};

/**
 * Check if running as installed PWA (standalone)
 */
export const isInstalledPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
};

/**
 * Check if device is iOS
 */
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Verificar si el navegador soporta push notifications
 */
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Verificar si el usuario ya otorgó permiso de notificaciones
 */
export const hasNotificationPermission = () => {
  return Notification.permission === 'granted';
};

/**
 * Solicitar permiso de notificaciones al usuario
 */
export const requestNotificationPermission = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications no están soportadas en este navegador');
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Registrar Service Worker
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker no está soportado en este navegador');
  }

  try {
    // ?v=8 cache-buster: el sw.js sin query quedó cacheado immutable en el edge
    // de Cloudflare; con la versión en la URL el navegador trae el SW nuevo.
    const registration = await navigator.serviceWorker.register('/sw.js?v=8', {
      scope: '/',
      updateViaCache: 'none'
    });
    console.log('[Push] Service Worker registered:', registration.scope);
    
    // Wait for the SW to be ready (active)
    const ready = await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker is ready:', ready.scope);
    
    return ready;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    throw error;
  }
};

/**
 * Suscribirse a push notifications
 * @param {string} businessId - ID del negocio
 * @param {string} userId - ID del usuario (opcional, for admin)
 * @param {string} customerToken - Token del cliente (opcional, for customer order tracking)
 */
export const subscribeToPush = async (businessId, userId = null, customerToken = null) => {
  try {
    // 1. Verificar soporte
    if (!isPushSupported()) {
      throw new Error('Push notifications no están soportadas');
    }

    // 2. Solicitar permiso
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      throw new Error('Permiso de notificaciones denegado');
    }

    // 3. Registrar Service Worker
    const registration = await registerServiceWorker();

    // 4. Obtener VAPID public key desde env
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC;
    if (!vapidPublicKey) {
      throw new Error('VAPID public key no configurada');
    }

    // 5. Suscribirse al push manager
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[Push] No existing subscription, creating new one...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    } else {
      console.log('[Push] Reusing existing push subscription');
    }

    console.log('[Push] Push subscription obtained:', subscription.endpoint);

    // 6. Enviar suscripción al backend (mobile-safe encoding)
    const p256dhKey = new Uint8Array(subscription.getKey('p256dh'));
    const authKey = new Uint8Array(subscription.getKey('auth'));
    
    const response = await api.post('/push/subscribe', {
      businessId,
      userId,
      customerToken,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: uint8ArrayToBase64(p256dhKey),
        auth: uint8ArrayToBase64(authKey)
      }
    });

    console.log('[Push] Subscription saved to backend:', response.data);
    return { success: true, subscription };
  } catch (error) {
    console.error('[Push] Error subscribing to push:', error);
    throw error;
  }
};

/**
 * Desuscribirse de push notifications
 */
export const unsubscribeFromPush = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[Push] No active subscription found');
      return { success: true, message: 'No hay suscripción activa' };
    }

    // Desuscribirse del push manager
    await subscription.unsubscribe();
    console.log('[Push] Unsubscribed from push manager');

    // Notificar al backend
    try {
      await api.post('/push/unsubscribe', {
        endpoint: subscription.endpoint
      });
      console.log('[Push] Backend notified of unsubscription');
    } catch (error) {
      console.warn('[Push] Failed to notify backend:', error);
    }

    return { success: true, message: 'Desuscripción exitosa' };
  } catch (error) {
    console.error('[Push] Error unsubscribing:', error);
    throw error;
  }
};

/**
 * Verificar si ya existe una suscripción activa
 */
export const getActiveSubscription = async () => {
  try {
    if (!isPushSupported()) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    return subscription;
  } catch (error) {
    console.error('[Push] Error getting active subscription:', error);
    return null;
  }
};

/**
 * Verificar estado de la suscripción
 */
export const checkSubscriptionStatus = async () => {
  const supported = isPushSupported();
  const permission = Notification.permission;
  const subscription = await getActiveSubscription();

  return {
    supported,
    permission,
    subscribed: !!subscription,
    subscription
  };
};

