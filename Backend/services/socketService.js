// Servicio para manejar sockets y rooms por negocio
let ioInstance = null;
const connectedClients = new Map(); // Track connected clients
const { verifyToken } = require('../config/jwt');
const logger = require('../utils/logger');
const viewerTracker = require('./viewerTracker');

// Slug cache to avoid DB lookups on every emit
const slugCache = new Map(); // businessId -> { slug, cachedAt }
const SLUG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    const sessionId = socket.handshake.query.sessionId;
    const clientType = socket.handshake.query.clientType;
    logger.info('Socket cliente conectado', { socketId: socket.id, sessionId, clientType });

    // Autenticación por JWT en el handshake
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const authToken = socket.handshake.auth?.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
      if (authToken) {
        const decoded = verifyToken(authToken);
        if (decoded) {
          socket.user = decoded; // { id, businessId? }
        }
      }
    } catch (e) {
      logger.warn('Socket auth error', { socketId: socket.id, error: e?.message });
    }
    connectedClients.set(socket.id, { 
      socket, 
      businessId: null, 
      connectedAt: new Date(),
      sessionId,
      clientType
    });

    // Unirse a un room por businessId con validación de pertenencia
    socket.on('joinBusiness', async (businessIdOrPayload) => {
      // Support both: joinBusiness(businessId) and joinBusiness({ businessId, token })
      let businessId, inlineToken;
      if (typeof businessIdOrPayload === 'object' && businessIdOrPayload !== null) {
        businessId = businessIdOrPayload.businessId;
        inlineToken = businessIdOrPayload.token;
      } else {
        businessId = businessIdOrPayload;
      }
      
      if (businessId) {
        try {
          // If socket.user is not set, try to authenticate with inline token or handshake auth
          if (!socket.user) {
            const tokenToTry = inlineToken || socket.handshake.auth?.token;
            if (tokenToTry) {
              try {
                const decoded = verifyToken(tokenToTry);
                if (decoded) {
                  socket.user = decoded;
                  logger.info('Socket authenticated via joinBusiness token', { socketId: socket.id });
                }
              } catch (e) {
                logger.warn('joinBusiness inline token invalid', { socketId: socket.id, error: e.message });
              }
            }
          }
          
          // Enforce tenant guard: requiere socket.user y coincidencia de tenant (excepto SuperAdmin)
          if (!socket.user) {
            logger.warn('joinBusiness rechazado - no autenticado', { socketId: socket.id, businessId });
            socket.emit('businessJoined', { businessId, success: false, error: 'unauthorized' });
            return;
          }

          // SuperAdmins pueden unirse a cualquier negocio
          const isSuperAdmin = socket.user.role === 'superadmin' || socket.user.isSuperAdmin;

          if (!isSuperAdmin) {
            // Resolve slug to ObjectId if needed
            let resolvedBusinessId = businessId.toString();
            const tenantBusiness = (socket.user.businessId || '').toString();
            
            // If requestedBusiness is a slug (not a 24-char hex ObjectId), resolve it
            if (!/^[0-9a-fA-F]{24}$/.test(resolvedBusinessId)) {
              try {
                const { resolveBusinessId } = require('../utils/businessResolver');
                resolvedBusinessId = (await resolveBusinessId(resolvedBusinessId)).toString();
              } catch (e) {
                logger.warn('joinBusiness - could not resolve slug', { socketId: socket.id, slug: businessId, error: e.message });
              }
            }

            if (!tenantBusiness || tenantBusiness !== resolvedBusinessId) {
              logger.warn('joinBusiness rechazado - tenant mismatch', { socketId: socket.id, tokenTenant: tenantBusiness, requested: resolvedBusinessId, original: businessId });
              socket.emit('businessJoined', { businessId, success: false, error: 'forbidden' });
              return;
            }
            
            // Use the resolved ObjectId for room joining
            businessId = resolvedBusinessId;
          }

          // Leave previous business room if any
          const clientInfo = connectedClients.get(socket.id);
          if (clientInfo && clientInfo.businessId) {
            socket.leave(clientInfo.businessId);
            logger.debug('Socket salió del negocio anterior', { socketId: socket.id, previousBusiness: clientInfo.businessId });
          }

          // Join new business room
          socket.join(businessId);
          socket.join(businessId.toString()); // Also join string version
          
          // Update client info
          connectedClients.set(socket.id, { 
            ...clientInfo, 
            businessId: businessId.toString(),
            joinedAt: new Date()
          });
          
          const clientCount = io.sockets.adapter.rooms.get(businessId.toString())?.size || 0;
          logger.info('Socket se unió al negocio', { socketId: socket.id, businessId, clientCount });
          
          // Confirm join to client
          socket.emit('businessJoined', { businessId, success: true });
          
        } catch (error) {
          logger.error('Error joining business room', error);
          socket.emit('businessJoined', { businessId, success: false, error: error.message });
        }
      }
    });

    // Unirse a un canal específico para superadmin (requires auth + superadmin role)
    socket.on('joinSuperAdmin', () => {
      if (!socket.user) {
        logger.warn('joinSuperAdmin rejected - not authenticated', { socketId: socket.id });
        socket.emit('superAdminJoined', { success: false, error: 'unauthorized' });
        return;
      }
      const isSuperAdmin = socket.user.role === 'superadmin' || socket.user.isSuperAdmin;
      if (!isSuperAdmin) {
        logger.warn('joinSuperAdmin rejected - not superadmin', { socketId: socket.id, role: socket.user.role });
        socket.emit('superAdminJoined', { success: false, error: 'forbidden' });
        return;
      }
      socket.join('superadmin-channel');
      logger.info('Socket se unió al canal de superadmin', { socketId: socket.id });
      socket.emit('superAdminJoined', { success: true });
    });

    // Salir de un room
    socket.on('leaveBusiness', (businessId) => {
      if (businessId) {
        socket.leave(businessId);
        logger.debug('Socket salió del negocio', { socketId: socket.id, businessId });
      }
    });

    // Salir del canal de superadmin
    socket.on('leaveSuperAdmin', () => {
      socket.leave('superadmin-channel');
      logger.debug('Socket salió del canal de superadmin', { socketId: socket.id });
    });

    // Test connection endpoint
    socket.on('ping', () => {
      logger.debug('Ping received', { socketId: socket.id });
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Customer order tracking — join per-order room without requiring auth
    socket.on('trackOrder', async ({ orderId, customerToken }) => {
      if (!orderId || !customerToken) {
        socket.emit('trackOrderResult', { success: false, error: 'Missing orderId or customerToken' });
        return;
      }
      try {
        const Order = require('../Models/Order');
        const order = await Order.findById(orderId).select('customerToken status').lean();
        if (!order || order.customerToken !== customerToken) {
          socket.emit('trackOrderResult', { success: false, error: 'Order not found or token mismatch' });
          return;
        }
        socket.join(`order:${orderId}`);
        logger.debug('Customer joined order tracking room', { socketId: socket.id, orderId });
        socket.emit('trackOrderResult', { success: true, orderId, status: order.status });
      } catch (error) {
        logger.error('Error in trackOrder', { error: error.message });
        socket.emit('trackOrderResult', { success: false, error: 'Server error' });
      }
    });

    socket.on('untrackOrder', (orderId) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
        logger.debug('Customer left order tracking room', { socketId: socket.id, orderId });
      }
    });

    // === VIEWER TRACKING (no auth required — customers viewing the menu) ===
    
    socket.on('viewer:join', async (data) => {
      if (!data || !data.businessId) return;
      
      const businessId = data.businessId.toString();
      const viewer = viewerTracker.addViewer(businessId, socket.id, {
        customerName: data.customerName,
        phone: data.phone,
        device: data.device,
        currentView: 'menu',
        source: data.source || 'direct',
        referrer: data.referrer || null,
        currentCategory: data.currentCategory || null
      });
      
      if (!viewer) return;
      
      // Check if returning customer
      try {
        if (data.phone) {
          const Customer = require('../Models/Customer');
          const customer = await Customer.findOne({ phone: data.phone, businessId }).select('totalOrders').lean();
          if (customer && customer.totalOrders > 0) {
            viewerTracker.markReturning(businessId, socket.id, customer.totalOrders);
          }
        }
      } catch (err) {
        logger.warn('[ViewerTracker] Error checking returning customer', { error: err.message });
      }
      
      // Store businessId on socket for cleanup on disconnect
      socket._viewerBusinessId = businessId;
      
      // Emit updated viewer list to admin panel
      const viewers = viewerTracker.getViewers(businessId);
      emitToBusiness(businessId, 'viewers_updated', {
        count: viewers.length,
        viewers
      });
    });
    
    socket.on('viewer:heartbeat', (data) => {
      const businessId = viewerTracker.heartbeat(socket.id, data || {});
      if (businessId) {
        // Emit updated list only if cart changed
        if (data && (data.cartItems !== undefined || data.currentView)) {
          const viewers = viewerTracker.getViewers(businessId);
          emitToBusiness(businessId, 'viewers_updated', {
            count: viewers.length,
            viewers
          });
        }
      }
    });
    
    socket.on('viewer:leave', () => {
      const result = viewerTracker.removeViewerBySocketId(socket.id);
      if (result && result.businessId) {
        const viewers = viewerTracker.getViewers(result.businessId);
        emitToBusiness(result.businessId, 'viewers_updated', {
          count: viewers.length,
          viewers
        });
        // Emit abandoned cart alert if viewer had items
        if (result.viewer && result.viewer.cartTotal > 0) {
          emitToBusiness(result.businessId, 'cart_abandoned', {
            customerName: result.viewer.customerName,
            phone: result.viewer.phone,
            cartTotal: result.viewer.cartTotal,
            cartProducts: result.viewer.cartProducts || [],
            duration: Math.round((Date.now() - result.viewer.enteredAt.getTime()) / 1000)
          });
        }
      }
    });

    socket.on('disconnect', () => {
      // Clean up viewer tracking on disconnect
      const viewerBid = socket._viewerBusinessId;
      if (viewerBid) {
        const result = viewerTracker.removeViewer(viewerBid, socket.id);
        if (result.removed) {
          const viewers = viewerTracker.getViewers(viewerBid);
          emitToBusiness(viewerBid, 'viewers_updated', {
            count: viewers.length,
            viewers
          });
          // Emit abandoned cart alert
          if (result.viewer && result.viewer.cartTotal > 0) {
            emitToBusiness(viewerBid, 'cart_abandoned', {
              customerName: result.viewer.customerName,
              phone: result.viewer.phone,
              cartTotal: result.viewer.cartTotal,
              cartProducts: result.viewer.cartProducts || [],
              duration: result.duration || 0
            });
          }
        }
      } else {
        // Fallback: search all businesses
        const result = viewerTracker.removeViewerBySocketId(socket.id);
        if (result && result.businessId) {
          const viewers = viewerTracker.getViewers(result.businessId);
          emitToBusiness(result.businessId, 'viewers_updated', {
            count: viewers.length,
            viewers
          });
          if (result.viewer && result.viewer.cartTotal > 0) {
            emitToBusiness(result.businessId, 'cart_abandoned', {
              customerName: result.viewer.customerName,
              phone: result.viewer.phone,
              cartTotal: result.viewer.cartTotal,
              cartProducts: result.viewer.cartProducts || [],
              duration: Math.round((Date.now() - result.viewer.enteredAt.getTime()) / 1000)
            });
          }
        }
      }
      
      const clientInfo = connectedClients.get(socket.id);
      if (clientInfo) {
        logger.info('Cliente desconectado', { socketId: socket.id, sessionId: clientInfo.sessionId, clientType: clientInfo.clientType });
        connectedClients.delete(socket.id);
      }
    });
  });
}

