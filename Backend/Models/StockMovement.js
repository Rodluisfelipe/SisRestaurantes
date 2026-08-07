const mongoose = require('mongoose');

/**
 * Movimiento de inventario.
 *
 * Sin esto, cuando un conteo no cuadraba no había forma de saber por qué: ni
 * quién ajustó, ni cuándo, ni de cuánto. Cada cambio de existencias deja aquí
 * su rastro, con el saldo antes y después, para poder reconstruir la historia
 * de un producto sin depender de la memoria de nadie.
 *
 * Es el cimiento del inventario: sobre esto se puede auditar, calcular consumo
 * y detectar merma. Sin esto, cualquier cosa que se construya encima es un
 * número en el que hay que creer a ciegas.
 */

const TIPOS = {
  sale: 'Venta',
  return: 'Devolución',      // pedido cancelado o línea quitada
  adjust: 'Ajuste manual',
  purchase: 'Entrada',       // compra o reposición
  waste: 'Merma',
  initial: 'Conteo inicial',
};

const stockMovementSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  // Se guarda el nombre además del id: si el producto se borra, el historial
  // sigue siendo legible en vez de quedar en un id huérfano.
  productName: { type: String, default: '' },

  type: { type: String, enum: Object.keys(TIPOS), required: true },
  /* Con signo: negativo sale, positivo entra. Guardarlo así evita tener que
     interpretar el tipo para saber la dirección al sumar. */
  quantity: { type: Number, required: true },

  stockBefore: { type: Number, default: null },
  stockAfter: { type: Number, default: null },

  // De dónde vino el movimiento
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  userName: { type: String, default: '' },
  note: { type: String, default: '', maxlength: 200 },
}, { timestamps: true });

/* Consultas del historial: por producto y por negocio, siempre lo más reciente
   primero, que es como se mira. */
stockMovementSchema.index({ businessId: 1, createdAt: -1 });
stockMovementSchema.index({ productId: 1, createdAt: -1 });

stockMovementSchema.statics.TIPOS = TIPOS;

module.exports = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
