const mongoose = require('mongoose');

/**
 * Modelo para solicitudes de pago manual
 * Permite a los negocios subir comprobantes de pago para renovar/extender suscripciones
 */
const paymentRequestSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'COP',
    enum: ['COP']
  },
  monthsPurchased: {
    type: Number,
    required: true,
    enum: [1, 3, 6, 12]
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Nequi', 'Daviplata', 'Transferencia', 'CASH', 'OTHER']
  },
  proofUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
paymentRequestSchema.index({ businessId: 1, status: 1 });
paymentRequestSchema.index({ status: 1, createdAt: -1 });
paymentRequestSchema.index({ createdAt: -1 });

// Método para verificar si el negocio tiene una solicitud pendiente
paymentRequestSchema.statics.hasPendingRequest = async function(businessId) {
  const count = await this.countDocuments({
    businessId,
    status: 'pending'
  });
  return count > 0;
};

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);

