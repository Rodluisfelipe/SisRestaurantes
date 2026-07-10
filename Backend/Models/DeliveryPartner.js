const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * DeliveryPartner — an external delivery company that restaurants can enable
 * to fulfil their delivery orders. Partners log in to a lightweight web portal
 * to see offered orders, accept/reject them, and assign to their own drivers.
 */
const deliveryPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  // Portal login
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  logo: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  // Commission the partner charges per order (informational / reporting)
  commissionType: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'percent'
  },
  commissionValue: {
    type: Number,
    default: 0
  },
  // Cities/areas the partner covers (free text tags, for admin reference)
  coverageAreas: {
    type: [String],
    default: []
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  }
}, { timestamps: true });

// Hash password on set
deliveryPartnerSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

deliveryPartnerSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
