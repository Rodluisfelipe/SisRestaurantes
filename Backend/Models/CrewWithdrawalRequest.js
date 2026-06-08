/**
 * CrewWithdrawalRequest — solicitud de retiro de un worker hacia su método
 * de pago externo (Nequi, Daviplata, cuenta bancaria).
 *
 * Flujo:
 *   1. Worker pide retiro → status='pending', se bloquea el monto
 *      (wallet.balance → wallet.pendingBalance) y se crea CrewWalletTxn 'withdrawal_request'.
 *   2. SuperAdmin lo paga manualmente fuera de la app (Nequi, transferencia).
 *   3. SuperAdmin marca 'paid' → wallet.pendingBalance → 0,
 *      se crea CrewWalletTxn 'withdrawal_paid'.
 *   4. Si rechaza → status='rejected', dinero regresa a balance,
 *      se crea CrewWalletTxn 'withdrawal_rejected' con motivo.
 */
const mongoose = require('mongoose');

const crewWithdrawalRequestSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'COP' },

  // Datos del destino (snapshot — el worker puede cambiar su método después)
  payoutMethod: {
    type: { type: String, enum: ['nequi', 'daviplata', 'bancolombia', 'transfer'], required: true },
    accountInfo: { type: String, required: true }, // número de cuenta/teléfono
    holderName: { type: String, default: '' },
    holderCedula: { type: String, default: '' },
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'rejected'],
    default: 'pending',
    index: true,
  },

  // Resolución
  paidAt: { type: Date, default: null },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  externalReference: { type: String, default: null }, // # de comprobante Nequi/transferencia
  rejectionReason: { type: String, default: null },

  // Notas internas SuperAdmin
  internalNote: { type: String, maxlength: 300, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.CrewWithdrawalRequest || mongoose.model('CrewWithdrawalRequest', crewWithdrawalRequestSchema);
