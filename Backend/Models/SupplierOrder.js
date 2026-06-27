const mongoose = require('mongoose');

const supplierOrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  unit: { type: String, default: 'unidad' },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 }
}, { _id: false });

const supplierOrderSchema = new mongoose.Schema({
  // Restaurante que hace el pedido
  buyerBusinessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  buyerBusinessName: { type: String, required: true },

  // Proveedor al que se le pide
  supplierBusinessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  supplierBusinessName: { type: String, required: true },

  items: [supplierOrderItemSchema],

  total: { type: Number, required: true, min: 0 },

  // pending_approval → esperando aprobación SuperAdmin
  // approved         → SuperAdmin aprobó, proveedor debe procesar
  // processing       → proveedor confirmó y está preparando
  // delivered        → entregado
  // cancelled        → cancelado
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'processing', 'delivered', 'cancelled'],
    default: 'pending_approval'
  },

  superadminNote: { type: String, default: '' },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: String, default: null },

  deliveryAddress: { type: String, default: '' },
  buyerNote: { type: String, default: '' }
}, { timestamps: true });

supplierOrderSchema.index({ buyerBusinessId: 1, createdAt: -1 });
supplierOrderSchema.index({ supplierBusinessId: 1, createdAt: -1 });
supplierOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.SupplierOrder || mongoose.model('SupplierOrder', supplierOrderSchema);
