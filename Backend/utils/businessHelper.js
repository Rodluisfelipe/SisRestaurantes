const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');

/**
 * Utility function to find a business by ID or slug
 * @param {string} identifier - Can be either a MongoDB ObjectId or a slug
 * @returns {Promise<Object>} - The business document or null if not found
 */
async function findBusinessByIdentifier(identifier) {
  if (!identifier) return null;
  
  try {
    // First try to find by ObjectId (if valid)
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      const business = await BusinessConfig.findById(identifier);
      if (business) return business;
    }
    
    // If not found or not a valid ObjectId, try to find by slug
    return await BusinessConfig.findOne({ slug: identifier });
  } catch (error) {
    console.error('Error finding business by identifier:', error);
    return null;
  }
}

/**
 * Utility function to create a filter object for queries based on businessId or slug
 * @param {string} identifier - Can be either a MongoDB ObjectId or a slug
 * @returns {Promise<Object>} - A filter object for mongoose queries
 */
async function createBusinessFilter(identifier) {
  if (!identifier) return {};
  
  const business = await findBusinessByIdentifier(identifier);
  if (!business) return { businessId: null }; // Will return no results
  
  return { businessId: business._id };
}

module.exports = {
  findBusinessByIdentifier,
  createBusinessFilter
}; 