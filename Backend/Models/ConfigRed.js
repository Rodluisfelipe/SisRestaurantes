const mongoose = require('mongoose');

/**
 * La configuración de la Red MenuBy (domis independientes): la tarifa y si
 * está lloviendo. Un solo documento, lo edita el superadmin.
 *
 * La tarifa se guarda tal como la escribió; utils/tarifaRed la normaliza al
 * usarla, así un valor absurdo nunca llega a pagarle mal a nadie.
 */
const configRedSchema = new mongoose.Schema({
  clave: { type: String, default: 'red', unique: true },
  tarifa: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Recargo por lluvia encendido a mano; se apaga solo a la hora indicada
  lluviaHasta: { type: Date, default: null },
  actualizadoPor: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ConfigRed', configRedSchema);
