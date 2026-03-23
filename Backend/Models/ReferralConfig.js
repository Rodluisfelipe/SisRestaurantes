const mongoose = require('mongoose');

/**
 * Singleton model for global referral program configuration.
 * Only one document should exist — use ReferralConfig.getConfig() to access.
 */
const referralConfigSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false
  },
  // Percentage discount for the referrer (applied as COP credits)
  referrerDiscountPercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  // Percentage discount for the referred business (on first paid subscription)
  referredDiscountPercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  // Maximum COP credits a single business can accumulate
  maxCreditsPerBusiness: {
    type: Number,
    default: 500000,
    min: 0
  },
  // Maximum number of referrals a single business can make
  maxReferralsPerBusiness: {
    type: Number,
    default: 50,
    min: 1
  },
  // If true, superadmin must approve before credits are granted
  requireApproval: {
    type: Boolean,
    default: false
  },
  // Referred business must pay at least this many months to qualify
  minSubscriptionMonths: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true
});

/**
 * Get or create the singleton config document.
 */
referralConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const ReferralConfig = mongoose.models.ReferralConfig || mongoose.model('ReferralConfig', referralConfigSchema);

module.exports = ReferralConfig;
