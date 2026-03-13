const mongoose = require('mongoose');
const crypto = require('crypto');

const deliveryPersonSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 4
  },
  active: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['available', 'on_delivery'],
    default: 'available'
  }
}, { timestamps: true });

// Hash the code before saving (store SHA-256, not plaintext)
deliveryPersonSchema.pre('save', function(next) {
  if (!this.isModified('code')) return next();
  this.code = crypto.createHash('sha256').update(this.code).digest('hex');
  next();
});

// Verify a plain code against the stored hash
deliveryPersonSchema.methods.verifyCode = function(plainCode) {
  const hashed = crypto.createHash('sha256').update(plainCode).digest('hex');
  return this.code === hashed;
};

// Find a delivery person by business and plain code
deliveryPersonSchema.statics.findByCode = async function(businessId, plainCode) {
  const hashed = crypto.createHash('sha256').update(plainCode).digest('hex');
  return this.findOne({ businessId, code: hashed, active: true });
};

deliveryPersonSchema.index({ businessId: 1, active: 1 });

module.exports = mongoose.model('DeliveryPerson', deliveryPersonSchema);
