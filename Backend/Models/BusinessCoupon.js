/**
 * BusinessCoupon — Cupones de descuento para pedidos de clientes.
 * Cada negocio puede crear sus propios cupones con:
 * - Descuento por porcentaje
 * - Descuento por monto fijo
 * - Envío gratis
 */
const mongoose = require('mongoose');

const businessCouponSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  discountType: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed', 'free_delivery'],
    default: 'percentage',
  },
  discountValue: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  // Monto máximo de descuento (solo aplica para porcentaje)
  maxDiscountAmount: {
    type: Number,
    default: null,
  },
  // Monto mínimo de la orden para poder usar el cupón
  minimumOrderAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Límite total de usos del cupón (null = ilimitado)
  usageLimit: {
    type: Number,
    default: null,
  },
  // Límite de usos por cliente
  usageLimitPerCustomer: {
    type: Number,
    default: 1,
  },
  // Contador de usos totales
  usageCount: {
    type: Number,
    default: 0,
  },
  // Registro de usos por cliente { customerId: count }
  usageByCustomer: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  // Tipos de pedido aplicables
  applicableOrderTypes: {
    type: [String],
    enum: ['inSite', 'takeaway', 'delivery'],
    default: ['inSite', 'takeaway', 'delivery'],
  },
  validFrom: {
    type: Date,
    required: true,
  },
  validUntil: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Stats
  totalDiscountGiven: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Índice compuesto único: un código por negocio
businessCouponSchema.index({ businessId: 1, code: 1 }, { unique: true });
businessCouponSchema.index({ businessId: 1, isActive: 1, validUntil: 1 });

/**
 * Valida si un cupón puede ser usado para un pedido dado.
 */
businessCouponSchema.methods.validateForOrder = function(orderData, customerId) {
  const now = new Date();

  if (!this.isActive) {
    return { valid: false, message: 'Este cupón está inactivo' };
  }

  if (now < this.validFrom) {
    return { valid: false, message: 'Este cupón aún no está vigente' };
  }

  if (now > this.validUntil) {
    return { valid: false, message: 'Este cupón ha expirado' };
  }

  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) {
    return { valid: false, message: 'Este cupón ha alcanzado su límite de usos' };
  }

  // Verificar uso por cliente
  if (customerId && this.usageLimitPerCustomer !== null) {
    const customerUsage = this.usageByCustomer?.get(String(customerId)) || 0;
    if (customerUsage >= this.usageLimitPerCustomer) {
      return { valid: false, message: 'Ya has usado este cupón el máximo de veces permitido' };
    }
  }

  // Verificar monto mínimo de orden
  const orderTotal = orderData?.totalAmount || orderData?.subtotal || 0;
  if (this.minimumOrderAmount > 0 && orderTotal < this.minimumOrderAmount) {
    return {
      valid: false,
      message: `El monto mínimo para usar este cupón es $${this.minimumOrderAmount.toLocaleString('es-CO')}`
    };
  }

  // Verificar tipo de pedido
  const orderType = orderData?.orderType || orderData?.type;
  if (orderType && this.applicableOrderTypes.length > 0 && !this.applicableOrderTypes.includes(orderType)) {
    return { valid: false, message: 'Este cupón no aplica para este tipo de pedido' };
  }

  return { valid: true };
};

/**
 * Calcula el descuento para un monto dado.
 */
businessCouponSchema.methods.calculateDiscount = function(totalAmount) {
  if (this.discountType === 'percentage') {
    let discount = (totalAmount * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
    return Math.round(discount);
  }

  if (this.discountType === 'fixed') {
    return Math.min(this.discountValue, totalAmount);
  }

  // free_delivery — no descuenta del total de productos
  if (this.discountType === 'free_delivery') {
    return 0; // El delivery fee se quita aparte
  }

  return 0;
};

/**
 * Registra un uso del cupón.
 */
businessCouponSchema.methods.recordUsage = function(customerId, discountAmount) {
  this.usageCount += 1;
  this.totalDiscountGiven += discountAmount || 0;

  if (customerId) {
    const current = this.usageByCustomer?.get(String(customerId)) || 0;
    this.usageByCustomer.set(String(customerId), current + 1);
  }

  return this.save();
};

/**
 * Genera un código aleatorio único dentro de un negocio.
 */
businessCouponSchema.statics.generateCode = async function(businessId, length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
  let attempts = 0;

  while (attempts < 10) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const exists = await this.findOne({ businessId, code });
    if (!exists) return code;
    attempts++;
  }

  // Fallback con timestamp
  return 'C' + Date.now().toString(36).toUpperCase().slice(-7);
};

module.exports = mongoose.model('BusinessCoupon', businessCouponSchema);
