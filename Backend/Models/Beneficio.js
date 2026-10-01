const mongoose = require('mongoose');

/**
 * Un beneficio para los domiciliarios (descuentos, convenios…). Lo crea el
 * superadmin; los domis lo ven en la app y lo canjean con su código único.
 * El enlace lleva a la página del beneficio (la del aliado o una propia).
 */
const beneficioSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true, maxlength: 80 },
  descripcion: { type: String, trim: true, maxlength: 600, default: '' },
  enlace: { type: String, trim: true, maxlength: 500, default: '' },
  imagen: { type: String, default: null },
  activo: { type: Boolean, default: true, index: true },
  creadoPor: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Beneficio', beneficioSchema);
