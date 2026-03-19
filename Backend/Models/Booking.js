const mongoose = require("mongoose");

/**
 * Model for bookings / appointments (citas) — completely separate from orders.
 *
 * Status flow:
 *   pending → confirmed → completed
 *                       → cancelled
 *                       → no_show
 */
const bookingSchema = new mongoose.Schema({
  // Business reference
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },

  // Sequential number (shares sequence with orders for simplicity)
  orderNumber: {
    type: String,
    required: true,
    trim: true
  },

  // ── Customer ──
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

  // ── Booking-specific ──
  bookingDate: {
    type: Date,
    required: true
  },
  bookingEndDate: {
    type: Date,
    required: true
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },

  // Staff / professional
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

  // ── Services (items) ──
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    totalPrice: { type: Number },
    image: { type: String, default: null },
    durationMinutes: { type: Number, default: 30 },
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

  // ── Amounts ──
  totalAmount: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },

  // ── Payment ──
  paymentMethod: {
    type: String,
    enum: ['cash', 'efectivo', 'nequi', 'daviplata', 'transfer', 'transferencia', 'other'],
    default: null
  },

  // ── Coupon ──
  couponCode: { type: String, trim: true, default: null },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },

  // ── Channel / tracking ──
  orderChannel: {
    type: String,
    enum: ['whatsapp', 'inapp', 'pos'],
    default: 'inapp'
  },
  customerToken: { type: String, default: null, index: true },
  customerNotes: { type: String, trim: true, maxlength: 500, default: '' },

  // ── Status history ──
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],

  // ── Cancellation ──
  cancelledAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true, default: null },

  // ── Reminders ──
  remindersSent: [{
    type: { type: String }, // '24h', '1h'
    sentAt: { type: Date, default: Date.now }
  }],

  // ── Completion ──
  completedAt: { type: Date, default: null },

  // ── Timestamps ──
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
bookingSchema.index({ businessId: 1, bookingDate: 1 });
bookingSchema.index({ businessId: 1, bookingStatus: 1 });
bookingSchema.index({ businessId: 1, createdAt: -1 });
bookingSchema.index({ businessId: 1, phone: 1 });

module.exports = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
