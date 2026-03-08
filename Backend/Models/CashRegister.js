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
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
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

cashRegisterSchema.index({ businessId: 1, status: 1 });
cashRegisterSchema.index({ businessId: 1, openedAt: -1 });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);
