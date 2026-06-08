/**
 * CrewRechargeRequest — solicitud de recarga de saldo Crew para un negocio.
 *
 * Flujo (mismo patrón que PaymentRequest de suscripciones):
 *   1. Negocio elige monto, paga a la llave Breve/Nequi externamente
 *      y sube comprobante → status='pending'.
 *   2. SuperAdmin revisa el comprobante y aprueba → se acredita el saldo
 *      vía crewLedger.depositBusinessWallet (con idempotencyKey =
 *      `crew_recharge:<requestId>` para no doble-acreditar si reabren).
 *   3. Si rechaza → status='rejected', no se acredita nada.
 *
 * El monto va directo al `crewWallet.balance` del negocio. Sin bonos por ahora —
 * podemos agregar después una matriz de "carga X, recibe X + Y%".
 */
const mongoose = require('mongoose');

const crewRechargeRequestSchema = new mongoose.Schema({
  // Owner polimórfico — un negocio MenuBy O un empleador Crew externo.
  // Para retrocompatibilidad businessId queda no requerido (default null) y
  // ownerType default 'business' aplica al caso legacy.
  ownerType: { type: String, enum: ['business', 'crew_employer'], default: 'business', index: true },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    default: null,
    index: true,
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrewEmployer',
    default: null,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'COP', enum: ['COP'] },

  paymentMethod: {
    type: String,
    required: true,
    enum: ['Nequi', 'Daviplata', 'Breve', 'Transferencia', 'OTHER'],
  },
  proofUrl: { type: String, required: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },

  // Una vez aprobado, guardamos el txnId del ledger para trazabilidad cruzada
  walletTxnId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrewWalletTxn', default: null },

  notes: { type: String, default: '' },
}, { timestamps: true });

crewRechargeRequestSchema.pre('validate', function (next) {
  if (this.ownerType === 'business' && !this.businessId) {
    return next(new Error('ownerType=business requiere businessId'));
  }
  if (this.ownerType === 'crew_employer' && !this.employerId) {
    return next(new Error('ownerType=crew_employer requiere employerId'));
  }
  next();
});

crewRechargeRequestSchema.index({ status: 1, createdAt: -1 });
crewRechargeRequestSchema.index({ businessId: 1, status: 1 });
crewRechargeRequestSchema.index({ employerId: 1, status: 1 });

module.exports = mongoose.models.CrewRechargeRequest
  || mongoose.model('CrewRechargeRequest', crewRechargeRequestSchema);
