// Servicio para manejar sockets y rooms por negocio
let ioInstance = null;
const connectedClients = new Map(); // Track connected clients
const { verifyToken } = require('../config/jwt');
const logger = require('../utils/logger');

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
    socket.on('joinBusiness', async (businessId) => {
      if (businessId) {
        try {
          // Enforce tenant guard: requiere socket.user y coincidencia de tenant
          if (!socket.user) {
            logger.warn('joinBusiness rechazado - no autenticado', { socketId: socket.id, businessId });
            socket.emit('businessJoined', { businessId, success: false, error: 'unauthorized' });
            return;
          }

          const requestedBusiness = businessId.toString();
          const tenantBusiness = (socket.user.businessId || '').toString();

          if (!tenantBusiness || tenantBusiness !== requestedBusiness) {
            logger.warn('joinBusiness rechazado - tenant mismatch', { socketId: socket.id, tokenTenant: tenantBusiness, requested: requestedBusiness });
            socket.emit('businessJoined', { businessId, success: false, error: 'forbidden' });
            return;
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

    // Unirse a un canal específico para superadmin
    socket.on('joinSuperAdmin', () => {
      socket.join('superadmin-channel');
      logger.info('Socket se unió al canal de superadmin', { socketId: socket.id });
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

    socket.on('disconnect', () => {
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
    
    // If businessId looks like an ObjectId, also try to emit to slug
    if (roomId.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        const BusinessConfig = require('../Models/BusinessConfig');
        const business = await BusinessConfig.findById(roomId);
        if (business && business.slug) {
          const slugRoomClients = ioInstance.sockets.adapter.rooms.get(business.slug);
          const slugClientCount = slugRoomClients?.size || 0;
          
          ioInstance.to(business.slug).emit(event, data);
          logger.debug(`Also emitting to business slug`, { slug: business.slug, slugClientCount });
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

module.exports = {
  initSocket,
  emitToBusiness,
  emitBusinessesUpdate,
  getConnectedClientsInfo,
  testEmitToBusiness
}; 