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

// Constantes para modo QR
const QR_MODE_PREFIX = 'qr_session_';
const NORMAL_MODE_PREFIX = 'normal_session_';

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

// Verificar si estamos en modo QR basado solo en la URL actual
export const isQRMode = () => {
  return window.location.pathname.includes('/mesa/') || 
         getFromLocalStorage('isTableQRSession', false) === 'true' || 
         getTableNumberFromURL() !== null;
};

// Obtener el prefijo correcto según el modo y contexto
export const getPrefix = (context = null) => {
  const useContext = context || detectCurrentContext();
  return `${useContext}_`;
};

// Detectar número de mesa desde URL (para compatibilidad)
export const getTableNumberFromURL = () => {
  const path = window.location.pathname;
  const matches = path.match(/\/mesa\/(\d+)/);
  return matches ? matches[1] : null;
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

// Solo para modo normal: obtener el nombre del cliente guardado
export const getSavedCustomerName = () => {
  return getFromLocalStorage('customerName', '');
};

// Alias para compatibilidad
export const getFromSession = (key, defaultValue = null) => {
  return getFromSessionStorage(key, defaultValue);
};

// Alias para compatibilidad
export const saveToSession = (key, value) => {
  saveToSessionStorage(key, value);
};

// Guardar la información del pedido
export const saveOrderInfo = (orderInfo) => {
  if (!orderInfo) return; // Prevenir errores con datos nulos
  
  if (!isQRMode()) {
    // En modo normal, guardamos el nombre del cliente si existe para futuras sesiones
    if (orderInfo.customerName) {
      saveToLocalStorage('customerName', orderInfo.customerName);
    }
    
    // Para el modo normal, creamos una copia sin el número de mesa
    const sessionOrderInfo = { ...orderInfo };
    
    // Eliminamos el número de mesa completamente
    delete sessionOrderInfo.tableNumber;
    
    saveToSessionStorage('orderInfo', sessionOrderInfo);
  } else {
    // En modo QR, guardamos la información completa en sessionStorage
    saveToSessionStorage('orderInfo', orderInfo);
  }
};

// Cargar la información del pedido
export const loadOrderInfo = (defaultValue = null) => {
  const orderInfo = getFromSessionStorage('orderInfo', defaultValue);
  
  // En modo normal, asegurarse de no recuperar el número de mesa
  if (!isQRMode() && orderInfo) {
    if (orderInfo.tableNumber) {
      delete orderInfo.tableNumber;
    }
  }
  
  return orderInfo;
};

// Limpiar todos los datos de la sesión actual
export const clearCurrentSession = () => {
  const context = detectCurrentContext();
  
  console.log('Limpiando sesión actual con contexto:', context);
  
  clearContextSessionStorage(context);
  
  // Si estamos en modo normal, también limpiar cualquier número de mesa
  if (!isQRMode()) {
    if (localStorage.getItem('tableNumber')) {
      console.log('Eliminando tableNumber de localStorage');
      localStorage.removeItem('tableNumber');
    }
  }
};

// Limpiar ambas sesiones
export const clearAllSessions = () => {
  sessionStorage.clear();
}; 