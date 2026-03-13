import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";

// Inicializar Sentry - Monitoreo de errores en producción
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Performance monitoring - captura 20% de transacciones
  tracesSampleRate: 0.2,
  // Session Replay - captura 10% normal, 100% en errores
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // Do NOT send PII (IP, user agent)
  sendDefaultPii: false,
});

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

// Service Worker temporal para limpiar caché
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=6')
      .then((registration) => {
        // Service Worker registrado para limpiar caché
        registration.update();
      })
      .catch((registrationError) => {
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
