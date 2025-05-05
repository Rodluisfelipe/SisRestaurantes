const mongoose = require('mongoose');

/**
 * Checks if a given string is a valid MongoDB ObjectId
 * @param {string} id - The string to check
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Checks if a given string is either a valid MongoDB ObjectId or a valid business slug
 * @param {string} identifier - The string to check
 * @returns {boolean} - True if valid ObjectId or business slug, false otherwise
 */
const isValidBusinessIdentifier = (identifier) => {
  if (!identifier) return false;
  
  // Check if it's a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return true;
  }
  
  // Check if it's a valid business slug (alphanumeric, dash, underscore)
  // This regex validates a string that contains only letters, numbers, dashes, and underscores
  const slugRegex = /^[a-zA-Z0-9-_]+$/;
  return typeof identifier === 'string' && slugRegex.test(identifier);
};

module.exports = {
  isValidObjectId,
  isValidBusinessIdentifier
}; 