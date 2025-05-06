/**
 * Gestor de sesiones para mantener completamente separados
 * los datos del modo QR y modo menú normal
 */

// Claves para sessionStorage - más volátil que localStorage
const QR_MODE_PREFIX = 'qr_session_';
const NORMAL_MODE_PREFIX = 'normal_session_';

// Verificar si estamos en modo QR basado solo en la URL actual
export const isQRMode = () => {
  return window.location.pathname.includes('/mesa/');
};

// Obtener el prefijo correcto según el modo
export const getPrefix = () => {
  return isQRMode() ? QR_MODE_PREFIX : NORMAL_MODE_PREFIX;
};

// Guardar datos en la sesión apropiada
export const saveToSession = (key, value) => {
  const prefix = getPrefix();
  try {
    sessionStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error("Error guardando en sessionStorage:", error);
  }
};

// Obtener datos de la sesión apropiada
export const getFromSession = (key, defaultValue = null) => {
  const prefix = getPrefix();
  try {
    const item = sessionStorage.getItem(`${prefix}${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error("Error leyendo de sessionStorage:", error);
    return defaultValue;
  }
};

// Eliminar datos de la sesión apropiada
export const removeFromSession = (key) => {
  const prefix = getPrefix();
  sessionStorage.removeItem(`${prefix}${key}`);
};

// Limpiar todos los datos de la sesión actual
export const clearCurrentSession = () => {
  const prefix = getPrefix();
  
  console.log('Limpiando sesión actual con prefijo:', prefix);
  
  // Eliminar todos los elementos con el prefijo actual
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(prefix)) {
      console.log('Eliminando clave de sesión:', key);
      sessionStorage.removeItem(key);
    }
  });
  
  // Si estamos en modo normal, también limpiar cualquier número de mesa que
  // podría haberse guardado en localStorage (no debería ocurrir, pero por si acaso)
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

// Obtener número de mesa de URL (solo para modo QR)
export const getTableNumberFromURL = () => {
  if (!isQRMode()) return null;
  
  const matches = window.location.pathname.match(/\/mesa\/(\w+)/);
  return matches && matches[1] ? matches[1] : null;
};

// Solo para modo normal: guardar el nombre del cliente
export const saveCustomerName = (name) => {
  if (!isQRMode() && name) {
    localStorage.setItem('customerName', name);
  }
};

// Solo para modo normal: obtener el nombre del cliente guardado
export const getSavedCustomerName = () => {
  return localStorage.getItem('customerName') || '';
};

// Guardar la información del pedido asegurándose que en modo normal no se guarde la mesa en ningún lugar
export const saveOrderInfo = (orderInfo) => {
  if (!orderInfo) return; // Prevenir errores con datos nulos
  
  if (!isQRMode()) {
    // En modo normal, guardamos el nombre del cliente si existe para futuras sesiones
    if (orderInfo.customerName) {
      saveCustomerName(orderInfo.customerName);
    }
    
    // Para el modo normal, creamos una copia sin el número de mesa
    const sessionOrderInfo = { ...orderInfo };
    
    // Eliminamos el número de mesa completamente - IMPORTANTE: asegurarnos que se elimina de verdad
    delete sessionOrderInfo.tableNumber;
    
    // Verificación adicional para garantizar que no se guarde tableNumber
    if (sessionOrderInfo.tableNumber !== undefined) {
      console.warn("Advertencia: tableNumber aún presente después del delete. Forzando eliminación.");
      sessionOrderInfo.tableNumber = '';  // Como plan B, al menos dejarlo vacío
    }
    
    console.log("Guardando orderInfo en modo normal (sin tableNumber):", sessionOrderInfo);
    saveToSession('orderInfo', sessionOrderInfo);
  } else {
    // En modo QR, guardamos la información completa en sessionStorage
    console.log("Guardando orderInfo en modo QR:", orderInfo);
    saveToSession('orderInfo', orderInfo);
  }
};

// Cargar la información del pedido
export const loadOrderInfo = (defaultValue = null) => {
  const orderInfo = getFromSession('orderInfo', defaultValue);
  
  // En modo normal, asegurarse de no recuperar el número de mesa
  if (!isQRMode() && orderInfo) {
    // Si hay un número de mesa (no debería), lo eliminamos
    if (orderInfo.tableNumber) {
      delete orderInfo.tableNumber;
      console.log("Se eliminó tableNumber al cargar orderInfo en modo normal");
    }
  }
  
  return orderInfo;
}; 