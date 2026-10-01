const mongoose = require('mongoose');

/**
 * Un canje de un beneficio. Se pide desde la app o desde la página del
 * beneficio con el código del domi, y queda en firme cuando el domi lo
 * confirma con el enlace que le llega al correo.
 */
const canjeSchema = new mongoose.Schema({
  beneficioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficio', required: true, index: true },
  telefono: { type: String, required: true, index: true },
  codigoDomi: { type: String, required: true },
  email: { type: String, required: true },
  origen: { type: String, enum: ['app', 'web'], default: 'app' },
  estado: { type: String, enum: ['pendiente', 'confirmado'], default: 'pendiente', index: true },
  // Hash del token del enlace del correo
  tokenHash: { type: String, required: true, index: true },
  venceAt: { type: Date, required: true },
  // Código del canje, para mostrar al aliado
  comprobante: { type: String, default: null },
  confirmadoAt: { type: Date, default: null },
}, { timestamps: true });

canjeSchema.index({ beneficioId: 1, telefono: 1, estado: 1 });

module.exports = mongoose.model('CanjeBeneficio', canjeSchema);
