/**
 * Re-exports from validators.js to avoid duplicate implementations.
 * Keep this file for backward-compatibility with existing imports.
 */
const { isValidObjectId, isValidBusinessIdentifier } = require('./validators');

module.exports = {
  isValidObjectId,
  isValidBusinessIdentifier
}; 