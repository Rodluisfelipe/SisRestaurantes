const mongoose = require("mongoose");
const logger = require("../utils/logger");

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
    enum: ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'ready', 'inProgress', 'completed', 'cancelled', 'delivered'],
    default: 'pending'
  },
  
  // In-app ordering fields
  orderChannel: {
    type: String,
    enum: ['whatsapp', 'inapp'],
    default: 'whatsapp'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'efectivo', 'nequi', 'daviplata', 'transfer', 'transferencia', 'other'],
    default: null
  },
  paymentProof: {
    type: String,
    default: null
  },
  paymentProofUploadedAt: {
    type: Date,
    default: null
  },
  customerToken: {
    type: String,
    default: null,
    index: true
  },
  customerNotes: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],
  
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
  deliveryZoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryZone',
    default: null
  },
  deliveryZoneName: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  deliveryCoordinates: {
    lat: {
      type: Number,
      default: null
    },
    lon: {
      type: Number,
      default: null
    }
  },
  deliveryDistance: {
    type: Number,
    default: 0
  },
  estimatedDeliveryTime: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 0
    }
  },
  deliveryZoneInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  deliveryCalculated: {
    type: Boolean,
    default: false
  },
  deliveryNeedsConfirmation: {
    type: Boolean,
    default: false
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
orderSchema.index({ deliveryZoneId: 1 });
// customerToken already has index:true in field definition
orderSchema.index({ businessId: 1, orderChannel: 1, status: 1 });

// Hook para actualizar estadísticas de zona cuando se completa un pedido
orderSchema.post('save', async function(doc, next) {
  // Solo actualizar si el pedido tiene zona de entrega y está completado/entregado
  if (doc.deliveryZoneId && (doc.status === 'completed' || doc.status === 'delivered')) {
    try {
      const DeliveryZone = require('./DeliveryZone');
      const zone = await DeliveryZone.findById(doc.deliveryZoneId);
      
      if (zone) {
        // Verificar si este pedido ya fue contado (para evitar duplicados en actualizaciones)
        const wasAlreadyCounted = this._wasAlreadyCounted || false;
        
        if (!wasAlreadyCounted) {
          await zone.recordOrder(doc.totalAmount);
          // Marcar como contado para evitar duplicados
          this._wasAlreadyCounted = true;
        }
      }
    } catch (error) {
      logger.error('Error al actualizar estadísticas de zona en post-save hook', error);
      // No fallar la operación principal si hay error en estadísticas
    }
  }
});

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema); 