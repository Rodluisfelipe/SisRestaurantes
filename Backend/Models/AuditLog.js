const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // What happened
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'toggle', 'reorder'],
    required: true,
    index: true
  },
  resource: {
    type: String,
    enum: ['product', 'category', 'toppingGroup', 'businessConfig', 'order', 'subscription'],
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    required: true
  },
  resourceName: {
    type: String,
    default: ''
  },

  // Who did it
  userId: {
    type: String,
    default: null
  },
  userEmail: {
    type: String,
    default: null
  },
  userRole: {
    type: String,
    default: null
  },
  ip: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },

  // Which business
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  businessName: {
    type: String,
    default: ''
  },

  // Snapshots for revert
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Revert tracking
  reverted: {
    type: Boolean,
    default: false
  },
  revertedAt: {
    type: Date,
    default: null
  },
  revertedBy: {
    type: String,
    default: null
  },

  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// TTL: auto-delete after 180 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Compound index for business + time queries
auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ businessId: 1, resource: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
