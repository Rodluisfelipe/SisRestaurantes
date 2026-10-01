const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * DeliveryPartner — an external delivery company that restaurants can enable
 * to fulfil their delivery orders. Partners log in to a lightweight web portal
 * to see offered orders, accept/reject them, and assign to their own drivers.
 */
const deliveryPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  // Portal login
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  logo: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  // Commission the partner charges per order (informational / reporting)
  commissionType: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'percent'
  },
  commissionValue: {
    type: Number,
    default: 0
  },
  // Cities/areas the partner covers (free text tags, for admin reference)
  coverageAreas: {
    type: [String],
    default: []
  },
  /* Reparto automático: en vez de esperar a que la empresa asigne a mano
     desde su portal, el pedido se le ofrece directo a su domi más cercano.
     Así funciona la red de domis independientes de MenuBy. */
  autoDispatch: {
    type: Boolean,
    default: false
  },
  /* Su página pública y sus clientes propios (envíos por fuera de MenuBy).
     La dirección es menuby.tech/reparto/<slug>. */
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  landing: {
    descripcion: { type: String, maxlength: 400, default: '' },
    ciudad: { type: String, maxlength: 60, default: '' },
    cobertura: { type: String, maxlength: 200, default: '' },
    whatsapp: { type: String, maxlength: 20, default: '' },
    color: { type: String, maxlength: 9, default: '#E11D2A' },
    portada: { type: String, default: null },
    horario: { type: String, maxlength: 120, default: '' },
  },
  // Tarifa por distancia para sus envíos (ver utils/precioEnvio)
  tarifaEnvios: {
    base: { type: Number, default: 0 },
    porKm: { type: Number, default: 0 },
    kmIncluidos: { type: Number, default: 0 },
    minimo: { type: Number, default: 0 },
    maximoKm: { type: Number, default: 0 },
    redondeo: { type: Number, default: 100 },
  },
  // Zonas con precio fijo (mandan sobre la tarifa por distancia)
  zonasEnvio: { type: mongoose.Schema.Types.Mixed, default: [] },
  // Dónde está la empresa (para ubicar sus domis y proponer recogidas)
  ubicacion: { lat: Number, lng: Number },
  // La empresa de plataforma que agrupa a los domis independientes (una sola)
  esRedMenuby: {
    type: Boolean,
    default: false,
    index: true
  },
  maxActivePerDriver: {
    type: Number,
    default: 2,
    min: 1,
    max: 5
  },
  driverPay: {
    modo: { type: String, enum: ['domicilio', 'fijo', 'porcentaje', 'ninguno'], default: 'domicilio' },
    valor: { type: Number, default: 0 }
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  }
}, { timestamps: true });

// Hash password on set
deliveryPartnerSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

deliveryPartnerSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