async function emitToBusiness(businessId, event, data) {
  if (!ioInstance || !businessId) {
    logger.warn('Cannot emit to business - ioInstance or businessId missing', { ioInstance: !!ioInstance, businessId });
    return;
  }
  
  try {
    // Convert ObjectId to string if needed
    const roomId = businessId.toString();
    
    // Check how many clients are in the room
    const roomClients = ioInstance.sockets.adapter.rooms.get(roomId);
    const clientCount = roomClients?.size || 0;
    
    logger.debug(`Emitting ${event} to business`, { roomId, clientCount });
    
    if (clientCount === 0) {
      logger.warn(`No clients connected to business - event may not be received`, { roomId });
    }
    
    // Emit to the main room
    ioInstance.to(roomId).emit(event, data);
    
    // If businessId looks like an ObjectId, also try to emit to slug (cached)
    if (roomId.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        let slug = null;
        const cached = slugCache.get(roomId);
        if (cached && (Date.now() - cached.cachedAt) < SLUG_CACHE_TTL) {
          slug = cached.slug;
        } else {
          const BusinessConfig = require('../Models/BusinessConfig');
          const business = await BusinessConfig.findById(roomId).select('slug').lean();
          if (business?.slug) {
            slug = business.slug;
            slugCache.set(roomId, { slug, cachedAt: Date.now() });
          }
        }
        if (slug) {
          const slugRoomClients = ioInstance.sockets.adapter.rooms.get(slug);
          const slugClientCount = slugRoomClients?.size || 0;
          
          ioInstance.to(slug).emit(event, data);
          logger.debug(`Also emitting to business slug`, { slug, slugClientCount });
        }
      } catch (error) {
        logger.error('Error emitting to business slug', error);
      }
    }
    
    // Log successful emission
    logger.debug(`Successfully emitted ${event} to business`, { roomId });
    
  } catch (error) {
    logger.error('Error in emitToBusiness', error);
  }
}

