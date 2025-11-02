const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Opcional: para asociar a un usuario específico
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  },
  userAgent: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice compuesto para búsqueda eficiente por negocio
pushSubscriptionSchema.index({ businessId: 1, isActive: 1 });

// Índice para limpieza de suscripciones expiradas
pushSubscriptionSchema.index({ endpoint: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);

