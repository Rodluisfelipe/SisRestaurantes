/**
 * Logger centralizado para la aplicación
 * Proporciona logging consistente con diferentes niveles
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    // En producción solo mostrar errores y warnings
    this.currentLevel = isProduction ? this.levels.WARN : this.levels.DEBUG;
  }

  /**
   * Redacta PII de un objeto recursivamente
   * @param {any} obj - El objeto a redactar
   * @returns {any} - El objeto con PII redactada
   */
  redactPII(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const piiFields = ['password', 'phone', 'token', 'address', 'email', 'authorization'];
    const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
    
    for (const key in redacted) {
      const lowerKey = key.toLowerCase();
      // Buscar campos sensibles (exacto o como subcadena)
      if (piiFields.some(field => lowerKey.includes(field))) {
        redacted[key] = 'REDACTED';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        // Recursión para objetos anidados
        redacted[key] = this.redactPII(redacted[key]);
      }
    }
    
    return redacted;
  }

  /**
   * Formatea el mensaje con timestamp, nivel y contexto
   * @param {string} level - Nivel del log
   * @param {string} message - Mensaje del log
   * @param {object} data - Datos adicionales
   * @param {object} context - Contexto (requestId, route, tenantId)
   */
  formatMessage(level, message, data = null, context = null) {
    const timestamp = new Date().toISOString();
    const contextParts = [];
    
    if (context) {
      if (context.requestId) contextParts.push(`reqId:${context.requestId}`);
      if (context.route) contextParts.push(`route:${context.route}`);
      if (context.tenantId) contextParts.push(`tenant:${context.tenantId}`);
    }
    
    const contextStr = contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : '';
    const prefix = `[${timestamp}] [${level}]${contextStr}`;
    
    // Redactar PII de data (siempre, no solo en producción)
    if (data && typeof data === 'object') {
      const redactedData = this.redactPII(data);
      return { prefix, message, data: redactedData };
    }
    
      return { prefix, message, data };
    }

  /**
   * Helper para obtener contexto de req si está disponible
   */
  getContext(req = null) {
    if (!req) return null;
    return {
      requestId: req.id || req.headers['x-request-id'] || null,
      route: req.route?.path || req.path || req.originalUrl || null,
      tenantId: req.user?.businessId?.toString() || req.query?.businessId || req.body?.businessId || null
    };
  }

  /**
   * Log de errores - siempre se muestra
   */
  error(message, error = null, req = null) {
    if (this.currentLevel >= this.levels.ERROR) {
      const context = this.getContext(req);
      const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
        stack: isDevelopment ? error.stack : undefined,
            code: error.code
      } : error;
      
      const formatted = this.formatMessage('ERROR', message, errorData, context);
      console.error(formatted.prefix, formatted.message);
      
      if (formatted.data) {
        console.error('Details:', formatted.data);
      }
    }
  }

  /**
   * Log de warnings
   */
  warn(message, data = null, req = null) {
    if (this.currentLevel >= this.levels.WARN) {
      const context = this.getContext(req);
      const formatted = this.formatMessage('WARN', message, data, context);
      console.warn(formatted.prefix, formatted.message);
      if (formatted.data) console.warn('Data:', formatted.data);
    }
  }

  /**
   * Log de información
   */
  info(message, data = null, req = null) {
    if (this.currentLevel >= this.levels.INFO) {
      const context = this.getContext(req);
      const formatted = this.formatMessage('INFO', message, data, context);
      console.log(formatted.prefix, formatted.message);
      if (formatted.data) console.log('Data:', formatted.data);
    }
  }

  /**
   * Log de debug - solo en desarrollo
   */
  debug(message, data = null, req = null) {
    if (this.currentLevel >= this.levels.DEBUG && isDevelopment) {
      const context = this.getContext(req);
      const formatted = this.formatMessage('DEBUG', message, data, context);
      console.log(formatted.prefix, formatted.message);
      if (formatted.data) console.log('Debug data:', formatted.data);
    }
  }

  /**
   * Log de requests HTTP
   */
  request(method, url, statusCode, duration = null) {
    const message = `${method} ${url} - ${statusCode}`;
    const data = duration ? { duration: `${duration}ms` } : null;
    
    if (statusCode >= 400) {
      this.error(message, data);
    } else if (statusCode >= 300) {
      this.warn(message, data);
    } else {
      this.info(message, data);
    }
  }

  /**
   * Log de operaciones de base de datos
   */
  database(operation, collection, details = null) {
    this.debug(`DB ${operation} on ${collection}`, details);
  }

  /**
   * Log de eventos de socket
   */
  socket(event, data = null) {
    this.debug(`Socket event: ${event}`, data);
  }
}

// Crear instancia singleton
const logger = new Logger();

module.exports = logger;
