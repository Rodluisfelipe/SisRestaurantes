const mongoose = require("mongoose");

/**
 * Model for completed orders in the restaurant system
 * 
 * This model stores orders that have been completed.
 * It has the same structure as the Order model but with additional
 * fields for reporting and analytics.
 */
const completedOrderSchema = new mongoose.Schema({
  // Business reference
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  
  // Order identification
  orderNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Customer information
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Order details
  orderType: {
    type: String,
    enum: ['inSite', 'takeaway', 'delivery'],
    required: true
  },
  status: {
    type: String,
    default: 'completed'
  },
  
  // In-app ordering fields (for analytics breakdowns)
  orderChannel: {
    type: String,
    enum: ['whatsapp', 'inapp'],
    default: 'whatsapp'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'nequi', 'daviplata', 'transfer', 'other'],
    default: null
  },
  
  // Table information (for in-site orders)
  tableNumber: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Delivery information
  address: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Order items
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    selectedToppings: [{
      groupName: String,
      optionName: String,
      price: Number,
      basePrice: Number,
      subGroups: [{
        subGroupTitle: String,
        optionName: String,
        price: Number
      }]
    }]
  }],
  
  // Order totals
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional fields for reporting
  reportDate: {
    type: Date,
    default: function() {
      // Start of day in Colombia timezone (UTC-5)
      const { startOfDayCOL } = require('../utils/timezone');
      return startOfDayCOL();
    }
  },
  
  // Flag to indicate if this order has been included in a report
  includedInReport: {
    type: Boolean,
    default: false
  }
});

// Indexes for faster queries
completedOrderSchema.index({ businessId: 1, completedAt: -1 });
completedOrderSchema.index({ businessId: 1, reportDate: 1 });
completedOrderSchema.index({ businessId: 1, includedInReport: 1 });

module.exports = mongoose.models.CompletedOrder || mongoose.model("CompletedOrder", completedOrderSchema); 