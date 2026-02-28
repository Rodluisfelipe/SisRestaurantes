const mongoose = require("mongoose");

/**
 * Modelo de Template de WhatsApp
 *
 * Permite a cada negocio personalizar el formato del mensaje de WhatsApp
 * que se envía cuando se confirma un pedido delivery.
 */

const whatsAppTemplateSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    unique: true
  },
  
  // Legacy template text (backward compat)
  messageTemplate: {
    type: String,
    default: ''
  },

  // Configuración de módulos del mensaje
  modules: {
    type: [{
      _id: false,
      id: { type: String, required: true },
      enabled: { type: Boolean, default: true },
      order: { type: Number, default: 0 }
    }],
    default: [
      { id: 'header', enabled: true, order: 0 },
      { id: 'orderType', enabled: true, order: 1 },
      { id: 'customerName', enabled: true, order: 2 },
      { id: 'address', enabled: true, order: 3 },
      { id: 'phone', enabled: true, order: 4 },
      { id: 'paymentMethod', enabled: true, order: 5 },
      { id: 'products', enabled: true, order: 6 },
      { id: 'totals', enabled: true, order: 7 },
      { id: 'customMessage', enabled: false, order: 8 },
    ]
  },

  // Texto del módulo de mensaje personalizado
  customMessage: {
    type: String,
    default: ''
  },

  // Legacy settings (backward compat)
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar updatedAt
whatsAppTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.WhatsAppTemplate || mongoose.model('WhatsAppTemplate', whatsAppTemplateSchema);
