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
           message.includes('property') && message.includes('ignored') ||
           message.includes('url is invalid') ||
           message.includes('start_url') ||
           message.includes('scope') ||
           message.includes('shortcut') ||
           message.includes('not present');
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

  // Deshabilitar React DevTools
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: true,
    supportsFiber: true,
    inject: () => {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };
}
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./Context/AuthContext";
import { ThemeProvider } from "./Context/ThemeContext";
import ErrorBoundary from "./Components/ErrorBoundary";
import App from "./App.jsx";

// Lazy loading del componente App
const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
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
