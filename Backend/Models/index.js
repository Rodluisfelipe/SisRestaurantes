const mongoose = require("mongoose");

// Import the real BusinessConfig model instead of defining a duplicate minimal schema
const BusinessConfig = require('./BusinessConfig');

// Importar el modelo SuperAdmin
const SuperAdmin = require('./SuperAdmin');
const DeliveryZone = require('./DeliveryZone');

module.exports = {
  BusinessConfig,
  SuperAdmin,
  DeliveryZone
}; 