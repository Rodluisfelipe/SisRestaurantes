const mongoose = require("mongoose");

const floorSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

floorSchema.index({ businessId: 1, order: 1 });

module.exports = mongoose.models.Floor || mongoose.model("Floor", floorSchema);
