/**
 * Vacancy — oferta laboral de largo plazo dentro de Crew.
 *
 * Diferente del ShiftPost (turno puntual):
 *   - Modelo: el empleador paga un fee fijo de $10.000 COP por publicar.
 *   - Sin escrow: no se reserva pago por trabajador (la relación laboral
 *     se pacta directamente entre empleador y candidato).
 *   - Postulaciones ilimitadas, con formulario personalizado.
 *   - Ciclo de vida: draft → published (30 días default) → paused/closed/expired.
 *
 * Polimórfico (igual que ShiftPost): puede ser publicada por un negocio MenuBy
 * o por un empleador externo (CrewEmployer).
 */
const mongoose = require('mongoose');
const { VALID_SKILLS } = require('./Worker');

const VACANCY_STATUS = ['draft', 'published', 'paused', 'closed', 'expired'];
const SCHEDULES = ['full_time', 'part_time', 'freelance', 'flexible', 'shift_based'];
const SALARY_PERIODS = ['hourly', 'monthly', 'yearly', 'per_project'];

// Pregunta personalizada del formulario de postulación.
// El empleador define qué quiere saber de los candidatos.
const customQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 280 },
  type: {
    type: String,
    enum: ['text', 'longtext', 'choice', 'multichoice', 'number', 'yes_no'],
    default: 'text',
  },
  options: [{ type: String, maxlength: 100 }], // para choice/multichoice
  required: { type: Boolean, default: false },
  helpText: { type: String, maxlength: 200, default: '' },
}, { _id: true });

const vacancySchema = new mongoose.Schema({
  // ─── Owner polimórfico (mismo patrón que ShiftPost) ───
  ownerType: { type: String, enum: ['business', 'crew_employer'], default: 'business', index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', default: null, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrewEmployer', default: null, index: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },

  ownerDisplay: {
    name: { type: String, default: '' },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },
    businessType: { type: String, default: '' },
    verified: { type: Boolean, default: false },
  },

  // ─── Contenido principal ───
  title: { type: String, required: true, maxlength: 100, trim: true, index: 'text' },
  role: { type: String, enum: VALID_SKILLS, required: true, index: true },
  description: { type: String, maxlength: 4000, default: '' },
  responsibilities: [{ type: String, maxlength: 200 }], // bullet points
  benefits: [{ type: String, maxlength: 100 }], // health, transport, food, etc

  // ─── Requisitos para filtrar candidatos ───
  requirements: {
    minExperienceYears: { type: Number, default: 0, min: 0, max: 50 },
    languages: [{ type: String }],
    certifications: [{ type: String }],
    education: { type: String, default: '' }, // "Bachillerato", "Técnico", "Profesional"
    minLevel: { type: Number, default: 1, min: 1 },
    minRating: { type: Number, default: 0, min: 0, max: 5 },
    skillsRequired: [{ type: String, enum: VALID_SKILLS }],
    skillsPreferred: [{ type: String, enum: VALID_SKILLS }],
  },

  // ─── Salario y horario ───
  schedule: { type: String, enum: SCHEDULES, default: 'full_time' },
  hoursPerWeek: { type: Number, default: null, min: 0, max: 80 }, // opcional
  salary: {
    min: { type: Number, default: null, min: 0 },
    max: { type: Number, default: null, min: 0 },
    period: { type: String, enum: SALARY_PERIODS, default: 'monthly' },
    currency: { type: String, default: 'COP' },
    negotiable: { type: Boolean, default: false },
    hideFromCandidates: { type: Boolean, default: false }, // "A convenir"
  },

  // ─── Ubicación ───
  location: {
    city: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    address: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    isRemote: { type: Boolean, default: false },
    isHybrid: { type: Boolean, default: false },
  },

  // ─── Formulario personalizado ───
  customQuestions: [customQuestionSchema],
  requireCv: { type: Boolean, default: false }, // si exige PDF de CV

  // ─── Publicación ───
  status: { type: String, enum: VACANCY_STATUS, default: 'draft', index: true },
  featured: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  applicationDeadline: { type: Date, default: null },

  // ─── Contadores (denormalizados para queries rápidas en el feed) ───
  applicationCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },

  // ─── Cobro ───
  // pricePaid se setea al publicar. Si más adelante quieren republicar, vuelve a pagar.
  pricePaid: { type: Number, default: 0 },
  paymentTxnId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrewWalletTxn', default: null },

  // ─── Cierre ───
  closeReason: { type: String, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

// Validar consistencia owner ↔ id
vacancySchema.pre('validate', function (next) {
  if (this.ownerType === 'business' && !this.businessId) {
    return next(new Error('ownerType=business requiere businessId'));
  }
  if (this.ownerType === 'crew_employer' && !this.employerId) {
    return next(new Error('ownerType=crew_employer requiere employerId'));
  }
  next();
});

vacancySchema.index({ status: 1, expiresAt: 1 });
vacancySchema.index({ status: 1, 'location.city': 1, role: 1 });
vacancySchema.index({ businessId: 1, status: 1 });
vacancySchema.index({ employerId: 1, status: 1 });

module.exports = mongoose.models.Vacancy || mongoose.model('Vacancy', vacancySchema);
module.exports.VACANCY_STATUS = VACANCY_STATUS;
module.exports.SCHEDULES = SCHEDULES;
module.exports.SALARY_PERIODS = SALARY_PERIODS;
