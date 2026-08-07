const mongoose = require('mongoose');

/**
 * Insumo — lo que el negocio compra, no lo que vende.
 *
 * Un restaurante no controla "hamburguesas": controla pan, carne y queso. Con
 * el inventario básico, vender una hamburguesa descontaba una unidad de un
 * contador llamado "hamburguesa", que no existe en ninguna nevera. Aquí se
 * controla lo que de verdad se agota.
 *
 * Un insumo se enlaza a los productos por receta (Product.recipe), y al vender
 * se descuenta según lo que ese plato consume.
 */

/* Unidades de medida. Se guardan como texto corto y no como enumeración
   cerrada de laboratorio: un negocio piensa en "gramos" y "unidades", no en
   sistemas de conversión. La conversión entre unidades se deja fuera a
   propósito — es donde estos módulos se vuelven inmanejables. */
const UNIDADES = {
  u: 'unidad',
  g: 'gramo',
  kg: 'kilo',
  ml: 'mililitro',
  l: 'litro',
  porcion: 'porción',
};

const supplySchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },

  name: { type: String, required: true, trim: true, maxlength: 80 },
  unit: { type: String, enum: Object.keys(UNIDADES), default: 'u' },

  stock: { type: Number, default: 0 },
  // Costo por unidad de medida: si la unidad es gramo, es el costo del gramo
  cost: { type: Number, default: null },
  lowStockAlert: { type: Number, default: 0 },

  supplier: { type: String, trim: true, default: '', maxlength: 80 },
  note: { type: String, trim: true, default: '', maxlength: 200 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

supplySchema.index({ businessId: 1, name: 1 });

supplySchema.statics.UNIDADES = UNIDADES;

module.exports = mongoose.models.Supply || mongoose.model('Supply', supplySchema);
