// Sistema de logging centralizado y limpio
// Solo muestra logs críticos del sistema

class SystemLogger {
  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.logs = [];
    this.maxLogs = 50; // Mantener solo los últimos 50 logs
  }

  // Solo mostrar logs del sistema
  system(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type,
      id: Date.now()
    };

    // Agregar al historial
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Solo mostrar en consola si es crítico y no duplicado
    if (type === 'error' || (type === 'info' && this.shouldLog(message))) {
      const prefix = `[SISTEMA ${timestamp}]`;
      
      if (type === 'error') {
        console.error(`${prefix} ERROR: ${message}`);
      } else if (type === 'warning') {
        console.warn(`${prefix} ADVERTENCIA: ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  // Verificar si debe loggear (evitar duplicados)
  shouldLog(message) {
    const recentLogs = this.logs.slice(-5); // Últimos 5 logs
    const isDuplicate = recentLogs.some(log => log.message === message && 
      (Date.now() - log.id) < 5000); // En los últimos 5 segundos
    return !isDuplicate;
  }

  // Obtener logs del sistema
  getLogs() {
    return this.logs;
  }

  // Limpiar logs
  clearLogs() {
    this.logs = [];
  }

  // Obtener estado del sistema
  getSystemStatus() {
    const errors = this.logs.filter(log => log.type === 'error');
    const warnings = this.logs.filter(log => log.type === 'warning');
    
    return {
      status: errors.length > 0 ? 'ERROR' : warnings.length > 0 ? 'WARNING' : 'OK',
      totalLogs: this.logs.length,
      errors: errors.length,
      warnings: warnings.length,
      lastLog: this.logs[this.logs.length - 1] || null
    };
  }
}

// Instancia global del logger
export const systemLogger = new SystemLogger();

// Función de conveniencia
export const logSystem = (message, type = 'info') => {
  systemLogger.system(message, type);
};

export default systemLogger;
