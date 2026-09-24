const mongoose = require('mongoose');

/**
 * Una compra recibida: qué llegó, de quién, a qué costo, y cuánto se le debe.
 *
 * Registrarla mete la mercancía al inventario (con su movimiento en el
 * kardex) y deja el costo de cada cosa al día, que es lo que alimenta la
 * rentabilidad. Lo que no se pagó de contado queda por pagar.
 */
const lineaSchema = new mongoose.Schema({
  _id: false,
  tipo: { type: String, enum: ['insumo', 'producto'], required: true },
  refId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nombre: { type: String, required: true },
  unidad: { type: String, default: '' },
  cantidad: { type: Number, required: true, min: 0 },
  costoUnitario: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
});

const pagoSchema = new mongoose.Schema({
  _id: false,
  monto: { type: Number, required: true, min: 0 },
  medio: { type: String, default: 'efectivo' },
  nota: { type: String, default: '' },
  usuario: { type: String, default: '' },
  fecha: { type: Date, default: Date.now },
});

const compraSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  proveedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor', required: true },
  proveedorNombre: { type: String, default: '' },
  factura: { type: String, default: '', trim: true, maxlength: 40 },
  fecha: { type: Date, default: Date.now },
  lineas: { type: [lineaSchema], validate: (v) => v.length > 0 },
  total: { type: Number, required: true, min: 0 },
  pagos: [pagoSchema],
  pagado: { type: Number, default: 0 },
  saldo: { type: Number, default: 0 },
  notas: { type: String, default: '', maxlength: 300 },
  usuario: { type: String, default: '' },
}, { timestamps: true });

compraSchema.index({ businessId: 1, fecha: -1 });
compraSchema.index({ businessId: 1, saldo: 1 });

module.exports = mongoose.model('Compra', compraSchema);
