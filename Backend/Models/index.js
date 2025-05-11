const mongoose = require("mongoose");

// Definir el esquema BusinessConfig solo si no existe
const BusinessConfig = mongoose.models.BusinessConfig || mongoose.model("BusinessConfig", new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    default: "Mi Restaurante"
  },
  logo: {
    type: String,
    required: false,
    default: ""
  }
}, {
  statics: {
    async getConfig() {
      let config = await this.findOne();
      if (!config) {
        config = await this.create({
          businessName: "Mi Restaurante",
          logo: ""
        });
      }
      return config;
    }
  }
}));

// Importar el modelo SuperAdmin
const SuperAdmin = require('./SuperAdmin');

module.exports = {
  BusinessConfig,
  SuperAdmin
}; 