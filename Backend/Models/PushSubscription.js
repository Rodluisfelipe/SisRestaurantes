const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
  },
  userId: { // Optional, for user-specific notifications within a business
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin', // Assuming Admin model for merchants
    required: false,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true, // Ensure unique endpoints
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

pushSubscriptionSchema.index({ businessId: 1, userId: 1 });
pushSubscriptionSchema.index({ endpoint: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
