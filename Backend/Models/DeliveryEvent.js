const mongoose = require('mongoose');

/**
 * DeliveryEvent — immutable audit log. One row per state transition (or notable
 * event). This is the "todo evento se registra" principle: who, when, where, what.
 *
 * Never updated after creation — only appended. Enables full support/audit:
 * you can replay the exact life of any delivery.
 */
const deliveryEventSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', index: true },

  // Transition
  event: { type: String, required: true },   // e.g. 'offer', 'accept', 'pickup', 'deliver'
  fromState: { type: String },
  toState: { type: String },

  // Who caused it
  actor: { type: String, enum: ['system', 'admin', 'driver', 'partner', 'customer'], default: 'system' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorName: { type: String, default: null },

  // Where (optional GPS at the moment of the event)
  location: { lat: Number, lon: Number },

  // Arbitrary structured context (reason, distance, code attempts, etc.)
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

deliveryEventSchema.index({ deliveryId: 1, createdAt: 1 });
deliveryEventSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryEvent', deliveryEventSchema);
