const mongoose = require('mongoose');
const logger = require('../utils/logger');

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig', // NOTA: Cambiado de 'Business' a 'BusinessConfig' para consistencia con el resto del sistema
    required: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },

  /* ── Identificación formal ───────────────────────────────────────────────

     Hasta ahora un cliente se identificaba **solo por teléfono**. Eso basta
     para un domicilio, pero no para facturar a nombre de alguien ni para que
     el cajero encuentre a quien llega al mostrador sin decir su número.

     `sparse` porque la inmensa mayoría de los clientes de un restaurante no
     dejan documento: un índice normal fallaría al segundo cliente sin él. */
  documento: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },
  tipoDocumento: {
    type: String,
    enum: ['CC', 'NIT', 'CE', 'PP'],
    default: 'CC'
  },

  /* ── Saldo a favor ───────────────────────────────────────────────────────

     Plata que el negocio le debe al cliente: una devolución que se dejó como
     crédito, un abono, un "fiao" prepagado.

     En pesos enteros, como todo el dinero del sistema. Y con `min: 0` a
     propósito: esto es **saldo a favor**, no una línea de crédito. Un número
     negativo aquí significaría que el cliente le debe al negocio, que es un
     problema distinto —cartera— y necesita su propio modelo con vencimientos
     y cobranza. Mezclarlos en un solo campo termina en un cliente con saldo
     negativo al que nadie le cobra. */
  saldoFavor: {
    type: Number,
    default: 0,
    min: 0
  },
  /* La cartera: lo que el cliente debe. Es el modelo aparte que pedía el
     comentario de arriba: habilitado, un cupo, y el saldo, que es la suma de
     sus movimientos (Models/CreditoMovimiento.js). */
  credito: {
    habilitado: { type: Boolean, default: false },
    cupo: { type: Number, default: 0, min: 0 },
    saldo: { type: Number, default: 0, min: 0 },
  },
  // Estadísticas del cliente
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'vip'],
    default: 'active'
  },
  // ── Extended profile fields ──
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 254,
    default: null
  },
  birthdate: {
    type: Date,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  whatsappOptOut: {
    type: Boolean,
    default: false
  },
  /* Las direcciones que el cliente guarda en "Mi cuenta" ("Casa",
     "Oficina"). `address` sigue siendo la última usada, para lo que ya la lee. */
  direcciones: [{
    etiqueta: { type: String, trim: true, maxlength: 30, default: 'Dirección' },
    texto: { type: String, trim: true, maxlength: 200, required: true },
    referencia: { type: String, trim: true, maxlength: 200, default: '' },
    principal: { type: Boolean, default: false },
  }],
  notes: [{
    text: { type: String, required: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdByName: { type: String, maxlength: 100 },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Índice compuesto para búsqueda eficiente
customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

/* Buscar por documento en el mostrador: el cliente dice su cédula y tiene que
   aparecer antes de que termine de decirla. Parcial porque casi ninguno lo
   tiene, y un índice sobre miles de cadenas vacías no sirve para nada. */
customerSchema.index(
  { businessId: 1, documento: 1 },
  { partialFilterExpression: { documento: { $gt: '' } } }
);

/* Lo que pide la caja: "dame lo que cambió desde tal fecha". Sin este índice,
   cada sincronización de cada terminal recorre la colección entera. */
customerSchema.index({ businessId: 1, updatedAt: 1 });

// Método para actualizar estadísticas después de un pedido
customerSchema.methods.updateStats = function(orderTotal) {
  // Asegurar que orderTotal sea un número válido
  const numericOrderTotal = parseFloat(orderTotal);
  if (isNaN(numericOrderTotal) || !isFinite(numericOrderTotal)) {
    logger.error('Invalid orderTotal in updateStats', { orderTotal });
    throw new Error(`Invalid order total: ${orderTotal}`);
  }
  
  this.totalOrders += 1;
  this.totalSpent += numericOrderTotal;
  this.lastOrderDate = new Date();
  return this.save();
};

// Método estático para encontrar o crear cliente
customerSchema.statics.findOrCreate = async function(businessId, phone, name) {
  let customer = await this.findOne({ businessId, phone });
  
  if (!customer) {
    customer = new this({
      businessId,
      phone,
      name
    });
    await customer.save();
  }
  
  return customer;
};

module.exports = mongoose.model('Customer', customerSchema);