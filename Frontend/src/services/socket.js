import { io } from 'socket.io-client';

/**
 * Configuración avanzada de Socket.io con reintentos y manejo de errores
 */

// Determinar si estamos en producción
const isProd = import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production';

// Configurar Socket.io para conectarse al backend con la URL correcta
// Usar variables de entorno para mayor flexibilidad
const getSocketUrl = () => {
  // Prioridad: Variable de entorno > Detección automática
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // Fallback a detección automática
  return isProd 
    ? 'https://157.245.125.216.nip.io' // Digital Ocean backend con SSL
    : 'http://localhost:5000';
};

const socketUrl = getSocketUrl();

console.log('🔧 Socket.IO configuración:', { isProd, socketUrl });

export const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10, // Más intentos
  reconnectionDelay: 2000, // Delay inicial más largo
  reconnectionDelayMax: 10000, // Máximo delay más largo
  randomizationFactor: 0.3,
  timeout: 30000, // Timeout más largo para conexiones lentas
  transports: ['polling', 'websocket'], // Usar polling primero (más confiable)
  path: '/socket.io',
  forceNew: false, // Reutilizar conexiones existentes
  upgrade: true, // Permitir upgrade a websocket después
  rememberUpgrade: true // Recordar si websocket funciona
});

// Configurar eventos para logging y manejo de errores
socket.on('connect', () => {
  console.log('✅ Socket conectado con ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Error al conectar socket:', error.message);
  console.error('❌ Detalles del error:', {
    type: error.type,
    description: error.description,
    context: error.context,
    transport: error.transport
  });
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket desconectado:', reason);
  
  // Si la desconexión fue por un error, intentamos reconectar manualmente
  if (reason === 'io server disconnect' || reason === 'transport close') {
    console.log('🔄 Intentando reconexión manual...');
    socket.connect();
  }
});

// Listen for business join confirmation
socket.on('businessJoined', (data) => {
  if (data.success) {
    console.log('✅ Confirmación: Unido al negocio', data.businessId);
  } else {
    console.error('❌ Error al unirse al negocio:', data.error);
  }
});

// Listen for test events
socket.on('test_event', (data) => {
  console.log('🧪 Evento de prueba recibido:', data);
});

// Ping/pong for connection testing
socket.on('pong', (data) => {
  console.log('🏓 Pong recibido:', data);
});

// Función para unirse a un canal de negocio específico
export const joinBusiness = (businessId) => {
  if (!businessId) {
    console.warn('⚠️ businessId no proporcionado para joinBusiness');
    return;
  }

  if (socket.connected) {
    console.log(`🏢 Uniéndose al negocio ${businessId}...`);
    socket.emit('joinBusiness', businessId);
  } else {
    // Intentar conectar primero y luego unirse
    console.log(`🔌 Conectando socket para unirse al negocio ${businessId}...`);
    
    // Timeout para evitar conexiones colgadas
    const connectTimeout = setTimeout(() => {
      console.warn(`⏰ Timeout al conectar socket para ${businessId}`);
      socket.disconnect();
    }, 15000);
    
    socket.connect();
    
    socket.once('connect', () => {
      clearTimeout(connectTimeout);
      socket.emit('joinBusiness', businessId);
      console.log(`🏢 Socket conectado y uniéndose al negocio ${businessId}...`);
    });
    
    socket.once('connect_error', () => {
      clearTimeout(connectTimeout);
      console.error(`❌ Error al conectar para negocio ${businessId}`);
    });
  }
};

// Test ping function
export const testPing = () => {
  if (socket.connected) {
    console.log('🏓 Enviando ping...');
    socket.emit('ping');
  } else {
    console.log('❌ Socket no conectado para ping');
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
export const leaveSuperAdmin = () => {
  if (socket.connected) {
    socket.emit('leaveSuperAdmin');
    console.log('Socket salió del canal de superadmin');
  }
};

// Función de diagnóstico para debugging
export const socketDiagnostic = () => {
  const diagnostic = {
    connected: socket.connected,
    id: socket.id,
    transport: socket.io?.engine?.transport?.name,
    url: socket.io?.uri,
    options: {
      autoConnect: socket.io?.opts?.autoConnect,
      reconnection: socket.io?.opts?.reconnection,
      reconnectionAttempts: socket.io?.opts?.reconnectionAttempts,
      timeout: socket.io?.opts?.timeout,
      transports: socket.io?.opts?.transports
    },
    environment: {
      isProd: isProd,
      userAgent: navigator.userAgent,
      online: navigator.onLine
    }
  };
  
  console.log('🔍 Diagnóstico de Socket:', diagnostic);
  return diagnostic;
};

// Función para forzar reconexión
export const forceReconnect = () => {
  console.log('🔄 Forzando reconexión de socket...');
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 1000);
};