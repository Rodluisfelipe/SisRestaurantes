import { io } from 'socket.io-client';

/**
 * Configuración avanzada de Socket.io con reintentos y manejo de errores
 */

// Determinar si estamos en producción
const isProd = import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production';

// Configurar Socket.io para conectarse al backend con la URL correcta
// Usamos la URL completa en producción, o la URL relativa en desarrollo
export const socket = io(isProd ? 'https://sisrestaurantes.onrender.com' : '/', {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  transports: ['websocket', 'polling'], // Intenta websocket primero, con fallback a polling
  path: '/socket.io'
});

// Configurar eventos para logging y manejo de errores
socket.on('connect', () => {
  console.log('Socket conectado con ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Error al conectar socket:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Socket desconectado:', reason);
  
  // Si la desconexión fue por un error, intentamos reconectar manualmente
  if (reason === 'io server disconnect' || reason === 'transport close') {
    console.log('Intentando reconexión manual...');
    socket.connect();
  }
});

// Función para unirse a un canal de negocio específico
export const joinBusiness = (businessId) => {
  if (businessId && socket.connected) {
    socket.emit('joinBusiness', businessId);
    console.log(`Socket se unió al negocio ${businessId}`);
  } else if (businessId) {
    // Intentar conectar primero y luego unirse
    socket.connect();
    socket.once('connect', () => {
      socket.emit('joinBusiness', businessId);
      console.log(`Socket conectado y unido al negocio ${businessId}`);
    });
  }
};

// Función para unirse al canal de superadmin
export const joinSuperAdmin = () => {
  if (socket.connected) {
    socket.emit('joinSuperAdmin');
    console.log('Socket se unió al canal de superadmin');
  } else {
    // Intentar conectar primero y luego unirse
    socket.connect();
    socket.once('connect', () => {
      socket.emit('joinSuperAdmin');
      console.log('Socket conectado y unido al canal de superadmin');
    });
  }
};

// Función para salir de un canal de negocio
export const leaveBusiness = (businessId) => {
  if (businessId && socket.connected) {
    socket.emit('leaveBusiness', businessId);
    console.log(`Socket salió del negocio ${businessId}`);
  }
};

// Función para salir del canal de superadmin
export const leaveSuperAdmin = () => {  if (socket.connected) {
    socket.emit('leaveSuperAdmin');
    console.log('Socket salió del canal de superadmin');
  }
};