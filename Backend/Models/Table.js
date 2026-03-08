const mongoose = require("mongoose");

// Schema for restaurant tables
const tableSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    default: null
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
  },
  // Position on floor map (percentage 0-100)
  posX: { type: Number, default: 10 },
  posY: { type: Number, default: 10 },
  // Visual properties
  shape: { type: String, enum: ['square', 'round', 'rect'], default: 'square' },
  width: { type: Number, default: 10 },   // % of container
  height: { type: Number, default: 10 },
  capacity: { type: Number, default: 4 },
  rotation: { type: Number, default: 0 }
}, { timestamps: true });

// Create a compound index to ensure each business can't have duplicate table numbers
tableSchema.index({ businessId: 1, tableNumber: 1 }, { unique: true });
tableSchema.index({ floorId: 1 });

module.exports = mongoose.models.Table || mongoose.model("Table", tableSchema); 