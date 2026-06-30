const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  logoUrl: { type: String, default: null },
  createdBy: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
