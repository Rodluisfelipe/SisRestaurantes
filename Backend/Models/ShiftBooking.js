/**
 * ShiftBooking — match confirmado entre worker y shift.
 *
 * Ciclo: confirmed → checked_in → completed (o no_show / cancelled).
 * Cuando completed, se libera el pago, se asigna XP, se actualizan badges,
 * y se habilita la review de ambos lados.
 */
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 300, default: '' },
  tags: [{ type: String }], // ['puntual','amable','rapido', 'no_pago_tiempo']
  reviewedAt: { type: Date, default: Date.now },
}, { _id: false });

const shiftBookingSchema = new mongoose.Schema({
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftPost', required: true, index: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },

  // Detalles pactados (snapshot del shift en el momento de aceptar)
  agreedRate: { type: Number, required: true },
  agreedHours: { type: Number, required: true },
  agreedTotal: { type: Number, required: true },

  // Status
  status: {
    type: String,
    enum: ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled_by_worker', 'cancelled_by_business', 'disputed'],
    default: 'confirmed',
    index: true,
  },

  // Check-in
  checkInAt: { type: Date, default: null },
  checkInLat: { type: Number, default: null },
  checkInLng: { type: Number, default: null },
  checkInPhoto: { type: String, default: null },

  // Check-out / completion
  completedAt: { type: Date, default: null },
  confirmedByBusinessAt: { type: Date, default: null },

  // Pago
  payoutStatus: { type: String, enum: ['pending', 'held', 'released', 'refunded'], default: 'pending' },
  payoutId: { type: String, default: null },
  releasedAt: { type: Date, default: null },

  // Reviews
  reviewByBusiness: reviewSchema,
  reviewByWorker: reviewSchema,

  // XP/Reward concedido (para auditoría)
  xpAwarded: { type: Number, default: 0 },
  badgesAwarded: [{ type: String }],

  // Cancelación
  cancelReason: { type: String, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

shiftBookingSchema.index({ workerId: 1, status: 1, createdAt: -1 });
shiftBookingSchema.index({ businessId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.ShiftBooking || mongoose.model('ShiftBooking', shiftBookingSchema);
