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