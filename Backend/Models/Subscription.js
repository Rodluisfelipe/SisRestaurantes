const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  planType: {
    type: String,
    enum: ['monthly', 'annual'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'failed'],
    default: 'pending'
  },
  gracePeriodEnd: {
    type: Date,
    default: null // 1 día después de la expiración
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  },
  // Campos de integración Wompi
  wompiTransactionId: {
    type: String,
    default: null
  },
  wompiReference: {
    type: String,
    default: null
  },
  lastPaymentAttempt: {
    type: Date,
    default: null
  },
  checkoutLink: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['CARD', 'PSE', 'NEQUI', 'CASH', 'OTHER'],
    default: null
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
subscriptionSchema.index({ businessId: 1, status: 1 });
subscriptionSchema.index({ endDate: 1, status: 1 });
subscriptionSchema.index({ wompiTransactionId: 1 }, { unique: true, sparse: true });
subscriptionSchema.index({ wompiReference: 1 }); // Índice para búsquedas rápidas por reference

// Método para verificar si la suscripción está activa
subscriptionSchema.methods.isSubscriptionActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.endDate > now && 
         this.paymentStatus === 'paid';
};

// Método para verificar si está en período de gracia
subscriptionSchema.methods.isInGracePeriod = function() {
  const now = new Date();
  return this.status === 'expired' && 
         this.gracePeriodEnd && 
         this.gracePeriodEnd > now;
};

// Método para calcular días restantes
subscriptionSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const diffTime = this.endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
