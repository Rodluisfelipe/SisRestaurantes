const mongoose = require('mongoose');

/**
 * Delivery — the delivery as a first-class entity, separate from the Order.
 *
 * The Order is *what* was bought; the Delivery is *how* it reaches the customer.
 * They have distinct lifecycles. This entity owns the delivery state machine and
 * a per-transition timestamp trail. Full audit lives in the DeliveryEvent log.
 *
 * Phase A runs this in "shadow" mode alongside the legacy Order.delivery* fields:
 * it records everything without removing anything, so nothing visible breaks.
 */

const STATES = [
  'created', 'ready', 'offered', 'accepted',
  'at_store', 'picked_up', 'en_route', 'at_customer', 'delivered',
  // exception branches
  'no_courier', 'failed', 'returned', 'cancelled',
];

const deliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  orderNumber: { type: String },

  // Current state of the machine
  state: { type: String, enum: STATES, default: 'created', index: true },

  // Assignment
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', default: null },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: null },
  assignmentMethod: { type: String, enum: ['manual', 'auto_nearest', 'auto_scored', 'auto_offer', 'partner', 'qr', 'fixed', null], default: null },

  // Customer snapshot (so the delivery is self-contained for audit)
  customerName: { type: String },
  customerPhone: { type: String },
  address: { type: String },
  coordinates: { lat: Number, lon: Number },

  // Money
  totalAmount: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  cashToCollect: { type: Number, default: 0 },

  // Proof of delivery
  confirmationCode: { type: String, default: null },
  proofPhoto: { type: String, default: null },
  proofLocation: { lat: Number, lon: Number },

  // Exception context
  failureReason: { type: String, default: null },
  cancellationReason: { type: String, default: null },

  // Live location cache (last known driver position while active)
  lastLocation: { lat: Number, lon: Number, at: Date },

  // Per-transition timestamps (the exact flow trail)
  timestamps: {
    createdAt: { type: Date, default: Date.now },
    readyAt: Date,
    offeredAt: Date,
    acceptedAt: Date,
    arrivedStoreAt: Date,
    pickedUpAt: Date,
    enRouteAt: Date,
    arrivedCustomerAt: Date,
    deliveredAt: Date,
    noCourierAt: Date,
    failedAt: Date,
    returnedAt: Date,
    cancelledAt: Date,
  },

  // Lightweight inline history for quick display (full audit in DeliveryEvent)
  history: [{
    state: String,
    event: String,
    actor: String,
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

deliverySchema.index({ businessId: 1, state: 1 });
deliverySchema.index({ driverId: 1, state: 1 });

deliverySchema.statics.STATES = STATES;

// Terminal states — no further transitions
deliverySchema.statics.TERMINAL = ['delivered', 'cancelled', 'returned'];

module.exports = mongoose.model('Delivery', deliverySchema);
module.exports.STATES = STATES;
