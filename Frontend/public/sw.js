// Service Worker vacío para sobrescribir caché
self.addEventListener('install', () => {
  // No hacer nada
});

self.addEventListener('activate', () => {
  // Limpiar todos los cachés existentes
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  });
});

self.addEventListener('fetch', (event) => {
  // No interceptar requests - comportamiento normal del navegador
  return;
});
