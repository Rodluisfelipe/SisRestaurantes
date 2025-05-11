/**
 * Gestor de sesiones para la aplicación
 * 
 * Centraliza manejo de localStorage y sessionStorage con separación por contextos
 */

// Constantes para contextos
const CONTEXT = {
  CLIENT: 'client',      // Menú para clientes
  ADMIN: 'admin',        // Panel de administración 
  SUPER_ADMIN: 'superadmin' // Panel de superadmin
};

// Detectar el contexto actual basado en la URL
const detectCurrentContext = () => {
  const url = window.location.pathname;
  
  if (url.includes('/superadmin')) {
    return CONTEXT.SUPER_ADMIN;
  } else if (url.includes('/admin')) {
    return CONTEXT.ADMIN;
  } else {
    return CONTEXT.CLIENT;
  }
};

// Generar prefijo para las claves de storage
export const getPrefix = (context = null) => {
  const useContext = context || detectCurrentContext();
  return `${useContext}_`;
};

/**
 * Obtiene un valor del localStorage con el prefijo adecuado según el contexto
 */
export const getFromLocalStorage = (key, defaultValue = null, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    const storedValue = localStorage.getItem(prefixedKey);
    if (storedValue === null) return defaultValue;
    
    // Para valores JSON
    if (storedValue.startsWith('{') || storedValue.startsWith('[')) {
      try {
        return JSON.parse(storedValue);
      } catch (e) {
        return storedValue;
      }
    }
    
    return storedValue;
  } catch (error) {
    console.error(`Error recuperando ${prefixedKey} de localStorage:`, error);
    return defaultValue;
  }
};

/**
 * Guarda un valor en localStorage con el prefijo adecuado según el contexto
 */
export const saveToLocalStorage = (key, value, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(prefixedKey);
      return;
    }
    
    // Para objetos o arrays
    if (typeof value === 'object') {
      localStorage.setItem(prefixedKey, JSON.stringify(value));
    } else {
      localStorage.setItem(prefixedKey, value);
    }
  } catch (error) {
    console.error(`Error guardando ${prefixedKey} en localStorage:`, error);
  }
};

/**
 * Elimina un valor de localStorage con el prefijo adecuado según el contexto
 */
export const removeFromLocalStorage = (key, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    localStorage.removeItem(prefixedKey);
  } catch (error) {
    console.error(`Error eliminando ${prefixedKey} de localStorage:`, error);
  }
};

/**
 * Limpia todos los valores de localStorage para un contexto específico
 */
export const clearContextLocalStorage = (context = null) => {
  const prefix = getPrefix(context);
  
  try {
    // Iterar sobre todas las claves y eliminar las que coincidan con el prefijo
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error(`Error al limpiar localStorage para contexto ${context}:`, error);
  }
};

// Funciones para sessionStorage (similar a localStorage pero con duración de sesión)

export const getFromSessionStorage = (key, defaultValue = null, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    const storedValue = sessionStorage.getItem(prefixedKey);
    if (storedValue === null) return defaultValue;
    
    // Para valores JSON
    if (storedValue.startsWith('{') || storedValue.startsWith('[')) {
      try {
        return JSON.parse(storedValue);
      } catch (e) {
        return storedValue;
      }
    }
    
    return storedValue;
  } catch (error) {
    console.error(`Error recuperando ${prefixedKey} de sessionStorage:`, error);
    return defaultValue;
  }
};

export const saveToSessionStorage = (key, value, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    if (value === null || value === undefined) {
      sessionStorage.removeItem(prefixedKey);
      return;
    }
    
    // Para objetos o arrays
    if (typeof value === 'object') {
      sessionStorage.setItem(prefixedKey, JSON.stringify(value));
    } else {
      sessionStorage.setItem(prefixedKey, value);
    }
  } catch (error) {
    console.error(`Error guardando ${prefixedKey} en sessionStorage:`, error);
  }
};

export const removeFromSessionStorage = (key, context = null) => {
  const prefix = getPrefix(context);
  const prefixedKey = `${prefix}${key}`;
  
  try {
    sessionStorage.removeItem(prefixedKey);
  } catch (error) {
    console.error(`Error eliminando ${prefixedKey} de sessionStorage:`, error);
  }
};

export const clearContextSessionStorage = (context = null) => {
  const prefix = getPrefix(context);
  
  try {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error(`Error al limpiar sessionStorage para contexto ${context}:`, error);
  }
};

// Funciones específicas para compatibilidad con código existente

export const isQRMode = () => {
  return getFromLocalStorage('isTableQRSession', false) === 'true' || getTableNumberFromURL() !== null;
};

export const getTableNumberFromURL = () => {
  // Detectar número de mesa desde URL (para compatibilidad)
  const path = window.location.pathname;
  const matches = path.match(/\/mesa\/(\d+)/);
  return matches ? matches[1] : null;
};

export const getSavedCustomerName = () => {
  return getFromLocalStorage('customerName', '');
};

export const saveOrderInfo = (orderInfo) => {
  saveToLocalStorage('orderInfo', orderInfo);
  saveToSessionStorage('orderInfo', orderInfo);
};

export const loadOrderInfo = () => {
  // Intentar obtener de sessionStorage primero, luego de localStorage
  return getFromSessionStorage('orderInfo', getFromLocalStorage('orderInfo', null));
};

export const getFromSession = (key, defaultValue = null) => {
  return getFromSessionStorage(key, defaultValue);
};

export const saveToSession = (key, value) => {
  saveToSessionStorage(key, value);
}; 