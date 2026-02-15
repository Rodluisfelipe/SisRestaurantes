// Service Worker para notificaciones push PWA
// Versión: 1.1.0

const CACHE_NAME = 'menuby-v2';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v1.1...');
  // Skip cacheAll to avoid install failures on GitHub Pages
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NO interceptar: APIs, socket.io, otros dominios, chrome-extension, etc.
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/socket.io/') ||
      url.hostname !== self.location.hostname ||
      !url.protocol.startsWith('http')) {
    return;
  }
  
  // Solo cachear GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde cache; si tampoco hay cache, devolver respuesta vacía
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

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
