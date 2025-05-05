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

function emitToBusiness(businessId, event, data) {
  if (ioInstance && businessId) {
    ioInstance.to(businessId).emit(event, data);
  }
}

module.exports = {
  initSocket,
  emitToBusiness
}; 