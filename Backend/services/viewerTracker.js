const logger = require('../utils/logger');
const ViewerSession = require('../Models/ViewerSession');

/**
 * Servicio de tracking de visitantes en vivo por negocio.
 * Almacena en memoria (Map) las sesiones activas de clientes viendo el menú.
 * Al desconectarse, persiste la sesión en MongoDB para analytics históricos.
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
    currentCategory: data.currentCategory || null,
    source: data.source || 'direct',
    referrer: data.referrer || null,
    cartItems: data.cartItems || 0,
    cartTotal: data.cartTotal || 0,
    cartProducts: Array.isArray(data.cartProducts) ? data.cartProducts.slice(0, 20) : [],
    isReturning: false,
    previousOrders: 0
  };
  
  businessViewers.get(bid).set(socketId, viewer);
  
  logger.info(`[ViewerTracker] Viewer joined: ${viewer.customerName} → business ${bid} (source: ${viewer.source})`, {
    socketId, businessId: bid, totalViewers: businessViewers.get(bid).size, source: viewer.source
  });
  
  return viewer;
}

/**
 * Elimina un viewer (desconexión o salida) y persiste la sesión en MongoDB.
 * Retorna { removed: true, viewer } o { removed: false }.
 */
function removeViewer(businessId, socketId) {
  if (!businessId || !socketId) return { removed: false };
  
  const bid = businessId.toString();
  const viewers = businessViewers.get(bid);
  
  if (!viewers) return { removed: false };
  
  const viewer = viewers.get(socketId);
  const removed = viewers.delete(socketId);
  
  // Limpiar Map vacío
  if (viewers.size === 0) {
    businessViewers.delete(bid);
  }
  
  if (removed && viewer) {
    const duration = Math.round((Date.now() - viewer.enteredAt.getTime()) / 1000);
    logger.info(`[ViewerTracker] Viewer left: ${viewer.customerName} → business ${bid} (${duration}s, cart: $${viewer.cartTotal})`, {
      socketId, businessId: bid, duration, cartTotal: viewer.cartTotal
    });
    
    // Persist to MongoDB (fire and forget)
    persistSession(bid, viewer).catch(err => {
      logger.warn('[ViewerTracker] Error persisting session', { error: err.message });
    });
    
    return { removed: true, viewer, duration };
  }
  
  return { removed: false };
}

/**
 * Busca y elimina un viewer por socketId en TODOS los negocios.
 * Retorna { businessId, viewer } o null.
 */
function removeViewerBySocketId(socketId) {
  for (const [bid, viewers] of businessViewers.entries()) {
    if (viewers.has(socketId)) {
      const result = removeViewer(bid, socketId);
      if (result.removed) {
        return { businessId: bid, viewer: result.viewer };
      }
    }
  }
  return null;
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
      if (data.currentCategory !== undefined) viewer.currentCategory = data.currentCategory;
      if (data.cartItems !== undefined) viewer.cartItems = data.cartItems;
      if (data.cartTotal !== undefined) viewer.cartTotal = data.cartTotal;
      if (Array.isArray(data.cartProducts)) viewer.cartProducts = data.cartProducts.slice(0, 20);
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
      currentCategory: viewer.currentCategory,
      source: viewer.source,
      cartItems: viewer.cartItems,
      cartTotal: viewer.cartTotal,
      cartProducts: viewer.cartProducts || [],
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
 * Persiste una sesión de viewer en MongoDB al desconectarse.
 */
async function persistSession(businessId, viewer) {
  try {
    const duration = Math.round((Date.now() - viewer.enteredAt.getTime()) / 1000);
    
    // No persistir sesiones muy cortas (menos de 5 segundos — bots, reloads accidentales)
    if (duration < 5) return null;
    
    // Deduplicar: si el mismo phone+business ya tiene una sesión NO convertida hoy, actualizarla
    // en vez de crear una nueva (evita inflar carritos abandonados por múltiples visitas del mismo cliente)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    let session = null;
    
    if (viewer.phone) {
      session = await ViewerSession.findOneAndUpdate(
        {
          businessId,
          phone: viewer.phone,
          converted: false,
          enteredAt: { $gte: todayStart }
        },
        {
          $set: {
            customerName: viewer.customerName,
            device: viewer.device,
            source: viewer.source || 'direct',
            referrer: viewer.referrer,
            leftAt: new Date(),
            lastCategory: viewer.currentCategory,
            cartProducts: (viewer.cartProducts || []).slice(0, 20),
            cartTotal: viewer.cartTotal || 0,
            isReturning: viewer.isReturning,
            previousOrders: viewer.previousOrders
          },
          $inc: { duration: duration } // acumular tiempo total
        },
        { sort: { enteredAt: -1 }, new: true }
      );
    }
    
    // Si no encontró sesión existente (cliente nuevo o sin phone), crear una nueva
    if (!session) {
      session = new ViewerSession({
        businessId,
        customerName: viewer.customerName,
        phone: viewer.phone,
        device: viewer.device,
        source: viewer.source || 'direct',
        referrer: viewer.referrer,
        enteredAt: viewer.enteredAt,
        leftAt: new Date(),
        duration,
        lastCategory: viewer.currentCategory,
        cartProducts: (viewer.cartProducts || []).slice(0, 20),
        cartTotal: viewer.cartTotal || 0,
        converted: false,
        isReturning: viewer.isReturning,
        previousOrders: viewer.previousOrders
      });
      await session.save();
    }
    
    // Log abandoned cart
    if (viewer.cartTotal > 0) {
      logger.info(`[ViewerTracker] Abandoned cart: ${viewer.customerName} left with $${viewer.cartTotal}`, {
        businessId, phone: viewer.phone, cartTotal: viewer.cartTotal,
        products: (viewer.cartProducts || []).map(p => p.name).join(', ')
      });
    }
    
    return session;
  } catch (err) {
    logger.error('[ViewerTracker] Error saving session to MongoDB', { error: err.message });
    return null;
  }
}

/**
 * Marca la última sesión de un cliente como convertida (hizo pedido).
 * Llamar desde el flujo de creación de ordenes.
 */
async function markConverted(businessId, phone) {
  try {
    if (!businessId || !phone) return;
    
    // Buscar la sesión más reciente de este phone en este business (últimos 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const session = await ViewerSession.findOneAndUpdate(
      {
        businessId,
        phone,
        enteredAt: { $gte: thirtyMinAgo },
        converted: false
      },
      { converted: true },
      { sort: { enteredAt: -1 }, new: true }
    );
    
    if (session) {
      logger.info(`[ViewerTracker] Session marked as converted: ${session.customerName}`, {
        businessId, phone, sessionId: session._id
      });
    }
    
    return session;
  } catch (err) {
    logger.error('[ViewerTracker] Error marking session as converted', { error: err.message });
    return null;
  }
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
  markConverted,
  cleanupStale,
  getStats
};
