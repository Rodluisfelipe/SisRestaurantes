const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// GeoJSON Point subdocument. `default: undefined` on lastLocation (below) keeps
// the field ABSENT until a real position is reported — otherwise Mongoose would
// store `{ type: 'Point' }` with no coordinates, which the 2dsphere index rejects
// ("Can't extract geo keys"), making every domi creation fail with a 500.
const PointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

const deliveryPersonSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    // Required for own-fleet drivers; partner drivers belong to a partner instead.
    required: function () { return !this.partnerId; },
    index: true
  },
  // ── Real account credentials (Phase B): phone + password login ──
  // Optional — a driver can still use the legacy 4-digit PIN (`code`) as a fallback.
  phone: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  passwordHash: {
    type: String,
    default: null
  },
  // Hashed refresh token (rotated on each refresh) for long-lived sessions
  refreshTokenHash: {
    type: String,
    default: null
  },
  // FCM registration token (native DriverApp) — used to alert the driver of new
  // offers even when the app is closed. Set from the app after login.
  fcmToken: {
    type: String,
    default: null
  },
  // MenuBy Go con el aviso nativo de "llamada": recibe los pedidos como mensajes
  // de datos de alta prioridad y la app pinta la llamada (ver fcmService)
  fcmLlamadas: {
    type: Boolean,
    default: false
  },
  // If set, this driver belongs to an external delivery company (partner) and
  // can serve any restaurant that has enabled that partner.
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  // Profile photo URL (DigitalOcean Spaces). Independent drivers: the selfie verified at registration (copied on approval); the driver cannot change it
  photo: {
    type: String,
    default: null
  },
  code: {
    type: String,
    required: true,
    // Stores a SHA-256 hash (64 chars), not the raw PIN. The 4-digit PIN is
    // validated at the API layer before hashing — a length constraint here made
    // every save() of an existing domi fail validation (hash is 64 chars).
  },
  active: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['available', 'on_delivery'],
    default: 'available'
  },
  // Whether the driver has toggled themselves online in the app (available to receive)
  isOnline: {
    type: Boolean,
    default: false
  },
  // Last known GPS position (GeoJSON Point [lng, lat]) — used by the assignment
  // algorithm. Absent until the driver reports a location (see PointSchema note).
  lastLocation: {
    type: PointSchema,
    default: undefined
  },
  lastSeenAt: {
    type: Date,
    default: null
  },
  // Rolling average rating (1-5), used by the scoring algorithm
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  },
  // Number of orders currently assigned & not yet delivered (load factor for scoring)
  activeDeliveries: {
    type: Number,
    default: 0
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  /* Red MenuBy: domi independiente que se registró solo desde la app.
     Pertenece a la empresa de plataforma "Red MenuBy" (partnerId) y solo
     reparte para los negocios que el superadmin le asigne. Mientras su
     registro no esté aprobado, no recibe nada. */
  independiente: {
    estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado', 'suspendido'], default: undefined },
    documento: {
      tipo: { type: String, enum: ['cc', 'ce', 'ppt', 'pasaporte'] },
      numero: { type: String, trim: true, maxlength: 20 },
      // Llaves privadas en Spaces: se ven solo con enlace firmado y temporal
      frente: { type: String },
      reverso: { type: String },
    },
    selfie: { type: String },
    vehiculo: {
      tipo: { type: String, enum: ['moto', 'bicicleta', 'carro', 'a_pie'] },
      placa: { type: String, trim: true, uppercase: true, maxlength: 10 },
    },
    telefonoVerificadoAt: { type: Date },
    // Correo verificado con el código del registro
    email: { type: String, lowercase: true, trim: true, maxlength: 120 },
    enviadoAt: { type: Date },
    revisadoAt: { type: Date },
    revisadoPor: { type: String },
    motivo: { type: String, maxlength: 300 },
  },
  // Negocios para los que el superadmin habilitó a este domi independiente
  negociosAsignados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig' }]
}, { timestamps: true });

// Hash the code before saving (store SHA-256, not plaintext)
deliveryPersonSchema.pre('save', function(next) {
  if (!this.isModified('code')) return next();
  this.code = crypto.createHash('sha256').update(this.code).digest('hex');
  next();
});

// Verify a plain code against the stored hash
deliveryPersonSchema.methods.verifyCode = function(plainCode) {
  const hashed = crypto.createHash('sha256').update(plainCode).digest('hex');
  return this.code === hashed;
};

// Find a delivery person by business and plain code
deliveryPersonSchema.statics.findByCode = async function(businessId, plainCode) {
  const hashed = crypto.createHash('sha256').update(plainCode).digest('hex');
  return this.findOne({ businessId, code: hashed, active: true });
};

// ── Password auth (Phase B) ──
deliveryPersonSchema.methods.setPassword = async function(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

deliveryPersonSchema.methods.verifyPassword = async function(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

// Normalize a phone to digits only for consistent lookup
deliveryPersonSchema.statics.normalizePhone = function(phone) {
  return (phone || '').replace(/\D/g, '');
};

deliveryPersonSchema.index({ businessId: 1, active: 1 });
deliveryPersonSchema.index({ lastLocation: '2dsphere' });

module.exports = mongoose.model('DeliveryPerson', deliveryPersonSchema);
