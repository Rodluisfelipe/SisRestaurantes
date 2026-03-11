const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');
const { isValidObjectId } = require('./validators');

/**
 * Utilidad centralizada para resolución de businessId (ObjectId o slug)
 * DRY: unifica toda la lógica de resolución de negocio
 * Incluye cache en memoria con TTL de 5 minutos para evitar queries repetitivos
 */

// ── In-memory cache for resolved business IDs ──
const _resolveCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function _cacheGet(key) {
  const entry = _resolveCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { _resolveCache.delete(key); return undefined; }
  return entry.value;
}

function _cacheSet(key, value) {
  _resolveCache.set(key, { value, expires: Date.now() + CACHE_TTL });
  // Prevent unbounded growth
  if (_resolveCache.size > 500) {
    const oldest = _resolveCache.keys().next().value;
    _resolveCache.delete(oldest);
  }
}

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

  // Check cache first
  const cached = _cacheGet(identifier);
  if (cached) return cached;

  // Si es un ObjectId válido, verificar que existe
  if (isValidObjectId(identifier)) {
    const business = await BusinessConfig.findById(identifier).select('_id').lean();
    if (!business) {
      throw new Error(`Business not found with ID: ${identifier}`);
    }
    const result = identifier.toString();
    _cacheSet(identifier, result);
    return result;
  }

  // Si no es ObjectId, tratar como slug
  const business = await BusinessConfig.findOne({ slug: identifier }).select('_id').lean();
  if (!business) {
    throw new Error(`Business not found with slug: ${identifier}`);
  }

  const result = business._id.toString();
  _cacheSet(identifier, result);
  // Also cache by the resolved ObjectId
  _cacheSet(result, result);
  return result;
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


