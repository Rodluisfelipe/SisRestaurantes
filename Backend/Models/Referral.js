const mongoose = require('mongoose');

const REFERRAL_STATUSES = ['pending', 'qualified', 'approved', 'credited', 'rejected'];

const referralSchema = new mongoose.Schema({
  // The business that shared their referral code
  referrerBusinessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  // The new business that registered using the code
  referredBusinessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  // The code used at registration
  referralCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  /**
   * Status flow:
   *   pending   → registered but hasn't paid yet
   *   qualified → referred business paid first subscription
   *   approved  → superadmin approved (only when requireApproval=true)
   *   credited  → credits deposited to referrer
   *   rejected  → superadmin rejected
   */
  status: {
    type: String,
    enum: REFERRAL_STATUSES,
    default: 'pending'
  },
  // COP credits awarded to the referrer
  referrerCreditsAwarded: {
    type: Number,
    default: 0,
    min: 0
  },
  // COP discount given to the referred business (for record-keeping)
  referredDiscountAwarded: {
    type: Number,
    default: 0,
    min: 0
  },
  qualifiedAt: { type: Date, default: null },
  creditedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null, maxlength: 500 },
  notes: { type: String, default: '', maxlength: 1000 }
}, {
  timestamps: true
});

// Indexes
referralSchema.index({ referrerBusinessId: 1, status: 1 });
referralSchema.index({ referredBusinessId: 1 }, { unique: true }); // A business can only be referred once
referralSchema.index({ referralCode: 1 });

const Referral = mongoose.models.Referral || mongoose.model('Referral', referralSchema);

module.exports = Referral;
module.exports.REFERRAL_STATUSES = REFERRAL_STATUSES;
