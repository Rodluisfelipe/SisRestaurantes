// Service Worker para notificaciones push PWA
// Versión: 3.0.0 - No cache JS/CSS assets (Cloudflare CDN handles it)

const CACHE_NAME = 'menuby-v4';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3.0...');
  self.skipWaiting();
});

// Activación del Service Worker - limpiar cachés viejos
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

// Fetch: Network first — only cache index.html for offline support
// Hashed assets (JS/CSS) are served by Cloudflare CDN and don't need SW caching
self.addEventListener('fetch', (event) => {
  // Solo interceptar requests GET del mismo origen
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' ||
      url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // Don't cache hashed assets — they change on every deploy and CDN handles them
  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    // Let the browser fetch directly from CDN, no SW interception
    return;
  }

  // Network first, cache fallback — only for HTML/non-hashed resources
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Siempre devolver un Response válido
          if (event.request.destination === 'document') {
            return caches.match('/index.html') || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
          }
          return new Response('', { status: 503, statusText: 'Offline' });
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
