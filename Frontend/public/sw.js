// Service Worker SOLO para notificaciones push.
// Versión: 5.0.0 - SIN fetch handler.
//
// Históricamente este SW interceptaba fetch y cacheaba HTML/assets. Eso dejaba
// navegadores atascados sirviendo un index.html o un /assets/*.js VIEJO desde la
// caché del SW tras un deploy → "Failed to fetch dynamically imported module" y
// "Expected a JavaScript module but got text/html". El CDN de Cloudflare ya
// cachea correctamente con hashes inmutables, así que el SW NO debe tocar la red.
// Sin fetch handler, todas las peticiones van directo al navegador/CDN y este
// tipo de bug desaparece de raíz.

const CACHE_NAME = 'menuby-push-v7';

// Instalación — activar de inmediato.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activación — BORRAR TODAS las cachés viejas (incluidas las de versiones que
// cacheaban assets) y tomar control de las pestañas abiertas al instante.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// NOTA: intencionalmente NO hay 'fetch' handler. El SW no intercepta ninguna
// petición de red — el navegador y el CDN se encargan de todo.

// Push: recibir y mostrar notificación
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Nueva notificación',
    body: 'Tienes una actualización',
    icon: '/logo.jpeg',
    badge: '/logo.jpeg',
    clickUrl: '/',
    data: {}
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.jpeg',
    badge: data.badge || '/logo.jpeg',
    vibrate: [200, 100, 200],
    tag: data.data?.orderId || 'notification',
    requireInteraction: true, // Mantener visible hasta que el usuario interactúe
    data: {
      clickUrl: data.clickUrl || '/',
      ...data.data
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click: abrir la URL especificada
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const clickUrl = event.notification.data?.clickUrl || '/';
  const fullUrl = new URL(clickUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If any window of the app is open, focus it and let the app handle navigation
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Mensaje desde el cliente (para debug o comandos)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
