const mongoose = require("mongoose");

/**
 * Model for coupon system in the restaurant
 * 
 * Supports various discount types, conditions, and usage limits
 */
const couponSchema = new mongoose.Schema({
  // Business reference
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  
  // Basic coupon information
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Discount configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'free_delivery'],
    required: true
  },
  
  discountValue: {
    type: Number,
    required: function() {
      return this.discountType !== 'free_delivery';
    },
    min: 0
  },
  
  // Maximum discount amount (for percentage discounts)
  maxDiscountAmount: {
    type: Number,
    default: null
  },
  
  // Minimum order amount to apply coupon
  minimumOrderAmount: {
    type: Number,
    default: 0
  },
  
  // Product restrictions
  applicableProducts: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    default: []
  },
  
  applicableCategories: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    default: []
  },
  
  // Excluded products/categories
  excludedProducts: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    default: []
  },
  
  excludedCategories: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }],
    default: []
  },
  
  // Usage limits
  usageLimit: {
    type: Number,
    default: null // null = unlimited
  },
  
  usageLimitPerCustomer: {
    type: Number,
    default: 1
  },
  
  // Customer restrictions
  applicableCustomers: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    }],
    default: [] // empty = all customers
  },
  
  // Validity period
  validFrom: {
    type: Date,
    default: Date.now
  },
  
  validUntil: {
    type: Date,
    required: true
  },
  
  // Order type restrictions
  applicableOrderTypes: {
    type: [{
      type: String,
      enum: ['inSite', 'takeaway', 'delivery']
    }],
    default: ['inSite', 'takeaway', 'delivery']
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  
  totalDiscountGiven: {
    type: Number,
    default: 0
  },
  
  // Customer usage tracking
  customerUsage: [{
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer'
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
couponSchema.index({ businessId: 1, code: 1 }, { unique: true });
couponSchema.index({ businessId: 1, isActive: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ businessId: 1, 'customerUsage.customerId': 1 });

// Update the updatedAt field before saving
couponSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to validate coupon for a specific order
couponSchema.methods.validateForOrder = function(orderData, customerId = null) {
  const now = new Date();
  
  // Check if coupon is active
  if (!this.isActive) {
    return { valid: false, error: 'Cupón inactivo' };
  }
  
  // Check validity period
  if (now < this.validFrom || now > this.validUntil) {
    return { valid: false, error: 'Cupón fuera del período de validez' };
  }
  
  // Check usage limit
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return { valid: false, error: 'Cupón agotado' };
  }
  
  // Check minimum order amount
  if (orderData.totalAmount < this.minimumOrderAmount) {
    return { 
      valid: false, 
      error: `Monto mínimo requerido: $${this.minimumOrderAmount.toLocaleString()}` 
    };
  }
  
  // Check order type
  if (!this.applicableOrderTypes.includes(orderData.orderType)) {
    return { valid: false, error: 'Cupón no válido para este tipo de pedido' };
  }
  
  // Check customer restrictions
  if (this.applicableCustomers.length > 0 && customerId) {
    const customerObjectId = customerId.toString();
    const isCustomerAllowed = this.applicableCustomers.some(
      id => id.toString() === customerObjectId
    );
    if (!isCustomerAllowed) {
      return { valid: false, error: 'Cupón no válido para este cliente' };
    }
  }
  
  // Check customer usage limit
  if (customerId) {
    const customerUsage = this.customerUsage.find(
      usage => usage.customerId.toString() === customerId.toString()
    );
    if (customerUsage && customerUsage.usageCount >= this.usageLimitPerCustomer) {
      return { valid: false, error: 'Límite de uso por cliente alcanzado' };
    }
  }
  
  // Check product restrictions
  if (this.applicableProducts.length > 0) {
    const orderProductIds = orderData.items.map(item => item.productId.toString());
    const hasApplicableProduct = this.applicableProducts.some(
      productId => orderProductIds.includes(productId.toString())
    );
    if (!hasApplicableProduct) {
      return { valid: false, error: 'Cupón no válido para los productos seleccionados' };
    }
  }
  
  // Check excluded products
  if (this.excludedProducts.length > 0) {
    const orderProductIds = orderData.items.map(item => item.productId.toString());
    const hasExcludedProduct = this.excludedProducts.some(
      productId => orderProductIds.includes(productId.toString())
    );
    if (hasExcludedProduct) {
      return { valid: false, error: 'Cupón no válido para algunos productos seleccionados' };
    }
  }
  
  return { valid: true };
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(orderAmount) {
  if (this.discountType === 'free_delivery') {
    return 0; // Free delivery is handled separately
  }
  
  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = (orderAmount * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else if (this.discountType === 'fixed') {
    discount = this.discountValue;
    if (discount > orderAmount) {
      discount = orderAmount;
    }
  }
  
  return Math.round(discount);
};

// Method to record coupon usage
couponSchema.methods.recordUsage = function(customerId, discountAmount) {
  this.usageCount += 1;
  this.totalDiscountGiven += discountAmount;
  
  if (customerId) {
    let customerUsage = this.customerUsage.find(
      usage => usage.customerId.toString() === customerId.toString()
    );
    
    if (customerUsage) {
      customerUsage.usageCount += 1;
      customerUsage.lastUsed = new Date();
    } else {
      this.customerUsage.push({
        customerId: customerId,
        usageCount: 1,
        lastUsed: new Date()
      });
    }
  }
  
  return this.save();
};

// Static method to generate unique coupon code
couponSchema.statics.generateUniqueCode = async function(businessId, length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const existingCoupon = await this.findOne({ 
      businessId, 
      code: code 
    });
    
    if (!existingCoupon) {
      isUnique = true;
    }
  }
  
  return code;
};

module.exports = mongoose.model('Coupon', couponSchema);
