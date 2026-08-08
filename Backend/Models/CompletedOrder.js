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
    enum: ['whatsapp', 'inapp', 'pos', 'admin'],
    default: 'whatsapp'
  },
  /* De donde llego el cliente: el valor de ?source= del enlace con el que
     entro al menu. `orderChannel` dice COMO se tomo el pedido; esto dice de
     que campana o canal vino, que es lo que permite saber si el link de
     Instagram o el QR de la mesa estan sirviendo de algo. Texto libre porque
     cada negocio inventa sus campanas. */
  source: {
    type: String,
    trim: true,
    maxlength: 40,
    default: null,
    index: true
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'efectivo', 'nequi', 'daviplata', 'transfer', 'transferencia', 'other'],
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
  finalAmount: {
    type: Number,
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  /* La propina va incluida en finalAmount pero no se estaba copiando al
     completar el pedido, así que en el historial el desglose no cuadraba con
     el total y no había forma de saber cuánto se repartió al personal. */
  tipAmount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String,
    trim: true,
    default: null
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  deliveryZoneName: {
    type: String,
    trim: true,
    default: ''
  },
  posPaymentInfo: {
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
  },
  
  // Delivery person / domiciliario fields
  deliveryMode: {
    type: String,
    enum: ['qr', 'fixed', 'profile'],
    default: null
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPerson',
    default: null
  },
  confirmationAttempts: {
    type: Number,
    default: 0
  },
  deliveryAssignedAt: {
    type: Date,
    default: null
  },
  deliveryPickedAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  
  // Booking / appointment fields
  isBooking: {
    type: Boolean,
    default: false
  },
  bookingDate: {
    type: Date,
    default: null
  },
  bookingEndDate: {
    type: Date,
    default: null
  },
  bookingStatus: {
    type: String,
    default: null
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