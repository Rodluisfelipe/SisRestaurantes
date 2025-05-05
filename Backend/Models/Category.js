const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  displayOrder: {
    type: Number,
    default: 999  // Default high value to place new categories at the end
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  }
});

categorySchema.index({ name: 1, businessId: 1 }, { unique: true });

module.exports = mongoose.models.Category || mongoose.model("Category", categorySchema); 