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

// Para el superadmin, necesitamos emitir un evento global de actualización de negocios
function emitBusinessesUpdate() {
  if (ioInstance) {
    ioInstance.to('superadmin-channel').emit('businesses-updated');
    console.log('Emitido evento de actualización de negocios a superadmins');
  }
}

module.exports = {
  initSocket,
  emitToBusiness,
  emitBusinessesUpdate
}; 