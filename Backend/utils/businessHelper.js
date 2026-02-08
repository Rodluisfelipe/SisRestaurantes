/**
 * Re-exports from businessResolver and businessValidator to avoid duplicate implementations.
 * Keep this file for backward-compatibility with existing imports.
 */
const { resolveBusiness } = require('./businessResolver');
const { createBusinessFilter } = require('./businessValidator');

/**
 * Compat wrapper: returns null instead of throwing (like original findBusinessByIdentifier)
 */
async function findBusinessByIdentifier(identifier) {
  try {
    return await resolveBusiness(identifier);
  } catch {
    return null;
  }
}

module.exports = {
  findBusinessByIdentifier,
  createBusinessFilter
}; 