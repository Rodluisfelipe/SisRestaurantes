const mongoose = require("mongoose");

// Schema for restaurant tables
const tableSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  tableName: {
    type: String,
    trim: true
  },
  qrCodeUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Create a compound index to ensure each business can't have duplicate table numbers
tableSchema.index({ businessId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.models.Table || mongoose.model("Table", tableSchema); 