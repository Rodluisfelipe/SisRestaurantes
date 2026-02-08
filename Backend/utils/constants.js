/**
 * Constantes del backend
 * Centraliza valores mágicos y configuraciones
 */

// Intervalos de tiempo (en milisegundos)
const TIME_INTERVALS = {
  ORDER_REMOVAL_DELAY: 5000, // 5 segundos
  JWT_EXPIRES_IN: '24h',
  RESET_TOKEN_EXPIRES: 3600000, // 1 hora en milisegundos
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutos
};

// Límites de rate limiting
const RATE_LIMITS = {
  LOGIN_ATTEMPTS: 5,
  GENERAL_REQUESTS: 100, // por ventana de tiempo
};

// Estados de pedidos
const ORDER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
};

// Tipos de pedidos
const ORDER_TYPES = {
  IN_SITE: 'inSite',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
};

// Roles de usuario
const USER_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
};

// Códigos de estado HTTP
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// Eventos de Socket.IO
const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_BUSINESS: 'joinBusiness',
  LEAVE_BUSINESS: 'leaveBusiness',
  JOIN_SUPER_ADMIN: 'joinSuperAdmin',
  LEAVE_SUPER_ADMIN: 'leaveSuperAdmin',
  ORDER_CREATED: 'order_created',
  ORDER_UPDATED: 'order_updated',
  ORDER_DELETED: 'order_deleted',
  PRODUCTS_UPDATE: 'products_update',
  BUSINESSES_UPDATED: 'businesses-updated',
};

// Configuración por defecto
const DEFAULTS = {
  BUSINESS_NAME: 'Mi Restaurante',
  ADMIN_PASSWORD: null, // Must be generated randomly at runtime - use crypto.randomBytes
  THEME: {
    BUTTON_COLOR: '#2563eb',
    BUTTON_TEXT_COLOR: '#ffffff',
  },
};

// Mensajes de error comunes
const ERROR_MESSAGES = {
  REQUIRED_FIELDS: 'Missing required fields',
  INVALID_CREDENTIALS: 'Invalid credentials',
  BUSINESS_NOT_FOUND: 'Business not found',
  ORDER_NOT_FOUND: 'Order not found',
  PRODUCT_NOT_FOUND: 'Product not found',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  INVALID_TOKEN: 'Invalid or expired token',
  EMAIL_REQUIRED: 'Email is required',
  PASSWORD_REQUIRED: 'Password is required',
  INTERNAL_ERROR: 'Internal server error',
};

// Configuración de validación
const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  BUSINESS_NAME_MAX_LENGTH: 100,
  PRODUCT_NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
};

module.exports = {
  TIME_INTERVALS,
  RATE_LIMITS,
  ORDER_STATUS,
  ORDER_TYPES,
  USER_ROLES,
  HTTP_STATUS,
  SOCKET_EVENTS,
  DEFAULTS,
  ERROR_MESSAGES,
  VALIDATION_RULES,
};
