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
  
  // Template personalizado del mensaje
  messageTemplate: {
    type: String,
    required: true,
    default: `*** DATOS DEL CLIENTE ***
{{customerInfo}}
------------------------

*** DETALLE DEL PEDIDO ***
{{orderDetails}}

*** RESUMEN ***
{{orderSummary}}
------------------------

¡Gracias por tu pedido en {{businessName}}!
Tu orden será procesada inmediatamente.

{{timestamp}}`
  },
  
  // Configuraciones adicionales
  settings: {
    includeTimestamp: {
      type: Boolean,
      default: true
    },
    timestampFormat: {
      type: String,
      enum: ['datetime', 'date', 'time'],
      default: 'datetime'
    },
    includeBusinessInfo: {
      type: Boolean,
      default: true
    },
    customFooter: {
      type: String,
      default: ''
    }
  },
  
  // Variables disponibles y sus configuraciones
  availableVariables: {
    type: Map,
    of: {
      enabled: { type: Boolean, default: true },
      customLabel: { type: String, default: '' }
    },
    default: new Map([
      ['customerInfo', { enabled: true, customLabel: '' }],
      ['orderDetails', { enabled: true, customLabel: '' }],
      ['orderSummary', { enabled: true, customLabel: '' }],
      ['businessName', { enabled: true, customLabel: '' }],
      ['timestamp', { enabled: true, customLabel: '' }]
    ])
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
