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
   * Formatea el mensaje con timestamp y nivel
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (data) {
      return { prefix, message, data };
    }
    return { prefix, message };
  }

  /**
   * Log de errores - siempre se muestra
   */
  error(message, error = null) {
    if (this.currentLevel >= this.levels.ERROR) {
      const formatted = this.formatMessage('ERROR', message, error);
      console.error(formatted.prefix, formatted.message);
      
      if (error) {
        if (error instanceof Error) {
          console.error('Stack trace:', error.stack);
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
          });
        } else {
          console.error('Error data:', error);
        }
      }
    }
  }

  /**
   * Log de warnings
   */
  warn(message, data = null) {
    if (this.currentLevel >= this.levels.WARN) {
      const formatted = this.formatMessage('WARN', message, data);
      console.warn(formatted.prefix, formatted.message);
      if (data) console.warn('Data:', data);
    }
  }

  /**
   * Log de información
   */
  info(message, data = null) {
    if (this.currentLevel >= this.levels.INFO) {
      const formatted = this.formatMessage('INFO', message, data);
      console.log(formatted.prefix, formatted.message);
      if (data) console.log('Data:', data);
    }
  }

  /**
   * Log de debug - solo en desarrollo
   */
  debug(message, data = null) {
    if (this.currentLevel >= this.levels.DEBUG && isDevelopment) {
      const formatted = this.formatMessage('DEBUG', message, data);
      console.log(formatted.prefix, formatted.message);
      if (data) console.log('Debug data:', data);
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
