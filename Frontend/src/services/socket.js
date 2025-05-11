import { io } from 'socket.io-client';

// Configurar Socket.io para conectarse al backend
export const socket = io('/', {
  autoConnect: false,
  transports: ['websocket'],
  path: '/socket.io'
});

// Función para unirse a un canal de negocio específico
export const joinBusiness = (businessId) => {
  if (businessId && socket) {
    socket.emit('joinBusiness', businessId);
    console.log(`Socket se unió al negocio ${businessId}`);
  }
};

// Función para unirse al canal de superadmin
export const joinSuperAdmin = () => {
  if (socket) {
    socket.emit('joinSuperAdmin');
    console.log('Socket se unió al canal de superadmin');
  }
};

// Función para salir de un canal de negocio
export const leaveBusiness = (businessId) => {
  if (businessId && socket) {
    socket.emit('leaveBusiness', businessId);
    console.log(`Socket salió del negocio ${businessId}`);
  }
};

// Función para salir del canal de superadmin
export const leaveSuperAdmin = () => {
  if (socket) {
    socket.emit('leaveSuperAdmin');
    console.log('Socket salió del canal de superadmin');
  }
};

export default socket; 