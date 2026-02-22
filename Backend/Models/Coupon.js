const mongoose = require('mongoose');

/**
 * Modelo para cupones de suscripción
 * Permite crear cupones de N meses gratis que pueden ser compartidos y redimidos
 */
const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  months: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
    default: 1
  },
  description: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  usedBy: [{
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessConfig'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxUses: {
    type: Number,
    default: null // null = ilimitado
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null = no expira
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
// code already has unique:true + index:true in field definition
couponSchema.index({ isActive: 1, expiresAt: 1 });
couponSchema.index({ createdAt: -1 });

// Método para verificar si el cupón puede ser usado
couponSchema.methods.canBeUsed = function(businessId) {
  if (!this.isActive) return { valid: false, reason: 'Cupón inactivo' };
  
  if (this.expiresAt && this.expiresAt < new Date()) {
    return { valid: false, reason: 'Cupón expirado' };
  }
  
  if (this.maxUses !== null && this.usedBy.length >= this.maxUses) {
    return { valid: false, reason: 'Cupón alcanzó el límite de usos' };
  }
  
  // Verificar si este negocio ya usó el cupón
  const alreadyUsed = this.usedBy.some(usage => 
    usage.businessId.toString() === businessId.toString()
  );
  
  if (alreadyUsed) {
    return { valid: false, reason: 'Este cupón ya fue usado por este negocio' };
  }
  
  return { valid: true };
};

// Alias methods used in orders.js
couponSchema.methods.validateForOrder = function(businessId) {
  return this.canBeUsed(businessId);
};

couponSchema.methods.calculateDiscount = function(totalAmount) {
  // Coupon gives N months free - it's a subscription coupon, not an order discount
  // Return 0 discount for order total (coupon affects subscription, not order price)
  return 0;
};

// Método estático para generar código único
couponSchema.statics.generateCode = async function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let code;
  let exists = true;
  
  while (exists) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await this.findOne({ code });
    exists = !!existing;
  }
  
  return code;
};

module.exports = mongoose.model('Coupon', couponSchema);
