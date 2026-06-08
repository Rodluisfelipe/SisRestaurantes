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
  // El código solo lo conoce el negocio. El worker NO puede check-inear sin verlo,
  // así garantizamos que llegó físicamente al sitio. Se genera al aceptar el
  // booking. Caracteres alfanuméricos sin ambigüedad (sin 0/O/I/1).
  checkInCode: { type: String, default: null, index: true },
  checkInAt: { type: Date, default: null },
  checkInLat: { type: Number, default: null },
  checkInLng: { type: Number, default: null },
  checkInPhoto: { type: String, default: null },
  checkInAttempts: { type: Number, default: 0 }, // anti brute-force

  // Check-out / completion
  completedAt: { type: Date, default: null },
  confirmedByBusinessAt: { type: Date, default: null },

  // Pago — descompuesto en lo que va al worker vs. lo que se queda Crew.
  // Al crear el booking el dinero ya está en escrow (pendingBalance del negocio).
  // Al completarse, agreedTotal → worker.wallet.balance y commissionAmount → Crew.
  agreedCommission: { type: Number, default: 0 },
  payoutStatus: { type: String, enum: ['held', 'released', 'refunded'], default: 'held' },
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
