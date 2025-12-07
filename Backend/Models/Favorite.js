const mongoose = require('mongoose');

/**
 * Model for customer favorite products Schema
 * Allows customers to save their preferred items for quick reordering
 */
const favoriteSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Product information snapshot (in case product gets deleted)
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productPrice: {
    type: Number,
    required: true
  },
  productImage: {
    type: String,
    default: ''
  },
  // Saved configuration for this favorite
  selectedToppings: [{
    groupId: mongoose.Schema.Types.ObjectId,
    groupName: String,
    toppings: [{
      id: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number
    }]
  }],
  selectedOptions: [{
    groupId: mongoose.Schema.Types.ObjectId,
    groupName: String,
    option: mongoose.Schema.Types.Mixed
  }],
  notes: {
    type: String,
    default: '',
    maxlength: 200
  },
  // Metadata
  timesOrdered: {
    type: Number,
    default: 0
  },
  lastOrderedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index to ensure uniqueness per customer per product configuration
favoriteSchema.index({ customerId: 1, businessId: 1, productId: 1 });

// Index for efficient queries
favoriteSchema.index({ phone: 1, businessId: 1 });

// Method to increment order count
favoriteSchema.methods.recordOrder = function() {
  this.timesOrdered += 1;
  this.lastOrderedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Favorite', favoriteSchema);
