// Utilidades compartidas para recuperarse de "chunk load errors" — el caso en
// que el HTML quedó cacheado apuntando a un chunk JS/CSS viejo que ya no existe
// tras un deploy. Síntoma típico:
//   "Failed to fetch dynamically imported module: .../assets/Menu-<hash>.js"
//
// Se usa desde:
//   - main.jsx: listeners globales (vite:preloadError, unhandledrejection, error)
//   - ErrorBoundary.jsx: última línea de defensa cuando React.lazy/Suspense
//     traga la promesa rechazada y el error llega al boundary como render error.

const RELOAD_FLAG = '__crew_chunk_reload_attempted';

// ¿Es un error de carga de chunk / módulo dinámico?
export const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    err?.name === 'ChunkLoadError'
  );
};

// ¿Ya intentamos recuperarnos en esta sesión? (evita loops si el problema es real)
export const chunkReloadAlreadyAttempted = () => {
  try {
    return !!sessionStorage.getItem(RELOAD_FLAG);
  } catch {
    return false;
  }
};

// Limpia TODO lo que puede dejar la app pegada en una versión vieja (service
// worker + cachés) y recarga el documento con cache-bust duro. Solo se ejecuta
// UNA vez por sesión. Devuelve true si disparó la recuperación, false si ya se
// había intentado (para que el caller decida mostrar la UI de error real).
export const recoverFromChunkError = (why) => {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false; // ya intentamos
    sessionStorage.setItem(RELOAD_FLAG, why || '1');
  } catch {
    // sessionStorage no disponible: seguimos igual, sin guard.
  }

  const cleanups = [];
  if ('serviceWorker' in navigator) {
    cleanups.push(
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
    );
  }
  if ('caches' in window) {
    cleanups.push(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
    );
  }
  Promise.all(cleanups).finally(() => {
    // cache-bust duro del documento para saltar cualquier edge/proxy cacheado
    const u = new URL(window.location.href);
    u.searchParams.set('_r', Date.now().toString());
    window.location.replace(u.toString());
  });
  return true;
};
