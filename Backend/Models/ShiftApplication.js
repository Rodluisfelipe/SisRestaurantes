/**
 * ShiftApplication — un worker manifestó interés en un shift.
 * Cuando un business la acepta, se crea un ShiftBooking y se cierra esta
 * application como `accepted`.
 */
const mongoose = require('mongoose');

const shiftApplicationSchema = new mongoose.Schema({
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftPost', required: true, index: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  message: { type: String, maxlength: 200, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled_by_worker', 'expired'],
    default: 'pending',
    index: true,
  },
  appliedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  // Score calculado al momento de aplicar (para ordenar la lista del business)
  matchScore: { type: Number, default: 0 },
}, { timestamps: true });

// Un worker no puede aplicar 2 veces al mismo shift
shiftApplicationSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });

module.exports = mongoose.models.ShiftApplication || mongoose.model('ShiftApplication', shiftApplicationSchema);
