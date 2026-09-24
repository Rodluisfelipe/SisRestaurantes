const mongoose = require('mongoose');

/**
 * Un corte Z de una caja: el cierre del día, numerado.
 *
 * Se guarda el informe tal como lo calculó la caja —que es donde están todas
 * las ventas, incluidas las que se hicieron sin internet— y no se recalcula:
 * un Z es un documento, no una consulta.
 */
const posCorteZSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  /* La caja que lo sacó. El número es consecutivo **por caja**: dos cajas
     tienen cada una su Z #1. */
  cajaTokenId: { type: String, required: true },
  cajaNombre: { type: String, default: '' },
  numero: { type: Number, required: true },
  desde: { type: String, default: '' },
  hasta: { type: String, default: '' },
  cajero: { type: String, default: '' },
  ventas: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  informe: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

// Idempotencia: la cola reintenta hasta que confirmemos.
posCorteZSchema.index({ businessId: 1, cajaTokenId: 1, numero: 1 }, { unique: true });
posCorteZSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('PosCorteZ', posCorteZSchema);
