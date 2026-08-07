const mongoose = require('mongoose');

/* ── Points transaction log ── */
const pointsTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['earn', 'redeem', 'bonus', 'expire', 'adjust'],
    required: true
  },
  points: { type: Number, required: true },    // positive = earned, negative = spent
  description: { type: String, trim: true },
  // Reference to what triggered it
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rewardId: { type: mongoose.Schema.Types.ObjectId },
  rewardName: { type: String },
  expiresAt: { type: Date },
  /* Marca de que estos puntos ya vencieron. Antes se ponía `points` a 0 para
     que no volvieran a expirar, pero eso borraba cuántos puntos se habían
     ganado: el historial dejaba de sumar el saldo y no había forma de
     auditarlo. Con la marca, la línea original se conserva intacta. */
  expired: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

/* ── Customer loyalty profile (one per customer-business pair) ── */
const customerLoyaltySchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  phone: { type: String, required: true, trim: true },

  // Current balance
  points: { type: Number, default: 0 },
  // Lifetime stats
  totalEarned: { type: Number, default: 0 },
  totalRedeemed: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },

  // Current tier name (computed from program tiers)
  currentTier: { type: String, default: '' },

  // Transactions history
  transactions: [pointsTransactionSchema],

  lastActivityAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// One loyalty profile per customer per business
customerLoyaltySchema.index({ businessId: 1, customerId: 1 }, { unique: true });
customerLoyaltySchema.index({ businessId: 1, phone: 1 }, { unique: true });

// Method: award points for an order
customerLoyaltySchema.methods.earnPoints = function(points, orderId, description, expiresAt) {
  this.points += points;
  this.totalEarned += points;
  this.totalOrders += 1;
  this.lastActivityAt = new Date();
  this.transactions.push({
    type: 'earn',
    points,
    description,
    orderId,
    expiresAt
  });
  return this;
};

// Method: redeem points for a reward
customerLoyaltySchema.methods.redeemPoints = function(points, rewardId, rewardName) {
  if (this.points < points) {
    throw new Error('Puntos insuficientes');
  }
  this.points -= points;
  this.totalRedeemed += points;
  this.lastActivityAt = new Date();
  this.transactions.push({
    type: 'redeem',
    points: -points,
    description: `Canjeo: ${rewardName}`,
    rewardId,
    rewardName
  });
  return this;
};

// Method: compute tier from program tiers
customerLoyaltySchema.methods.computeTier = function(tiers) {
  if (!tiers || !tiers.length) {
    this.currentTier = '';
    return this;
  }
  // Sort tiers descending by minPoints
  const sorted = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  const tier = sorted.find(t => this.totalEarned >= t.minPoints);
  this.currentTier = tier ? tier.name : sorted[sorted.length - 1].name;
  return this;
};

module.exports = mongoose.models.CustomerLoyalty || mongoose.model('CustomerLoyalty', customerLoyaltySchema);
