// Sistema de logging centralizado y limpio
const isDevelopment = import.meta.env.DEV;

// Solo mostrar logs críticos del sistema
export const logger = {
  info: (...args) => {
    // Solo mostrar en desarrollo y solo mensajes importantes
    if (isDevelopment && args[0]?.includes('[SISTEMA]')) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    // Siempre mostrar errores
    console.error(...args);
  },
  
  warn: (...args) => {
    // Solo mostrar advertencias críticas
    if (args[0]?.includes('[SISTEMA]')) {
      console.warn(...args);
    }
  },
  
  debug: () => {
    // Deshabilitar debug logs
  }
};

export default logger;