import React from "react";
import ReactDOM from "react-dom/client";

/* Sentry se retiró del frontend: eran 85 KB comprimidos —el 23% de todo lo
   que descargaba un comensal— cargados antes de pintar nada, más el Session
   Replay grabando el 10% de las sesiones. Un costo fijo en cada visita a un
   menú para un dato que casi nunca se miraba. */

// PRODUCTION CONSOLE FILTER — strip ALL console.log/info in production, keep warn/error for debugging
if (typeof window !== 'undefined') {
  const isProduction = import.meta.env.PROD;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  
  // Filter for known noisy messages (active in all environments)
  const shouldFilter = (...args) => {
    const message = String(args.join(' ')).toLowerCase();
    return message.includes('react devtools') || 
           message.includes('development experience') ||
           message.includes('download the react devtools') ||
           message.includes('reactjs.org/link/react-devtools') ||
           message.includes('manifest:') ||
           (message.includes('property') && message.includes('ignored')) ||
           message.includes('url is invalid') ||
           message.includes('start_url') ||
           message.includes('fetch event handler is recognized as no-op') ||
           message.includes('no-op fetch handler') ||
           message.includes('may bring overhead during navigation');
  };

  // In production: suppress ALL console.log and console.info (prevents PII leakage)
  // In development: only filter known noisy messages
  console.log = (...args) => {
    if (isProduction) return; // Suppress all logs in production
    if (!shouldFilter(...args)) originalLog.apply(console, args);
  };

  console.info = (...args) => {
    if (isProduction) return; // Suppress all info in production
    if (!shouldFilter(...args)) originalInfo.apply(console, args);
  };

  console.warn = (...args) => {
    if (!shouldFilter(...args)) originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (!shouldFilter(...args)) originalError.apply(console, args);
  };
}
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./index.css";
import { AuthProvider } from "./Context/AuthContext";
import { ThemeProvider } from "./Context/ThemeContext";
import ErrorBoundary from "./Components/ErrorBoundary";
import App from "./App.jsx";
import { isChunkLoadError, recoverFromChunkError } from "./utils/chunkReload";

// ─────────────────────────────────────────────
// Auto-recovery cuando el HTML quedó cacheado apuntando a un chunk JS/CSS
// viejo que ya no existe tras un deploy. Síntomas típicos:
//   - "Failed to fetch dynamically imported module: .../assets/XXX-<hash>.js"
//   - "Refused to apply style ... MIME type ('text/html') is not a supported
//      stylesheet MIME type" (cuando el server hace SPA fallback al asset)
//
// Para no entrar en loop si el problema es real, solo recargamos UNA vez por
// sesión y dejamos un flag en sessionStorage. Tras 5s OK, reseteamos el flag.
// ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const RELOAD_FLAG = '__crew_chunk_reload_attempted';

  // Para CSS/JS cargados por <link>/<script>: el navegador NO bubble-ea el
  // error y NO dispara unhandledrejection. Hay que usar el listener en fase
  // de captura ({ capture: true }) y mirar e.target.
  const isAssetTagFailure = (event) => {
    const t = event.target;
    if (!t || !t.tagName) return null;
    const tag = t.tagName.toLowerCase();
    if (tag === 'link' && t.href && /\/assets\//.test(t.href)) return t.href;
    if (tag === 'script' && t.src && /\/assets\//.test(t.src)) return t.src;
    return null;
  };

  // Detección + recuperación (unregister SW + limpiar cachés + reload con
  // cache-bust, una sola vez por sesión) viven en ./utils/chunkReload para
  // reusarse también desde ErrorBoundary cuando React/Suspense traga el error.
  const reload = (why) => recoverFromChunkError(why);

  // 0) vite:preloadError — Vite lo emite aunque React/Suspense trague la promesa.
  //    Es la forma más confiable de detectar chunk load failures en producción.
  window.addEventListener('vite:preloadError', () => reload('vite-preload'));

  // 1) Dynamic imports rechazados — lazy() de React lo emite por acá
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reload('dynimport');
  });

  // 2) Errores JS síncronos
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error || event.message)) {
      reload('jserror');
      return;
    }
    // 3) <link>/<script> que fallaron al cargar (CSS roto incluido).
    // Solo se captura en fase capture y el evento NO bubble-ea.
    const url = isAssetTagFailure(event);
    if (url) reload('asset:' + url.slice(-40));
  }, true);

  // Borra el flag tras 5s OK — así, si más tarde hay otro deploy en la misma
  // sesión, volvemos a poder intentar el auto-reload.
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Spinner MenuBy - Liviano y Profesional
const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white">
    <div className="text-center">
      {/* Spinner limpio con doble anillo */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        {/* Anillo exterior */}
        <div className="absolute inset-0 rounded-full border-4 border-red-100" />
        {/* Anillo giratorio principal */}
        <div 
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        {/* Anillo giratorio secundario */}
        <div 
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-red-600 animate-spin"
          style={{ animationDuration: '1.2s', animationDirection: 'reverse' }}
        />
        {/* Centro */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg animate-pulse" />
        </div>
      </div>

      {/* Texto */}
      <h1 className="text-3xl font-bold text-red-600 mb-2">MenuBy</h1>
      <p className="text-slate-600 text-sm font-medium">Cargando...</p>

      {/* Puntos */}
      <div className="flex justify-center space-x-1.5 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
          />
        ))}
      </div>
    </div>
  </div>
);

// Creamos un componente Root que contendrá el AuthProvider
const Root = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  );
};

// Service Worker (push notifications). El ?v=8 es un cache-buster de URL: el
// sw.js SIN query quedó cacheado como `immutable` en el edge de Cloudflare
// (antes del fix de _headers) y el edge no lo revalida, así que servía por
// siempre el SW viejo con fetch handler. Registrando '/sw.js?v=8' el navegador
// pide una URL que el edge NO tiene cacheada → trae el SW nuevo desde origen.
// updateViaCache:'none' además salta la caché HTTP del navegador en cada chequeo.
const SW_URL = '/sw.js?v=8';
if ('serviceWorker' in navigator) {
  // Auto-curación: si un SW nuevo TOMA EL CONTROL a mitad de sesión (p.ej. el
  // usuario venía con el SW viejo con fetch handler que servía /assets/ roto),
  // recargamos UNA vez para que la página use el SW nuevo (sin fetch handler) y
  // los chunks se descarguen frescos del CDN. Solo recargamos si YA había un
  // controller previo (una actualización) — no en la primera instalación en un
  // navegador limpio, donde la página ya cargó bien directo del CDN.
  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    if (hadController) { refreshing = true; window.location.reload(); }
    hadController = true;
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        registration.update();
      })
      .catch(() => {
        // Error silencioso
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Root />
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
