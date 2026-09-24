const mongoose = require('mongoose');

/**
 * A quién le compra el negocio: la distribuidora de carnes, el de las
 * gaseosas, la panadería del pan de hamburguesa.
 *
 * Distinto de SupplierOrder, que son pedidos entre negocios de MenuBy. Aquí
 * cabe cualquier proveedor, esté o no en la plataforma.
 */
const proveedorSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 80 },
  nit: { type: String, default: '', trim: true, maxlength: 30 },
  telefono: { type: String, default: '', trim: true, maxlength: 30 },
  contacto: { type: String, default: '', trim: true, maxlength: 80 },
  email: { type: String, default: '', trim: true, maxlength: 120 },
  notas: { type: String, default: '', trim: true, maxlength: 300 },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Proveedor', proveedorSchema);
