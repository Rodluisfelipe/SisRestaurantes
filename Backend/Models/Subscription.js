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
  periodStart: {
    type: Date,
    default: null // Fecha de inicio del período actual
  },
  periodEnd: {
    type: Date,
    default: null // Fecha de vencimiento
  },
  graceUntil: {
    type: Date,
    default: null // periodEnd + GRACE_DAYS (5 días por defecto)
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
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
    enum: ['CARD', 'PSE', 'NEQUI', 'CASH', 'OTHER', 'COUPON'],
    default: null
  },
  // Campo para cupones redimidos
  couponCode: {
    type: String,
    default: null,
    index: true
  },
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },
  // Indica si esta suscripción fue creada con período de gracia inicial (registro)
  isTrialPeriod: {
    type: Boolean,
    default: false
  },
  lastPaymentAt: {
    type: Date,
    default: null
  },
  lastMonthsPurchased: {
    type: Number,
    default: null
  },
  // Referral discount applied to this subscription payment
  referralDiscountApplied: {
    type: Number,
    default: 0
  },
  // Source of the discount: 'referral_credit' (referrer using credits) or 'referred_discount' (new business discount)
  referralDiscountSource: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Virtual para mantener compatibilidad
subscriptionSchema.virtual('gracePeriodEnd').get(function() {
  return this.graceUntil;
});

// Índices para optimizar consultas
subscriptionSchema.index({ businessId: 1 }, { unique: true });
subscriptionSchema.index({ endDate: 1, status: 1 });

  // Constante de gracia (1 día después de vencimiento)
  const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || 1);

// Método para calcular graceUntil basado en periodEnd
subscriptionSchema.methods.calculateGraceUntil = function() {
  if (!this.periodEnd) return null;
  const graceDate = new Date(this.periodEnd);
  graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
  return graceDate;
};

// Método para verificar estado actual
subscriptionSchema.methods.getCurrentStatus = function() {
  const now = new Date();
  const periodEndDate = this.periodEnd || this.endDate;
  // SIEMPRE usar cálculo dinámico para gracia (no el valor almacenado en DB)
  const graceUntilDate = this.calculateGraceUntil() || this.graceUntil;
  
    // Si no hay periodEnd, considerar como activo (sin restricciones)
    if (!periodEndDate) {
      return 'active';
    }
    
    // Si aún no ha pasado el periodo de pago, está activo
  if (now <= periodEndDate) {
    return 'active';
    }
    
    // Si pasó el periodo de pago pero aún está en gracia
    if (graceUntilDate && now <= graceUntilDate) {
    return 'grace';
    }
    
    // Si pasó el periodo de gracia, está suspendido
    return 'suspended';
};

// Método para verificar si la suscripción está activa
subscriptionSchema.methods.isSubscriptionActive = function() {
  return this.getCurrentStatus() === 'active';
};

// Método para verificar si está en período de gracia
subscriptionSchema.methods.isInGracePeriod = function() {
  return this.getCurrentStatus() === 'grace';
};

// Método para verificar si está suspendida
subscriptionSchema.methods.isSuspended = function() {
  return this.getCurrentStatus() === 'suspended';
};

// Método para calcular días restantes
subscriptionSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const periodEndDate = this.periodEnd || this.endDate;
  const diffTime = periodEndDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Método para calcular días de gracia restantes
// SIEMPRE usar calculateGraceUntil() para garantizar GRACE_DAYS correcto
subscriptionSchema.methods.getGraceDaysRemaining = function() {
  const now = new Date();
  const graceUntilDate = this.calculateGraceUntil() || this.graceUntil;
  if (!graceUntilDate) return 0;
    
    // Normalizar las fechas para comparar solo días (sin horas)
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const graceNormalized = new Date(graceUntilDate.getFullYear(), graceUntilDate.getMonth(), graceUntilDate.getDate());
    
    const diffTime = graceNormalized - nowNormalized;
    const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysDiff);
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
