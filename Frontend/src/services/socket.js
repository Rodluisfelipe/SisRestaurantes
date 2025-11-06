import { io } from 'socket.io-client';
import { logSystem } from '../utils/systemLogger';

/**
 * Configuración de Socket.io con sistema de logging centralizado
 */

// Determinar si estamos en producción
const isProd = import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production';
const isLocalDev = !isProd && window.location.hostname === 'localhost';

// Configurar Socket.io para conectarse al backend con la URL correcta
const getSocketUrl = () => {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl) {
    return envSocketUrl;
  }
  
  if (isProd) {
    return 'https://157-245-125-216.nip.io';
  }
  
  // En desarrollo local, conectar al backend local
  return 'http://localhost:5000';
};

const socketUrl = getSocketUrl();

// Función para obtener el token JWT del localStorage
const getAuthToken = () => {
  // Intentar obtener el token desde accessToken o superadmin_token
  const token = localStorage.getItem('accessToken') || localStorage.getItem('superadmin_token');
  return token || null;
};

// Crear socket siempre (incluso en desarrollo local)
export const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.3,
  timeout: 20000,
  transports: ['polling'],
  path: '/socket.io',
  forceNew: false,
  upgrade: false,
  rememberUpgrade: false,
  // Agregar identificador único para esta sesión
  query: {
    sessionId: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    clientType: 'admin'
  },
  // Enviar token JWT en el handshake (se actualiza en cada reconexión)
  auth: {
    token: getAuthToken()
  }
});

// Sistema de logging centralizado
let systemStatus = {
  socket: 'connecting',
  lastError: null,
  lastUpdate: new Date()
};

// Función de logging centralizado
let lastLoggedStatus = null;
const logSystemStatus = () => {
  const status = (systemStatus.socket === 'connected' || systemStatus.socket === 'local_dev') && !systemStatus.lastError ? 'OK' : 'ERROR';
  const message = systemStatus.lastError || 'Sistema funcionando correctamente';
  
  // Solo loggear si el estado cambió
  if (lastLoggedStatus !== status) {
    logSystem(`${status}: ${message}`, status === 'ERROR' ? 'error' : 'info');
    lastLoggedStatus = status;
  }
};

// Configurar eventos para logging y manejo de errores
socket.on('connect', () => {
    systemStatus.socket = 'connected';
    systemStatus.lastError = null;
    systemStatus.lastUpdate = new Date();
    logSystemStatus();
  });

  socket.on('connect_error', (error) => {
    systemStatus.socket = 'error';
    systemStatus.lastError = `Error de conexión: ${error.message}`;
    systemStatus.lastUpdate = new Date();
    logSystemStatus();
  });

  socket.on('disconnect', (reason) => {
    systemStatus.socket = 'disconnected';
    
    // No loggear como error si es una desconexión intencional del cliente
    if (reason === 'io client disconnect') {
      // Desconexión normal, no loggear
      return;
    }
    
    systemStatus.lastError = `Desconectado: ${reason}`;
    systemStatus.lastUpdate = new Date();
    logSystemStatus();
    
    if (reason === 'io server disconnect' || reason === 'transport close') {
      socket.connect();
    }
  });

  socket.on('businessJoined', (data) => {
    if (data.success) {
      systemStatus.socket = 'connected';
      systemStatus.lastError = null;
      systemStatus.lastUpdate = new Date();
    } else {
      systemStatus.lastError = `Error al unirse al negocio: ${data.error}`;
      systemStatus.lastUpdate = new Date();
    }
    logSystemStatus();
  });

// Función para unirse a un canal de negocio específico
export const joinBusiness = (businessId) => {
  if (!businessId) {
    systemStatus.lastError = 'businessId no proporcionado';
    systemStatus.lastUpdate = new Date();
    logSystemStatus();
    return;
  }

  if (socket.connected) {
    socket.emit('joinBusiness', businessId);
  } else {
    socket.connect();
    socket.once('connect', () => {
      socket.emit('joinBusiness', businessId);
    });
  }
};

// Función para unirse al canal de superadmin
export const joinSuperAdmin = () => {
  if (socket.connected) {
    socket.emit('joinSuperAdmin');
  } else {
    socket.connect();
    socket.once('connect', () => {
      socket.emit('joinSuperAdmin');
    });
  }
};

// Función para forzar reconexión
export const forceReconnect = () => {
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 1000);
};

// Función para obtener el estado del sistema
export const getSystemStatus = () => {
  return {
    ...systemStatus,
    connected: socket.connected,
    id: socket.id
  };
};

// Función de diagnóstico
export const socketDiagnostic = () => {
  const status = getSystemStatus();
  logSystemStatus();
  return status;
};