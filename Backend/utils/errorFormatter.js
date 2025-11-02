/**
 * Utilidad para formatear respuestas de error consistentes
 * Formato estándar: { message, code?, requestId, details? }
 */

/**
 * Formatea una respuesta de error según el estándar
 * @param {Object} options - Opciones para formatear el error
 * @param {string} options.message - Mensaje de error
 * @param {string} options.code - Código de error (opcional)
 * @param {string} options.requestId - ID de la solicitud
 * @param {any} options.details - Detalles adicionales (array de errores, objeto, etc.)
 * @returns {Object} - Respuesta de error formateada
 */
function formatError({ message, code = null, requestId, details = null }) {
  const error = {
    message,
    requestId
  };
  
  if (code) {
    error.code = code;
  }
  
  if (details !== null && details !== undefined) {
    error.details = details;
  }
  
  return error;
}

/**
 * Formatea un error HTTP desde Express req/res
 * @param {Object} req - Express request object
 * @param {string|Error} error - Mensaje de error o Error object
 * @param {number} statusCode - Código de estado HTTP
 * @param {any} details - Detalles adicionales
 * @returns {Object} - Respuesta de error formateada
 */
function formatHttpError(req, error, statusCode = 500, details = null) {
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';
  const message = error instanceof Error ? error.message : error;
  const code = error instanceof Error && error.code ? error.code : null;
  
  return formatError({
    message,
    code,
    requestId,
    details
  });
}

module.exports = {
  formatError,
  formatHttpError
};


