const mongoose = require("mongoose");

/**
 * Model for customer data in the restaurant system
 * 
 * Tracks customer information, order history, and statistics
 * for loyalty programs and customer relationship management
 */
const customerSchema = new mongoose.Schema({
  // Business reference
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  
  // Customer identification
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Customer information
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  
  // Customer statistics
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    lastOrderDate: {
      type: Date,
      default: null
    },
    firstOrderDate: {
      type: Date,
      default: null
    }
  },
  
  // Customer preferences
  preferences: {
    favoriteProducts: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      productName: String,
      orderCount: {
        type: Number,
        default: 1
      }
    }],
    notes: {
      type: String,
      default: ''
    }
  },
  
  // Customer status
  status: {
    type: String,
    enum: ['active', 'inactive', 'vip'],
    default: 'active'
  },
  
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
customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });
customerSchema.index({ businessId: 1, 'stats.totalOrders': -1 });
customerSchema.index({ businessId: 1, 'stats.totalSpent': -1 });
customerSchema.index({ businessId: 1, 'stats.lastOrderDate': -1 });

// Update the updatedAt field before saving
customerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to update customer stats when a new order is placed
customerSchema.methods.updateStats = function(orderAmount) {
  this.stats.totalOrders += 1;
  this.stats.totalSpent += orderAmount;
  this.stats.averageOrderValue = this.stats.totalSpent / this.stats.totalOrders;
  this.stats.lastOrderDate = new Date();
  
  if (!this.stats.firstOrderDate) {
    this.stats.firstOrderDate = new Date();
  }
  
  // Auto-promote to VIP if conditions are met
  if (this.stats.totalOrders >= 10 || this.stats.totalSpent >= 500000) {
    this.status = 'vip';
  }
  
  return this.save();
};

// Method to add favorite product
customerSchema.methods.addFavoriteProduct = function(productId, productName) {
  const existingProduct = this.preferences.favoriteProducts.find(
    p => p.productId.toString() === productId.toString()
  );
  
  if (existingProduct) {
    existingProduct.orderCount += 1;
  } else {
    this.preferences.favoriteProducts.push({
      productId,
      productName,
      orderCount: 1
    });
  }
  
  return this.save();
};

module.exports = mongoose.model('Customer', customerSchema);
