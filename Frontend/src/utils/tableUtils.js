import api from '../services/api';
import logger from './logger';

/**
 * Validates if a table exists for a given business
 * @param {string} businessId - The business ID or slug
 * @param {string} tableNumber - The table number to validate
 * @returns {Promise<{exists: boolean, table: object|null, error: string|null, debug: object}>} - Object with validation results
 */
export const validateTable = async (businessId, tableNumber) => {
  if (!businessId || !tableNumber) {
    logger.error('validateTable: Missing parameters', { businessId, tableNumber });
    return { 
      exists: false, 
      table: null, 
      error: 'Missing businessId or tableNumber',
      debug: { businessId, tableNumber }
    };
  }

  try {
    logger.info('Validating table', { businessId, tableNumber });
    
    // Asegurarse de que tableNumber sea un string
    const tableNumberStr = String(tableNumber);
    
    const url = `/tables/validate?businessId=${encodeURIComponent(businessId)}&tableNumber=${encodeURIComponent(tableNumberStr)}`;
    logger.info(`Making API request to: ${url}`);
    
    const response = await api.get(url);
    
    logger.info('Table validation result', response.data);
    return {
      exists: true,
      table: response.data.table,
      error: null,
      debug: { 
        request: { businessId, tableNumber: tableNumberStr },
        response: response.data 
      }
    };
  } catch (error) {
    const statusCode = error.response?.status;
    const responseData = error.response?.data;
    
    logger.error('Error validating table', { 
      businessId, 
      tableNumber, 
      error: error.message, 
      status: statusCode,
      response: responseData
    });
    
    if (statusCode === 404) {
      logger.warn('Table not found', { businessId, tableNumber });
      return {
        exists: false,
        table: null,
        error: 'La mesa no existe',
        debug: { 
          request: { businessId, tableNumber },
          response: responseData,
          status: statusCode
        }
      };
    }
    
    return {
      exists: false,
      table: null,
      error: responseData?.message || error.message || 'Error al validar la mesa',
      debug: { 
        request: { businessId, tableNumber },
        response: responseData,
        status: statusCode,
        error: error.message
      }
    };
  }
};

/**
 * Creates a redirect URL for invalid table cases
 * @param {string} businessId - The business ID or slug
 * @returns {string} - The URL to redirect to 
 */
export const getInvalidTableRedirectUrl = (businessId) => {
  return `/${businessId}`;
}; 