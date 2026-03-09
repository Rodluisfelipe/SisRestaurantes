const mongoose = require('mongoose');

/* ── Reward sub-schema ── */
const rewardSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: ['free_product', 'discount_percent', 'discount_fixed', 'free_delivery'],
    required: true
  },
  // For free_product: the productId to give away
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, trim: true },
  // For discount_percent / discount_fixed: the value
  discountValue: { type: Number, default: 0 },
  // Max discount for percentage discounts
  maxDiscount: { type: Number, default: 0 },
  // Cost in points
  pointsCost: { type: Number, required: true, min: 1 },
  // Which order modes this reward applies to (empty = all)
  applicableOrderModes: [{
    type: String,
    enum: ['inSite', 'takeaway', 'delivery']
  }],
  isActive: { type: Boolean, default: true },
  timesRedeemed: { type: Number, default: 0 }
}, { _id: true });

/* ── Tier sub-schema ── */
const tierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  minPoints: { type: Number, required: true, default: 0 },
  multiplier: { type: Number, default: 1 },
  color: { type: String, default: '#94a3b8' },
  icon: { type: String, default: 'star' },
  benefits: [{ type: String }]
}, { _id: true });

/* ── Main Loyalty Program schema (one per business) ── */
const loyaltyProgramSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    unique: true
  },
  isActive: { type: Boolean, default: false },

  // Points earning config
  pointsPerAmount: { type: Number, default: 1 },       // points earned
  amountPerPoints: { type: Number, default: 10000 },    // per this many $ spent (COP)

  // Bonus points
  firstOrderBonus: { type: Number, default: 0 },
  referralBonus: { type: Number, default: 0 },

  // Point expiry (0 = never)
  pointsExpiryDays: { type: Number, default: 90 },

  // Tiers
  tiersEnabled: { type: Boolean, default: false },
  tiers: [tierSchema],

  // Rewards catalog
  rewards: [rewardSchema]
}, {
  timestamps: true
});

module.exports = mongoose.models.LoyaltyProgram || mongoose.model('LoyaltyProgram', loyaltyProgramSchema);
