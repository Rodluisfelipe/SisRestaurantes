const mongoose = require('mongoose');

/**
 * DeliveryOffer — a time-boxed, exclusive offer of a delivery to one driver.
 *
 * The offer lifecycle is the heart of Phase C:
 *   pending → accepted            (driver takes it)
 *   pending → rejected            (driver declines → re-offer to next)
 *   pending → expired             (no response in time → re-offer to next)
 *   pending → superseded          (delivery got assigned another way / cancelled)
 *
 * A background sweeper expires stale pending offers and re-offers automatically.
 */
const deliveryOfferSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', required: true, index: true },

  state: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'superseded'], default: 'pending', index: true },
  attempt: { type: Number, default: 1 },       // nth offer for this delivery
  distanceKm: { type: Number, default: null },

  offeredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

// Fast sweep of pending offers past their expiry
deliveryOfferSchema.index({ state: 1, expiresAt: 1 });

module.exports = mongoose.model('DeliveryOffer', deliveryOfferSchema);
