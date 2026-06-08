/**
 * Worker — perfil de la persona que ofrece su tiempo para turnos.
 * Vive separado del modelo Customer (compra) y del Admin (negocio).
 * Identidad única: phone (E.164).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const VALID_SKILLS = [
  'mesero', 'cocinero', 'barista', 'cajero', 'runner',
  'lavaplatos', 'host', 'recepcionista', 'bartender', 'parrillero',
  'panadero', 'reposteria', 'limpieza', 'eventos', 'delivery',
];

const VALID_LEVELS = ['principiante', 'intermedio', 'experto'];

const skillSchema = new mongoose.Schema({
  key: { type: String, enum: VALID_SKILLS, required: true },
  level: { type: String, enum: VALID_LEVELS, default: 'principiante' },
  yearsExp: { type: Number, default: 0, min: 0, max: 50 },
}, { _id: false });

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=dom, 6=sab
  from: { type: String, required: true }, // "HH:mm"
  to: { type: String, required: true },
}, { _id: false });

const experienceSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true, maxlength: 80 },
  role: { type: String, required: true, trim: true, maxlength: 60 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null }, // null = actual
  description: { type: String, maxlength: 400, default: '' },
  city: { type: String, default: '', maxlength: 40 },
}, { timestamps: true });

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: true, trim: true, maxlength: 80 },
  degree: { type: String, trim: true, maxlength: 80, default: '' },
  fieldOfStudy: { type: String, trim: true, maxlength: 80, default: '' },
  startYear: { type: Number, min: 1950, max: 2100 },
  endYear: { type: Number, min: 1950, max: 2100, default: null }, // null = en curso
  isCurrent: { type: Boolean, default: false },
}, { timestamps: true });

const referenceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  relation: { type: String, required: true, maxlength: 60 }, // "Ex jefe", "Profesor", etc
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
}, { _id: true });

const workerSchema = new mongoose.Schema({
  // Identidad
  phone: { type: String, required: true, unique: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  password: { type: String, default: null }, // null hasta que el worker la setee
  name: { type: String, required: true, trim: true },
  photo: { type: String, default: null },

  // Verificación (modo light, sin KYC todavía)
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  idVerified: { type: Boolean, default: false }, // se sube en sprint 2

  // Perfil
  birthDate: { type: Date, default: null },
  bio: { type: String, maxlength: 400, default: '' },
  university: { type: String, trim: true, default: null },
  cedula: { type: String, trim: true, default: null }, // # cédula (sin imágenes aquí)
  skills: [skillSchema],
  certifications: [{
    key: { type: String },
    verified: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
  }],
  languages: [{ type: String }], // ['es', 'en', 'pt']

  // CV expandido
  experiences: [experienceSchema],
  education: [educationSchema],
  references: [referenceSchema],

  // KYC en casa — verificación documental
  kyc: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected', 'expired'],
      default: 'none',
    },
    cedulaFrontUrl: { type: String, default: null }, // path en Spaces
    cedulaBackUrl: { type: String, default: null },
    selfieUrl: { type: String, default: null }, // selfie sosteniendo la cédula
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
    rejectionReason: { type: String, default: null },
  },

  // Disponibilidad
  availability: [availabilitySlotSchema],
  acceptsSOS: { type: Boolean, default: false }, // último minuto

  // Tarifa
  hourlyRate: { type: Number, default: 12000, min: 5000 }, // COP por hora
  currency: { type: String, default: 'COP' },

  // Ubicación
  location: {
    city: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    maxRadiusKm: { type: Number, default: 8, min: 1, max: 50 },
    transport: { type: String, enum: ['walk', 'public', 'bike', 'car', 'any'], default: 'public' },
  },

  // Pagos
  payoutMethod: {
    type: { type: String, enum: ['nequi', 'daviplata', 'bancolombia', 'transfer', 'wallet'], default: 'wallet' },
    accountInfo: { type: String, default: null }, // # cuenta cifrado
  },

  // Gamification — fuente de verdad para nivel/XP
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1 },
  streakDays: { type: Number, default: 0 },
  lastShiftAt: { type: Date, default: null },
  badgesEarned: [{
    key: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now },
  }],
  mascot: {
    type: { type: String, default: 'capi' }, // futuro: más mascotas
    accessories: [{ type: String }],
    color: { type: String, default: 'brown' },
  },

  // Estado de misiones diarias.
  // - date: 'YYYY-MM-DD' en hora Bogotá. Al cambiar el día, reseteamos `claimed`.
  // - claimed: keys de misiones ya reclamadas hoy (no se puede reclamar dos veces).
  dailyQuestsState: {
    date: { type: String, default: null },
    claimed: { type: [String], default: [] },
  },

  // Stats agregadas
  stats: {
    shiftsCompleted: { type: Number, default: 0 },
    hoursWorked: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    noShows: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
  },

  // Reputación
  rating: {
    avg: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
  },

  // Wallet interno MenuBy
  wallet: {
    balance: { type: Number, default: 0, min: 0 }, // COP
    pendingBalance: { type: Number, default: 0, min: 0 }, // pagos held en escrow
  },

  // Status & moderación
  status: {
    type: String,
    enum: ['pending_verification', 'active', 'suspended', 'banned'],
    default: 'active',
  },
  suspendedUntil: { type: Date, default: null },
  banReason: { type: String, default: null },
  blockedByBusinessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig' }],

  // Refresh token para auth
  refreshToken: { type: String, default: null },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

// Índices geoespacial (cuando agreguemos búsqueda por proximidad)
workerSchema.index({ 'location.lat': 1, 'location.lng': 1 });
workerSchema.index({ status: 1, 'rating.avg': -1 });

// Hash password antes de guardar
workerSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

workerSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Helper estático: agrega XP y recalcula nivel.
// Fórmula: nivel = floor(sqrt(xp / 50)) + 1 → suave al inicio, exigente al final.
workerSchema.statics.addXP = async function(workerId, amount) {
  const worker = await this.findById(workerId);
  if (!worker) return null;
  worker.xp += amount;
  const newLevel = Math.floor(Math.sqrt(worker.xp / 50)) + 1;
  const leveledUp = newLevel > worker.level;
  worker.level = newLevel;
  await worker.save();
  return { worker, leveledUp, gainedXP: amount };
};

module.exports = {
  Worker: mongoose.models.Worker || mongoose.model('Worker', workerSchema),
  VALID_SKILLS,
  VALID_LEVELS,
};
