// Servicio para manejar sockets y rooms por negocio
let ioInstance = null;
const connectedClients = new Map(); // Track connected clients

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    connectedClients.set(socket.id, { socket, businessId: null, connectedAt: new Date() });

    // Unirse a un room por businessId
    socket.on('joinBusiness', async (businessId) => {
      if (businessId) {
        try {
          // Leave previous business room if any
          const clientInfo = connectedClients.get(socket.id);
          if (clientInfo && clientInfo.businessId) {
            socket.leave(clientInfo.businessId);
            console.log(`Socket ${socket.id} salió del negocio anterior ${clientInfo.businessId}`);
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
          
          console.log(`✅ Socket ${socket.id} se unió al negocio ${businessId}`);
          console.log(`📊 Clientes conectados al negocio ${businessId}:`, io.sockets.adapter.rooms.get(businessId.toString())?.size || 0);
          
          // Confirm join to client
          socket.emit('businessJoined', { businessId, success: true });
          
        } catch (error) {
          console.error('Error joining business room:', error);
          socket.emit('businessJoined', { businessId, success: false, error: error.message });
        }
      }
    });

    // Unirse a un canal específico para superadmin
    socket.on('joinSuperAdmin', () => {
      socket.join('superadmin-channel');
      console.log(`Socket ${socket.id} se unió al canal de superadmin`);
    });

    // Salir de un room
    socket.on('leaveBusiness', (businessId) => {
      if (businessId) {
        socket.leave(businessId);
        console.log(`Socket ${socket.id} salió del negocio ${businessId}`);
      }
    });

    // Salir del canal de superadmin
    socket.on('leaveSuperAdmin', () => {
      socket.leave('superadmin-channel');
      console.log(`Socket ${socket.id} salió del canal de superadmin`);
    });

    // Test connection endpoint
    socket.on('ping', () => {
      console.log(`Ping received from ${socket.id}`);
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      const clientInfo = connectedClients.get(socket.id);
      console.log('Cliente desconectado:', socket.id, clientInfo?.businessId ? `(negocio: ${clientInfo.businessId})` : '');
      connectedClients.delete(socket.id);
    });
  });
}

async function emitToBusiness(businessId, event, data) {
  if (!ioInstance || !businessId) {
    console.warn('⚠️ Cannot emit to business: ioInstance or businessId missing', { ioInstance: !!ioInstance, businessId });
    return;
  }
  
  try {
    // Convert ObjectId to string if needed
    const roomId = businessId.toString();
    
    // Check how many clients are in the room
    const roomClients = ioInstance.sockets.adapter.rooms.get(roomId);
    const clientCount = roomClients?.size || 0;
    
    console.log(`🚀 Emitting ${event} to business ${roomId} (${clientCount} clients connected)`);
    
    if (clientCount === 0) {
      console.warn(`⚠️ No clients connected to business ${roomId} - event may not be received`);
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
          console.log(`🚀 Also emitting to business slug ${business.slug} (${slugClientCount} clients)`);
        }
      } catch (error) {
        console.error('Error emitting to business slug:', error);
      }
    }
    
    // Log successful emission
    console.log(`✅ Successfully emitted ${event} to business ${roomId}`);
    
  } catch (error) {
    console.error('❌ Error in emitToBusiness:', error);
  }
}

// Para el superadmin, necesitamos emitir un evento global de actualización de negocios
function emitBusinessesUpdate() {
  if (ioInstance) {
    ioInstance.to('superadmin-channel').emit('businesses-updated');
    console.log('Emitido evento de actualización de negocios a superadmins');
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