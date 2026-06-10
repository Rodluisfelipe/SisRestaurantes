/**
 * CrewWalletTxn — ledger inmutable de todos los movimientos de plata dentro
 * del marketplace Crew.
 *
 * Regla #1: cada cambio de saldo (worker o business) DEBE escribir una
 * entrada acá. Si el balance cambia sin ledger, perdimos auditoría.
 *
 * `actorType` define a quién pertenece la billetera afectada:
 *   - 'business' → BusinessConfig.crewWallet
 *   - 'worker'   → Worker.wallet
 *   - 'platform' → ingresos/egresos propios de Crew (comisiones, ajustes)
 *
 * `kind` describe la naturaleza del movimiento (ver enum).
 *
 * Convención de signos:
 *   - `amount` siempre positivo
 *   - `direction = 'in'`  → entra plata a la billetera del actor
 *   - `direction = 'out'` → sale plata de la billetera del actor
 */
const mongoose = require('mongoose');

const TXN_KINDS = [
  'deposit',              // negocio recarga su billetera Crew
  'shift_reserve',        // se mueve de balance → pendingBalance al publicar un turno
  'shift_release',        // pendingBalance del negocio → wallet del worker (turno completado)
  'shift_commission',     // pendingBalance del negocio → plataforma (comisión Crew)
  'shift_refund',         // pendingBalance del negocio → balance del negocio (cancelación con devolución)
  'cancellation_penalty', // pendingBalance del negocio → plataforma (no se devuelve nada)
  'vacancy_post',         // negocio paga fee fijo por publicar una vacante (balance → plataforma)
  'vacancy_refund',       // se devuelve el fee de vacante (caso especial: republicar fallida, refund manual)
  'withdrawal_request',   // worker pide retirar — bloquea saldo (balance → pendingBalance)
  'withdrawal_paid',      // pago efectivo a worker fuera del sistema (pendingBalance → 0)
  'withdrawal_rejected',  // retiro rechazado, regresa a balance
  'adjustment',           // ajuste manual por SuperAdmin (con motivo obligatorio)
];

const crewWalletTxnSchema = new mongoose.Schema({
  // Tipos de actor:
  //   - 'business'      → BusinessConfig (negocio MenuBy)
  //   - 'crew_employer' → CrewEmployer (empleador externo de Crew)
  //   - 'worker'        → Worker
  //   - 'platform'      → Crew como entidad (comisiones)
  actorType: { type: String, enum: ['business', 'crew_employer', 'worker', 'platform'], required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // referencia heterogénea
  counterpartType: { type: String, enum: ['business', 'crew_employer', 'worker', 'platform', 'external'], default: null },
  counterpartId: { type: mongoose.Schema.Types.ObjectId, default: null },

  kind: { type: String, enum: TXN_KINDS, required: true, index: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'COP' },

  // Saldos post-operación (snapshot — útil para extractos sin reconstruir desde cero)
  balanceAfter: { type: Number, default: null },
  pendingAfter: { type: Number, default: null },

  // Trazabilidad
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftPost', default: null, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftBooking', default: null, index: true },
  withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: 'CrewWithdrawalRequest', default: null },

  // Idempotencia: si recibimos el mismo recargo dos veces, no debemos duplicar.
  // Para depósitos viene del provider de pago; para shift_* usamos shiftId+kind como key.
  // El índice único sparse va más abajo (no duplicar acá con `index: true`).
  idempotencyKey: { type: String, default: null },

  // Notas humanas
  note: { type: String, maxlength: 300, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Quién originó el movimiento (admin/SuperAdmin para ajustes)
  performedBy: {
    kind: { type: String, enum: ['system', 'admin', 'superadmin', 'worker', 'business'], default: 'system' },
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
}, { timestamps: true });

crewWalletTxnSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
crewWalletTxnSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.CrewWalletTxn || mongoose.model('CrewWalletTxn', crewWalletTxnSchema);
module.exports.TXN_KINDS = TXN_KINDS;
