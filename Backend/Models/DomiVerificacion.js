const mongoose = require('mongoose');

/**
 * Código de verificación por WhatsApp para registrarse como domi.
 *
 * Solo se guarda el hash del código. Caduca a los 10 minutos (índice TTL),
 * admite 5 intentos y no se puede pedir otro antes de 60 s: sin eso, un
 * código de 6 números se adivina o se usa para bombardear un celular ajeno.
 */
const domiVerificacionSchema = new mongoose.Schema({
  telefono: { type: String, required: true, index: true },
  // A dónde se mandó el código (por ahora, correo)
  email: { type: String, lowercase: true, trim: true },
  codigoHash: { type: String, required: true },
  intentos: { type: Number, default: 0 },
  enviadoAt: { type: Date, default: Date.now },
  venceAt: { type: Date, required: true },
}, { timestamps: false });

domiVerificacionSchema.index({ venceAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DomiVerificacion', domiVerificacionSchema);
