const mongoose = require('mongoose');

/**
 * Un movimiento de la cuenta de crédito de un cliente: lo que se le fió
 * (cargo) o lo que pagó (abono).
 *
 * El saldo del cliente vive en `Customer.credito.saldo` para leerlo rápido; la
 * verdad es la suma de estos movimientos, y cada uno dice de dónde salió —qué
 * venta, qué abono, qué caja, quién—.
 */
const creditoMovimientoSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  tipo: { type: String, enum: ['cargo', 'abono'], required: true },
  monto: { type: Number, required: true, min: 0 },
  saldoDespues: { type: Number, default: 0 },
  /* La llave de idempotencia: el id de la venta o del abono en la caja, o el
     del abono hecho en el panel. La cola reintenta; esto evita cobrar dos
     veces el mismo fiado. */
  origenId: { type: String, required: true },
  origen: { type: String, enum: ['caja', 'panel'], default: 'caja' },
  medio: { type: String, default: '' },
  referencia: { type: String, default: '' },
  usuario: { type: String, default: '' },
  nota: { type: String, default: '', maxlength: 200 },
  fecha: { type: Date, default: Date.now },
}, { timestamps: true });

creditoMovimientoSchema.index({ businessId: 1, origenId: 1 }, { unique: true });
creditoMovimientoSchema.index({ businessId: 1, customerId: 1, fecha: -1 });

module.exports = mongoose.model('CreditoMovimiento', creditoMovimientoSchema);
