const mongoose = require("mongoose");

const movementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense', 'sale', 'refund'],
    required: true
  },
  amount: { type: Number, required: true },
  description: { type: String, trim: true, default: '' },
  paymentMethod: { type: String, trim: true, default: '' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  orderNumber: { type: String, default: '' },
  orderChannel: { type: String, enum: ['pos', 'menuby', ''], default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now }
});

const cashRegisterSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  /* Quién abrió. En el POS web es el Admin que inició sesión; en la caja
     nativa es la cuenta del negocio bajo la que está registrada la caja, y el
     nombre del cajero que contó va aparte, en `cajeroNombre`. */
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  openedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  openingAmount: { type: Number, required: true, default: 0 },
  closingAmount: { type: Number },
  expectedAmount: { type: Number },
  difference: { type: Number },
  movements: [movementSchema],
  salesSummary: {
    totalSales: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    byPaymentMethod: { type: Map, of: { count: Number, total: Number } },
    posSales: { total: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    menubySales: { total: { type: Number, default: 0 }, count: { type: Number, default: 0 } }
  }
}, { timestamps: true });

/* Turno de una caja nativa. Es la llave de idempotencia del cierre: el POS
   reintenta hasta que confirmemos, y sin esto cada reintento crearía otro
   arqueo y el dueño vería tres cierres del mismo turno. */
cashRegisterSchema.add({
  posTurnoId: { type: String, default: undefined, trim: true, maxlength: 64 },
  // Quién contó la gaveta. Puede no ser un Admin: es el cajero del mostrador.
  cajeroNombre: { type: String, default: '', trim: true, maxlength: 80 },
  origen: { type: String, enum: ['web', 'pos-nativo'], default: 'web' },
});

cashRegisterSchema.index({ businessId: 1, status: 1 });
cashRegisterSchema.index(
  { businessId: 1, posTurnoId: 1 },
  { unique: true, partialFilterExpression: { posTurnoId: { $type: 'string' } } },
);
cashRegisterSchema.index({ businessId: 1, openedAt: -1 });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);
