const mongoose = require('mongoose');

const deliverySessionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  dailyCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  validDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

deliverySessionSchema.index({ businessId: 1, validDate: 1 }, { unique: true });

module.exports = mongoose.model('DeliverySession', deliverySessionSchema);
