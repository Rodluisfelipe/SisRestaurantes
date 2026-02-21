const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  businessId: {
    type: Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },

  // Rating & review content
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500,
    default: ''
  },

  // Restaurant reply
  reply: {
    type: String,
    maxlength: 300,
    default: null
  },
  repliedAt: {
    type: Date,
    default: null
  },

  // Moderation
  isVisible: {
    type: Boolean,
    default: true
  },

  // Order context snapshot
  orderType: {
    type: String,
    enum: ['inSite', 'takeaway', 'delivery']
  },
  orderTotal: {
    type: Number
  }
}, { timestamps: true });

// Indexes
reviewSchema.index({ businessId: 1, createdAt: -1 });
reviewSchema.index({ businessId: 1, rating: 1 });
reviewSchema.index({ orderId: 1 }, { unique: true });
reviewSchema.index({ phone: 1, businessId: 1 });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;
