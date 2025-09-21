// Service Worker para limpieza de caché y manejo básico
self.addEventListener('install', (event) => {
  // Forzar activación inmediata
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar todos los cachés existentes
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      // Tomar control de todas las páginas
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar requests de la misma origin
  if (event.request.url.startsWith(self.location.origin)) {
    // Para requests de la misma origin, usar network first
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si falla la red, intentar desde caché
        return caches.match(event.request);
      })
    );
  }
  // Para otros requests, usar comportamiento normal del navegador
});
