const mongoose = require('mongoose');

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The string to validate
 * @returns {boolean} - True if the id is a valid ObjectId, false otherwise
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates if a string could be a valid business identifier (ObjectId or slug)
 * @param {string} identifier - The string to validate
 * @returns {boolean} - True if the identifier could be valid
 */
const isValidBusinessIdentifier = (identifier) => {
  if (!identifier) return false;
  
  // Check if it's a valid ObjectId
  if (isValidObjectId(identifier)) return true;
  
  // Check if it's a valid slug (alphanumeric with dashes or underscores)
  return /^[a-zA-Z0-9-_]+$/.test(identifier);
};

module.exports = {
  isValidObjectId,
  isValidBusinessIdentifier
}; 