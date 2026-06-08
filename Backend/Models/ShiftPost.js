/**
 * ShiftPost — un negocio publica que necesita gente para un turno.
 * Una vez "open", workers pueden aplicar. Cuando se aceptan los workers
 * necesarios, el post pasa a "filled". Después → "completed" o "cancelled".
 */
const mongoose = require('mongoose');
const { VALID_SKILLS } = require('./Worker');

const POST_STATUS = ['open', 'partially_filled', 'filled', 'in_progress', 'completed', 'cancelled'];

const shiftPostSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },

  title: { type: String, required: true, maxlength: 80, trim: true },
  description: { type: String, maxlength: 600, default: '' },
  role: { type: String, enum: VALID_SKILLS, required: true, index: true },
  skillsBonus: [{ type: String, enum: VALID_SKILLS }], // skills opcionales que dan match preferencial

  // Tiempo
  date: { type: Date, required: true, index: true },
  startTime: { type: String, required: true }, // "HH:mm"
  endTime: { type: String, required: true },
  hoursTotal: { type: Number, required: true, min: 1, max: 16 },

  // Necesidad
  workersNeeded: { type: Number, default: 1, min: 1, max: 20 },
  workersBooked: { type: Number, default: 0 },

  // Pago
  hourlyRate: { type: Number, required: true, min: 5000 },
  totalPay: { type: Number, required: true }, // hoursTotal * hourlyRate
  currency: { type: String, default: 'COP' },
  paymentMethod: { type: String, enum: ['platform', 'cash_after_shift'], default: 'platform' },

  // Escrow — comisión y reserva calculados al publicar.
  // commissionRate va al 0..1 (ej. 0.10). `reservedAmount` es lo que sale
  // de crewWallet.balance del negocio y queda en pendingBalance hasta liberar.
  commissionRate: { type: Number, default: 0.10, min: 0, max: 0.5 },
  commissionAmount: { type: Number, default: 0 },        // = totalPay * commissionRate (por workerNeeded)
  reservedAmount: { type: Number, default: 0 },          // total escrow restante (no liberado)
  releasedAmount: { type: Number, default: 0 },          // suma liberada a workers
  refundedAmount: { type: Number, default: 0 },          // suma devuelta al negocio

  // Requisitos
  requirements: {
    minLevel: { type: Number, default: 1, min: 1 },
    minRating: { type: Number, default: 0, min: 0, max: 5 },
    certifications: [{ type: String }], // ['manipulacion_alimentos']
    languages: [{ type: String }],
    minExperienceYears: { type: Number, default: 0 },
  },
  perks: [{ type: String }], // ['cena_incluida', 'transporte_final', 'propinas_garantizadas']

  // Ubicación heredada del business, snapshot para evitar joins en búsqueda
  location: {
    city: { type: String },
    neighborhood: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },

  // Visibility
  visibility: { type: String, enum: ['public', 'favorites_only', 'invited_only'], default: 'public' },
  invitedWorkerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],

  // Match
  matchMode: { type: String, enum: ['open', 'auto_match'], default: 'open' },

  // Featured & SOS
  featured: { type: Boolean, default: false },
  featuredUntil: { type: Date, default: null },
  isSOS: { type: Boolean, default: false }, // último minuto, recibe boost en feed

  // Status
  status: { type: String, enum: POST_STATUS, default: 'open', index: true },

  // Auto-cancel si no se llenan los slots
  expiresAt: { type: Date, default: null },

  // Para auditoría
  cancelReason: { type: String, default: null },
}, { timestamps: true });

shiftPostSchema.index({ status: 1, date: 1, 'location.city': 1 });
shiftPostSchema.index({ businessId: 1, status: 1, date: -1 });

// Auto-calcular totalPay si no viene
shiftPostSchema.pre('save', function(next) {
  if (this.hoursTotal && this.hourlyRate) {
    this.totalPay = Math.round(this.hoursTotal * this.hourlyRate);
  }
  next();
});

module.exports = mongoose.models.ShiftPost || mongoose.model('ShiftPost', shiftPostSchema);
