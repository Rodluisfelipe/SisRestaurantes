const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');
const { isValidObjectId } = require('./validators');

/**
 * Utilidad centralizada para resolución de businessId (ObjectId o slug)
 * DRY: unifica toda la lógica de resolución de negocio
 */

/**
 * Resuelve un identificador de negocio (ObjectId o slug) a ObjectId
 * @param {string} identifier - El identificador del negocio (ObjectId o slug)
 * @returns {Promise<string>} - El ObjectId del negocio como string
 * @throws {Error} - Si el identificador no existe o es inválido
 */
async function resolveBusinessId(identifier) {
  if (!identifier) {
    throw new Error('Business identifier is required');
  }

  // Si es un ObjectId válido, verificar que existe
  if (isValidObjectId(identifier)) {
    const business = await BusinessConfig.findById(identifier);
    if (!business) {
      throw new Error(`Business not found with ID: ${identifier}`);
    }
    return identifier.toString();
  }

  // Si no es ObjectId, tratar como slug
  const business = await BusinessConfig.findOne({ slug: identifier });
  if (!business) {
    throw new Error(`Business not found with slug: ${identifier}`);
  }

  return business._id.toString();
}

/**
 * Resuelve businessId desde el request (query, body o params)
 * @param {Object} req - Express request object
 * @param {string} source - De dónde extraer ('query', 'body', 'params', o 'auto' para buscar en todos)
 * @returns {Promise<string>} - El ObjectId del negocio como string
 * @throws {Error} - Si el identificador no existe, es inválido o no se encuentra en req
 */
async function requireBusinessId(req, source = 'auto') {
  let identifier;

  if (source === 'auto') {
    identifier = req.query?.businessId || req.body?.businessId || req.params?.businessId;
  } else {
    identifier = req[source]?.businessId;
  }

  if (!identifier) {
    throw new Error(`Business ID is required in ${source === 'auto' ? 'query, body, or params' : source}`);
  }

  return await resolveBusinessId(identifier);
}

/**
 * Resuelve businessId y retorna el documento completo del negocio
 * @param {string} identifier - El identificador del negocio (ObjectId o slug)
 * @returns {Promise<Object>} - El documento del negocio
 * @throws {Error} - Si el identificador no existe o es inválido
 */
async function resolveBusiness(identifier) {
  if (!identifier) {
    throw new Error('Business identifier is required');
  }

  // Si es un ObjectId válido, buscar por ID
  if (isValidObjectId(identifier)) {
    const business = await BusinessConfig.findById(identifier);
    if (!business) {
      throw new Error(`Business not found with ID: ${identifier}`);
    }
    return business;
  }

  // Si no es ObjectId, tratar como slug
  const business = await BusinessConfig.findOne({ slug: identifier });
  if (!business) {
    throw new Error(`Business not found with slug: ${identifier}`);
  }

  return business;
}

module.exports = {
  resolveBusinessId,
  requireBusinessId,
  resolveBusiness
};


