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
  customerEmail: {
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
    enum: ['whatsapp', 'inapp', 'pos', 'admin'],
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
  tipAmount: {
    type: Number,
    default: 0
  },
  // Cuenta abierta de mesa (POS): la orden acumula ítems y se cobra al final
  posOpenTab: {
    type: Boolean,
    default: false
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
  
  // Delivery person / domiciliario fields
  deliveryMode: {
    type: String,
    enum: ['qr', 'fixed', 'profile'],
    default: null
  },
  deliveryToken: {
    type: String,
    default: null,
    index: true
  },
  deliveryTokenExpiresAt: {
    type: Date,
    default: null
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPerson',
    default: null
  },
  // External delivery company handling this order (if dispatched to a partner)
  assignedPartnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    default: null,
    index: true
  },
  // Lifecycle of the partner offer: offered → accepted / rejected
  partnerStatus: {
    type: String,
    enum: ['none', 'offered', 'accepted', 'rejected'],
    default: 'none'
  },
  partnerOfferedAt: {
    type: Date,
    default: null
  },
  // When the current partner offer expires (sweeper re-offers to the next one)
  partnerOfferExpiresAt: {
    type: Date,
    default: null,
    index: true
  },
  // Partners that already rejected (or timed out on) this order — never re-offered
  rejectedPartnerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner'
  }],
  // How this order was assigned (audit): manual, auto_nearest, auto_scored, partner
  assignmentMethod: {
    type: String,
    enum: ['manual', 'auto_nearest', 'auto_scored', 'auto_offer', 'partner', null],
    default: null
  },
  confirmationCode: {
    type: String,
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
  // When the domi confirmed arrival at the restaurant (with the daily pickup code)
  deliveryArrivedStoreAt: {
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
  trackingEnabled: {
    type: Boolean,
    default: false
  },
  
  // Gift order fields — a customer buys and sends products as a gift to a third party.
  // customerName/phone = buyer (sender, who pays & coordinates). address/deliveryZone = recipient's delivery target.
  isGift: {
    type: Boolean,
    default: false
  },
  gift: {
    recipientName: { type: String, trim: true, default: '' },
    recipientPhone: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, maxlength: 300, default: '' },
    hidePrices: { type: Boolean, default: false }
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
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
    default: null
  },
  // Staff/professional assigned to this booking
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  staffName: {
    type: String,
    trim: true,
    default: null
  },
  // Recurring booking support
  recurrence: {
    type: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: null },
    parentBookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    endDate: { type: Date, default: null }
  },
  // Cancellation tracking
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null
  },
  // Reminder tracking (to avoid sending duplicate reminders)
  remindersSent: [{
    type: { type: String }, // '24h', '1h'
    sentAt: { type: Date, default: Date.now }
  }],

  // POS payment details (persisted for ticket reprinting)
  posPaymentInfo: {
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
  },

  // POS offline sync — idempotency key to prevent duplicate orders
  offlineId: {
    type: String,
    default: null,
    sparse: true
  },

  // Chat messages between customer and business
  messages: [{
    sender: { type: String, enum: ['customer', 'business'], required: true },
    text: { type: String, required: true, maxlength: 500 },
    timestamp: { type: Date, default: Date.now }
  }],

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
    }],
    isLoyaltyReward: { type: Boolean, default: false },
    loyaltyRewardName: { type: String }
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
orderSchema.index({ businessId: 1, bookingDate: 1 });
// Partial unique index: only enforced when offlineId is an actual string.
// `sparse` does NOT work here because offlineId is stored as explicit null on most orders.
orderSchema.index({ businessId: 1, offlineId: 1 }, { unique: true, partialFilterExpression: { offlineId: { $type: 'string' } } });

// Enable optimistic concurrency — prevents silent overwrites on concurrent updates
orderSchema.set('optimisticConcurrency', true);

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