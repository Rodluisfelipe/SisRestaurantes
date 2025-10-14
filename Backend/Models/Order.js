const mongoose = require("mongoose");

/**
 * Model for orders in the restaurant system
 * 
 * Handles different types of orders: in-site (table), takeaway, and delivery
 * Tracks order status through the fulfillment process
 */
const orderSchema = new mongoose.Schema({
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
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  
  // Order details
  orderType: {
    type: String,
    enum: ['inSite', 'takeaway', 'delivery'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'inProgress', 'completed', 'cancelled', 'delivered'],
    default: 'pending'
  },
  
  // Coupon information
  couponCode: {
    type: String,
    trim: true,
    default: null
  },
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  
  // Flag to indicate if the order has been sent to kitchen
  sentToKitchen: {
    type: Boolean,
    default: false
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
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
orderSchema.index({ businessId: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, status: 1 });
orderSchema.index({ businessId: 1, tableNumber: 1 });
orderSchema.index({ businessId: 1, sentToKitchen: 1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema); 