// Para el superadmin, necesitamos emitir un evento global de actualización de negocios
function emitBusinessesUpdate() {
  if (ioInstance) {
    ioInstance.to('superadmin-channel').emit('businesses-updated');
    logger.debug('Emitido evento de actualización de negocios a superadmins');
  }
}

// Get connected clients info for debugging
function getConnectedClientsInfo() {
  const clientsInfo = Array.from(connectedClients.entries()).map(([socketId, info]) => ({
    socketId,
    businessId: info.businessId,
    connectedAt: info.connectedAt,
    joinedAt: info.joinedAt
  }));
  
  return {
    totalClients: connectedClients.size,
    clients: clientsInfo,
    rooms: ioInstance ? Array.from(ioInstance.sockets.adapter.rooms.keys()) : []
  };
}

// Test function to emit a test event
function testEmitToBusiness(businessId, testData = { message: 'Test event', timestamp: new Date().toISOString() }) {
  return emitToBusiness(businessId, 'test_event', testData);
}

/**
 * Emit an event to a specific order tracking room.
 * Customers join these rooms via the 'trackOrder' socket event.
 */
function emitToOrder(orderId, event, data) {
  if (!ioInstance || !orderId) return;
  const room = `order:${orderId.toString()}`;
  ioInstance.to(room).emit(event, data);
}

module.exports = {
  initSocket,
  emitToBusiness,
  emitToOrder,
  emitBusinessesUpdate,
  getConnectedClientsInfo,
  testEmitToBusiness
}; 