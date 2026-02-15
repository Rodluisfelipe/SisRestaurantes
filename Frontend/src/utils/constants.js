/**
 * Constantes de la aplicación
 * Centraliza valores mágicos y configuraciones
 */

// Intervalos de tiempo (en milisegundos)
export const TIME_INTERVALS = {
  NOTIFICATION_SOUND: 5000, // 5 segundos
  ORDER_REMOVAL_DELAY: 5000, // 5 segundos
  CACHE_DURATION: 15 * 60 * 1000, // 15 minutos
  TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutos antes de expirar
  SOCKET_RECONNECT_DELAY: 1000, // 1 segundo
  SOCKET_RECONNECT_MAX_DELAY: 5000, // 5 segundos máximo
  API_TIMEOUT: 5000, // 5 segundos
};

// Límites de rate limiting
export const RATE_LIMITS = {
  LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW: 15 * 60 * 1000, // 15 minutos
};

// Configuración de validación
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  BUSINESS_NAME_MAX_LENGTH: 100,
  PRODUCT_NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
};

// Estados de pedidos
export const ORDER_STATUS = {
  PENDING: 'pending',
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_UPLOADED: 'payment_uploaded',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
};

// Tipos de pedidos
export const ORDER_TYPES = {
  IN_SITE: 'inSite',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
};

// Roles de usuario
export const USER_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
};

// Niveles de log
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Códigos de estado HTTP más usados
export const HTTP_STATUS = {
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
export const SOCKET_EVENTS = {
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

// Configuración de tema por defecto
export const DEFAULT_THEME = {
  BUTTON_COLOR: '#2563eb',
  BUTTON_TEXT_COLOR: '#ffffff',
};

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// Rutas reservadas que no pueden ser slugs de negocio
export const RESERVED_PATHS = [
  'login',
  'register', 
  'features',
  'contact',
  'pricing',
  'about',
  'terms',
  'admin',
  'superadmin',
  'api',
  'health',
  'events'
];

// Configuración de archivos
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
};

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Este campo es obligatorio',
  INVALID_EMAIL: 'Ingresa un email válido',
  PASSWORD_TOO_SHORT: `La contraseña debe tener al menos ${VALIDATION_RULES.PASSWORD_MIN_LENGTH} caracteres`,
  PASSWORDS_DONT_MATCH: 'Las contraseñas no coinciden',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  BUSINESS_NOT_FOUND: 'Negocio no encontrado',
  ORDER_NOT_FOUND: 'Pedido no encontrado',
  PRODUCT_NOT_FOUND: 'Producto no encontrado',
  UNAUTHORIZED_ACCESS: 'No tienes permisos para realizar esta acción',
  NETWORK_ERROR: 'Error de conexión. Verifica tu internet.',
  GENERIC_ERROR: 'Ha ocurrido un error inesperado',
};

export default {
  TIME_INTERVALS,
  RATE_LIMITS,
  VALIDATION_RULES,
  ORDER_STATUS,
  ORDER_TYPES,
  USER_ROLES,
  LOG_LEVELS,
  HTTP_STATUS,
  SOCKET_EVENTS,
  DEFAULT_THEME,
  PAGINATION,
  RESERVED_PATHS,
  FILE_LIMITS,
  ERROR_MESSAGES,
};
