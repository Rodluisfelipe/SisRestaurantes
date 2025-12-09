import React from "react";
import ReactDOM from "react-dom/client";

// SOBRESCRITURA NUCLEAR DE CONSOLE - Filtrar TODO lo relacionado con PWA y React DevTools
if (typeof window !== 'undefined') {
  // Guardar referencias originales
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  
  // Función de filtrado agresiva
  const shouldFilter = (...args) => {
    const message = String(args.join(' ')).toLowerCase();
    return message.includes('react devtools') || 
           message.includes('development experience') ||
           message.includes('download the react devtools') ||
           message.includes('reactjs.org/link/react-devtools') ||
           message.includes('better development experience') ||
           message.includes('manifest:') ||
           (message.includes('property') && message.includes('ignored')) ||
           message.includes('url is invalid') ||
           message.includes('start_url') ||
           message.includes('scope') ||
           message.includes('shortcut') ||
           message.includes('not present') ||
           message.includes('fetch event handler is recognized as no-op') ||
           message.includes('no-op fetch handler') ||
           message.includes('may bring overhead during navigation') ||
           message.includes('consider removing the handler') ||
           message.includes('detectado token en url') ||
           message.includes('parámetros detectados') ||
           message.includes('ruta actual') ||
           message.includes('search params');
  };

  // Sobrescribir TODOS los métodos de console
  console.log = (...args) => {
    if (!shouldFilter(...args)) {
      originalLog.apply(console, args);
    }
  };

  console.warn = (...args) => {
    if (!shouldFilter(...args)) {
      originalWarn.apply(console, args);
    }
  };

  console.error = (...args) => {
    if (!shouldFilter(...args)) {
      originalError.apply(console, args);
    }
  };

  console.info = (...args) => {
    if (!shouldFilter(...args)) {
      originalInfo.apply(console, args);
    }
  };

  // No intentar modificar React DevTools - solo filtrar sus mensajes en console
  // Si DevTools está instalado, dejarlo funcionar normalmente
}
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./Context/AuthContext";
import { ThemeProvider } from "./Context/ThemeContext";
import ErrorBoundary from "./Components/ErrorBoundary";
import App from "./App.jsx";

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
    navigator.serviceWorker.register('/sw.js?v=3')
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
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Root />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
