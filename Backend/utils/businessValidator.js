const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');
const { isValidObjectId } = mongoose;
const logger = require('./logger');

/**
 * Utilidad centralizada para validación y resolución de businessId
 * Maneja tanto ObjectIds como slugs de manera consistente
 */

/**
 * Valida y resuelve un identificador de negocio (ObjectId o slug)
 * @param {string} identifier - El identificador del negocio (ObjectId o slug)
 * @returns {Promise<{success: boolean, businessId: string|null, business: Object|null, error: string|null}>}
 */
async function validateAndResolveBusinessId(identifier) {
  if (!identifier) {
    logger.debug('No identifier provided');
    return {
      success: false,
      businessId: null,
      business: null,
      error: 'Business identifier is required'
    };
  }

  try {
    // Si es un ObjectId válido, verificar que existe
    if (isValidObjectId(identifier)) {
      const business = await BusinessConfig.findById(identifier);
      if (!business) {
        logger.debug('Business not found with ID', { identifier });
        return {
          success: false,
          businessId: null,
          business: null,
          error: 'Business not found with provided ID'
        };
      }
      
      return {
        success: true,
        businessId: identifier,
        business: business,
        error: null
      };
    }

    // Si no es ObjectId, tratar como slug
    const business = await BusinessConfig.findOne({ slug: identifier });
    if (!business) {
      logger.debug('Business not found with slug', { identifier });
      return {
        success: false,
        businessId: null,
        business: null,
        error: `Business not found with slug: ${identifier}`
      };
    }

    return {
      success: true,
      businessId: business._id.toString(),
      business: business,
      error: null
    };

  } catch (error) {
    logger.error('Error validating business', error);
    return {
      success: false,
      businessId: null,
      business: null,
      error: `Error validating business: ${error.message}`
    };
  }
}

/**
 * Middleware para validar businessId en rutas
 * Agrega businessId resuelto a req.validatedBusinessId
 * @param {string} sourceParam - De donde tomar el businessId ('query', 'body', 'params')
 */
function createBusinessValidationMiddleware(sourceParam = 'query') {
  return async (req, res, next) => {
    try {
      let identifier;
      
      switch (sourceParam) {
        case 'query':
          identifier = req.query.businessId;
          break;
        case 'body':
          identifier = req.body.businessId;
          break;
        case 'params':
          identifier = req.params.businessId;
          break;
        default:
          identifier = req.query.businessId || req.body.businessId || req.params.businessId;
      }

      const result = await validateAndResolveBusinessId(identifier);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error,
          providedIdentifier: identifier
        });
      }

      // Agregar datos validados al request
      req.validatedBusinessId = result.businessId;
      req.businessData = result.business;
      req.originalBusinessIdentifier = identifier;

      next();
    } catch (error) {
      logger.error('Error in business validation middleware', error);
      res.status(500).json({ 
        message: 'Internal server error during business validation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

/**
 * Crea un filtro para consultas de MongoDB basado en businessId
 * @param {string} identifier - El identificador del negocio
 * @returns {Promise<Object>} - Filtro para MongoDB
 */
async function createBusinessFilter(identifier) {
  const result = await validateAndResolveBusinessId(identifier);
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return { businessId: result.businessId };
}

module.exports = {
  validateAndResolveBusinessId,
  createBusinessValidationMiddleware,
  createBusinessFilter
};
