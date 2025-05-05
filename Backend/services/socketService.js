// Servicio para manejar sockets y rooms por negocio
let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Unirse a un room por businessId
    socket.on('joinBusiness', (businessId) => {
      if (businessId) {
        socket.join(businessId);
        console.log(`Socket ${socket.id} se unió al negocio ${businessId}`);
      }
    });

    // Salir de un room
    socket.on('leaveBusiness', (businessId) => {
      if (businessId) {
        socket.leave(businessId);
        console.log(`Socket ${socket.id} salió del negocio ${businessId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
  });
}

async function emitToBusiness(businessId, event, data) {
  if (!ioInstance || !businessId) return;
  
  try {
    // Convert ObjectId to string if needed
    const roomId = businessId.toString();
    
    // For debugging
    console.log(`Emitting ${event} to business ${roomId}`);
    
    // Emit to both potential room formats - slug and ObjectId
    ioInstance.to(roomId).emit(event, data);
    
    // If businessId looks like an ObjectId, we also need to check if there's a business with that slug
    if (roomId.match(/^[0-9a-fA-F]{24}$/)) {
      try {
        const BusinessConfig = require('../Models/BusinessConfig');
        const business = await BusinessConfig.findById(roomId);
        if (business && business.slug) {
          ioInstance.to(business.slug).emit(event, data);
          console.log(`Also emitting to business slug ${business.slug}`);
        }
      } catch (error) {
        console.error('Error emitting to business slug:', error);
      }
    }
  } catch (error) {
    console.error('Error in emitToBusiness:', error);
  }
}

module.exports = {
  initSocket,
  emitToBusiness
}; 