const logger = require('../utils/logger');

/**
 * Servicio de tracking de visitantes en vivo por negocio.
 * Almacena en memoria (Map) las sesiones activas de clientes viendo el menú.
 * 
 * Cada negocio tiene un Map de socketId -> viewerData.
 * Se limpia automáticamente cuando el socket se desconecta o no envía heartbeat en 90s.
 */

// businessId -> Map<socketId, viewerData>
const businessViewers = new Map();

// Tiempo máximo sin heartbeat antes de considerar al viewer como inactivo (90 segundos)
const HEARTBEAT_TIMEOUT = 90 * 1000;

/**
 * Registra un nuevo viewer para un negocio
 */
function addViewer(businessId, socketId, data) {
  if (!businessId || !socketId) return null;
  
  const bid = businessId.toString();
  
  if (!businessViewers.has(bid)) {
    businessViewers.set(bid, new Map());
  }
  
  const viewer = {
    socketId,
    customerName: data.customerName || 'Anónimo',
    phone: data.phone || null,
    device: data.device || null,
    enteredAt: new Date(),
    lastHeartbeat: new Date(),
    currentView: data.currentView || 'menu',
    cartItems: data.cartItems || 0,
    cartTotal: data.cartTotal || 0,
    isReturning: false,
    previousOrders: 0
  };
  
  businessViewers.get(bid).set(socketId, viewer);
  
  logger.info(`[ViewerTracker] Viewer joined: ${viewer.customerName} → business ${bid}`, {
    socketId, businessId: bid, totalViewers: businessViewers.get(bid).size
  });
  
  return viewer;
}

/**
 * Elimina un viewer (desconexión o salida)
 */
function removeViewer(businessId, socketId) {
  if (!businessId || !socketId) return false;
  
  const bid = businessId.toString();
  const viewers = businessViewers.get(bid);
  
  if (!viewers) return false;
  
  const viewer = viewers.get(socketId);
  const removed = viewers.delete(socketId);
  
  // Limpiar Map vacío
  if (viewers.size === 0) {
    businessViewers.delete(bid);
  }
  
  if (removed && viewer) {
    const duration = Math.round((Date.now() - viewer.enteredAt.getTime()) / 1000);
    logger.info(`[ViewerTracker] Viewer left: ${viewer.customerName} → business ${bid} (${duration}s)`, {
      socketId, businessId: bid, duration
    });
  }
  
  return removed;
}

/**
 * Busca y elimina un viewer por socketId en TODOS los negocios
 * (para cuando se desconecta sin haber hecho viewer:leave)
 */
function removeViewerBySocketId(socketId) {
  let removedFrom = null;
  
  for (const [bid, viewers] of businessViewers.entries()) {
    if (viewers.has(socketId)) {
      removeViewer(bid, socketId);
      removedFrom = bid;
      break;
    }
  }
  
  return removedFrom;
}

/**
 * Actualiza el heartbeat de un viewer
 */
function heartbeat(socketId, data = {}) {
  for (const [bid, viewers] of businessViewers.entries()) {
    const viewer = viewers.get(socketId);
    if (viewer) {
      viewer.lastHeartbeat = new Date();
      if (data.currentView) viewer.currentView = data.currentView;
      if (data.cartItems !== undefined) viewer.cartItems = data.cartItems;
      if (data.cartTotal !== undefined) viewer.cartTotal = data.cartTotal;
      return bid;
    }
  }
  return null;
}

/**
 * Obtiene todos los viewers activos de un negocio
 */
function getViewers(businessId) {
  if (!businessId) return [];
  
  const bid = businessId.toString();
  const viewers = businessViewers.get(bid);
  
  if (!viewers || viewers.size === 0) return [];
  
  const now = Date.now();
  const result = [];
  
  for (const [socketId, viewer] of viewers.entries()) {
    // Verificar timeout de heartbeat
    if (now - viewer.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT) {
      viewers.delete(socketId);
      logger.debug(`[ViewerTracker] Stale viewer removed: ${viewer.customerName}`, { socketId, businessId: bid });
      continue;
    }
    
    result.push({
      customerName: viewer.customerName,
      phone: viewer.phone ? maskPhone(viewer.phone) : null,
      device: viewer.device,
      enteredAt: viewer.enteredAt,
      duration: Math.round((now - viewer.enteredAt.getTime()) / 1000),
      currentView: viewer.currentView,
      cartItems: viewer.cartItems,
      cartTotal: viewer.cartTotal,
      isReturning: viewer.isReturning,
      previousOrders: viewer.previousOrders
    });
  }
  
  // Limpiar Map vacío después de purgar stale
  if (viewers.size === 0) {
    businessViewers.delete(bid);
  }
  
  return result;
}

/**
 * Obtiene solo el conteo de viewers activos
 */
function getViewerCount(businessId) {
  return getViewers(businessId).length;
}

/**
 * Enmascara un número de teléfono para privacidad
 * "3028181520" -> "302***1520"
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '***' + phone.slice(-4);
}

/**
 * Marca un viewer como cliente recurrente
 */
function markReturning(businessId, socketId, previousOrders) {
  const bid = businessId.toString();
  const viewers = businessViewers.get(bid);
  if (!viewers) return;
  
  const viewer = viewers.get(socketId);
  if (viewer) {
    viewer.isReturning = true;
    viewer.previousOrders = previousOrders;
  }
}

/**
 * Limpieza periódica de viewers inactivos (llamada desde el exterior)
 */
function cleanupStale() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [bid, viewers] of businessViewers.entries()) {
    for (const [socketId, viewer] of viewers.entries()) {
      if (now - viewer.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT) {
        viewers.delete(socketId);
        cleaned++;
      }
    }
    if (viewers.size === 0) {
      businessViewers.delete(bid);
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`[ViewerTracker] Cleaned ${cleaned} stale viewers`);
  }
  
  return cleaned;
}

/**
 * Estadísticas globales (para debug)
 */
function getStats() {
  let totalViewers = 0;
  const businesses = {};
  
  for (const [bid, viewers] of businessViewers.entries()) {
    businesses[bid] = viewers.size;
    totalViewers += viewers.size;
  }
  
  return { totalViewers, businesses };
}

module.exports = {
  addViewer,
  removeViewer,
  removeViewerBySocketId,
  heartbeat,
  getViewers,
  getViewerCount,
  markReturning,
  cleanupStale,
  getStats
};
