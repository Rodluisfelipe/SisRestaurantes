const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Un cliente de una empresa de reparto: la tienda, el restaurante o la
 * persona a la que la empresa le hace envíos por fuera de MenuBy. La empresa
 * lo crea desde su portal y le da usuario y clave; con eso entra a la página
 * de la empresa y pide sus domis.
 */
const clienteEmpresaSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 80 },
  negocio: { type: String, trim: true, maxlength: 80, default: '' },
  // Con qué entra: su celular (10 dígitos) o su correo
  telefono: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  claveHash: { type: String, required: true },
  // Desde dónde suele despachar (se propone como recogida)
  direccion: { type: String, trim: true, maxlength: 160, default: '' },
  ubicacion: { lat: Number, lng: Number },
  notas: { type: String, maxlength: 300, default: '' },
  activo: { type: Boolean, default: true },
  totalEnvios: { type: Number, default: 0 },
  refreshHash: { type: String, default: null },
}, { timestamps: true });

clienteEmpresaSchema.index({ partnerId: 1, telefono: 1 }, { unique: true, partialFilterExpression: { telefono: { $gt: '' } } });
clienteEmpresaSchema.index({ partnerId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $gt: '' } } });

clienteEmpresaSchema.methods.ponerClave = async function (clave) {
  this.claveHash = await bcrypt.hash(String(clave), 10);
};
clienteEmpresaSchema.methods.verificarClave = function (clave) {
  return bcrypt.compare(String(clave || ''), this.claveHash || '');
};

module.exports = mongoose.model('ClienteEmpresa', clienteEmpresaSchema);
