// Service Worker para notificaciones push PWA
// Versión: 1.0.0

const CACHE_NAME = 'menuby-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
  // Activar inmediatamente
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
    })
  );
  // Tomar control inmediatamente
  return self.clients.claim();
});

// Fetch: estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NO interceptar peticiones a APIs (backend)
  if (url.pathname.startsWith('/api/') || 
      url.hostname !== self.location.hostname) {
    return; // Dejar que la petición pase directamente sin interceptar
  }
  
  // Solo cachear GET requests del mismo dominio
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, guardar en cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(event.request);
      })
  );
});

// Push: recibir y mostrar notificación
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Nueva notificación',
    body: 'Tienes una actualización',
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
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
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-96x96.png',
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
        // Buscar si ya hay una ventana abierta con la app
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
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
