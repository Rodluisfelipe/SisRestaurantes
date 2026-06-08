/**
 * CrewEmployer — empleador externo al ecosistema MenuBy que quiere publicar
 * turnos en el marketplace Crew.
 *
 * Dos sub-tipos (campo `kind`):
 *   - 'individual': una persona que necesita ayuda puntual (boda, evento privado,
 *     mudanza, fiesta). Pocos campos obligatorios.
 *   - 'business': un negocio sin MenuBy (catering, eventos, retail, salud, etc.).
 *     Más campos: razón social, dirección, sitio web.
 *
 * Auth: phone + password (mismo patrón que Worker). JWT con `kind: 'crew_employer'`.
 *
 * Onboarding: registro libre → `status: 'pending_approval'` → SuperAdmin aprueba
 * → puede recargar wallet y publicar turnos.
 *
 * Wallet: misma estructura que BusinessConfig.crewWallet — el ledger trata
 * a estos empleadores como `actorType: 'crew_employer'`.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EMPLOYER_KIND = ['individual', 'business'];

const EMPLOYER_STATUS = [
  'pending_approval', // recién registrado, esperando revisión SuperAdmin
  'approved',         // puede operar normalmente
  'rejected',         // SuperAdmin rechazó (con motivo)
  'suspended',        // pausado temporalmente
  'banned',           // bloqueado permanente
];

// Tipos extendidos: incluyen los de BusinessConfig + tipos de eventos/servicios
// pensados específicamente para empleadores Crew.
const EMPLOYER_BUSINESS_TYPES = [
  // Categorías de food/hospitality (mismos que BusinessConfig)
  'restaurant', 'cafe', 'bakery', 'ice_cream', 'bar', 'food_truck', 'fast_food',
  'hotel', 'catering',
  // Eventos y producción
  'event_organizer', 'wedding', 'corporate_event', 'private_party', 'production',
  // Retail y servicios
  'retail', 'salon', 'spa', 'clinic', 'home_service', 'cleaning', 'moving',
  // Comodín
  'services', 'other',
];

const crewEmployerSchema = new mongoose.Schema({
  // ─── Identidad ───
  kind: { type: String, enum: EMPLOYER_KIND, required: true, index: true },
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  password: { type: String, required: true },

  // Display: para individuals es su nombre. Para business, la razón comercial.
  name: { type: String, required: true, trim: true, maxlength: 80 },
  photo: { type: String, default: null },        // avatar o logo
  coverImage: { type: String, default: null },   // banner del perfil
  description: { type: String, maxlength: 400, default: '' },

  // ─── Específico de individual ───
  birthDate: { type: Date, default: null },
  cedula: { type: String, trim: true, default: null },

  // ─── Específico de business ───
  businessType: { type: String, enum: EMPLOYER_BUSINESS_TYPES, default: 'other' },
  nit: { type: String, trim: true, default: null },     // # RUT/NIT Colombia
  website: { type: String, trim: true, default: null },
  whatsappNumber: { type: String, trim: true, default: null },

  // ─── Ubicación ───
  address: {
    full: { type: String, default: '' },
    city: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
  },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },

  // ─── Wallet Crew (mismo shape que BusinessConfig.crewWallet) ───
  crewWallet: {
    balance: { type: Number, default: 0, min: 0 },
    pendingBalance: { type: Number, default: 0, min: 0 },
    totalReserved: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    totalCommissionPaid: { type: Number, default: 0 },
    currency: { type: String, default: 'COP' },
    lastRechargeAt: { type: Date, default: null },
  },

  // ─── Onboarding y estado ───
  status: { type: String, enum: EMPLOYER_STATUS, default: 'pending_approval', index: true },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  rejectionReason: { type: String, default: null },
  suspendedUntil: { type: Date, default: null },
  banReason: { type: String, default: null },

  // ─── KYC opcional para upgrade a "Verificado" ───
  verifiedAt: { type: Date, default: null },
  verificationDocs: {
    idFrontUrl: { type: String, default: null },
    idBackUrl: { type: String, default: null },
    selfieUrl: { type: String, default: null },
    nitDocUrl: { type: String, default: null }, // solo business
  },

  // ─── Stats agregadas para ranking en el feed ───
  stats: {
    shiftsPublished: { type: Number, default: 0 },
    shiftsCompleted: { type: Number, default: 0 },
    workersHired: { type: Number, default: 0 }, // distintos workers
    cancellations: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 }, // calificación de workers
    ratingCount: { type: Number, default: 0 },
  },

  // ─── Auditoría ───
  signupSource: { type: String, default: 'crew_self' },
  lastLoginAt: { type: Date, default: null },
  refreshToken: { type: String, default: null },
}, { timestamps: true });

crewEmployerSchema.index({ status: 1, createdAt: -1 });

// Hash password antes de guardar (mismo patrón que Worker)
crewEmployerSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

crewEmployerSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.models.CrewEmployer || mongoose.model('CrewEmployer', crewEmployerSchema);
module.exports.EMPLOYER_KIND = EMPLOYER_KIND;
module.exports.EMPLOYER_STATUS = EMPLOYER_STATUS;
module.exports.EMPLOYER_BUSINESS_TYPES = EMPLOYER_BUSINESS_TYPES;
