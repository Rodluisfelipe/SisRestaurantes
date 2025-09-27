const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
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
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Índice compuesto para búsqueda eficiente
customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

// Método para actualizar estadísticas después de un pedido
customerSchema.methods.updateStats = function(orderTotal) {
  this.totalOrders += 1;
  this.totalSpent += orderTotal;
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