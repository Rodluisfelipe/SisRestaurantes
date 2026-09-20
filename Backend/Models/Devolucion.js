const mongoose = require('mongoose');

/**
 * Devoluciones y cambios.
 *
 * En un restaurante un pedido se cancela y ya está. En una tienda no: la
 * camiseta llegó en M y la querían en L, el perfume vino roto, el color no era
 * el de la foto. Eso no es cancelar una venta, es una operación aparte que
 * mueve inventario en las dos direcciones y a veces plata.
 *
 * Sin esto, el negocio lo resolvía por WhatsApp y el inventario quedaba
 * mintiendo: la talla devuelta nunca volvía a estar disponible y la que se
 * llevaban en su lugar seguía figurando en bodega.
 *
 * La línea guarda su propia copia del nombre, el precio y la variante: si el
 * producto cambia de precio o el negocio borra una talla, la devolución debe
 * seguir contando lo que de verdad pasó ese día.
 */

const LineaSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  variante: {
    valores: [{ type: String, trim: true, maxlength: 40 }],
    sku: { type: String, trim: true, maxlength: 40, default: '' },
  },
  quantity: { type: Number, required: true, min: 1, max: 999 },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

/* Por qué la devuelven. No es curiosidad: "talla equivocada" se arregla con
   otra talla, "llegó defectuoso" es plata de vuelta y un problema con el
   proveedor. Saber cuál pesa más es lo que deja mejorar algo. */
const MOTIVOS = ['talla', 'defecto', 'no_era_lo_esperado', 'llego_tarde', 'arrepentimiento', 'otro'];

/* pendiente: el cliente avisó, el producto todavía no llegó.
   recibida:  ya está en la tienda — aquí, y solo aquí, vuelve al inventario.
   resuelta:  se devolvió la plata o se entregó el cambio.
   rechazada: no aplicaba (fuera de plazo, usado, sin factura). */
const ESTADOS = ['pendiente', 'recibida', 'resuelta', 'rechazada'];

const devolucionSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },

  /* El pedido puede estar en Order o ya archivado en CompletedOrder, así que
     se guarda el id suelto y además el número, que es lo que el negocio y el
     cliente usan para hablar del pedido. */
  orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  orderNumber: { type: String, default: '', trim: true, maxlength: 40 },

  tipo: { type: String, enum: ['devolucion', 'cambio'], required: true },
  estado: { type: String, enum: ESTADOS, default: 'pendiente', index: true },
  motivo: { type: String, enum: MOTIVOS, default: 'otro' },
  nota: { type: String, default: '', trim: true, maxlength: 500 },

  // Lo que devuelve el cliente.
  items: { type: [LineaSchema], default: [] },
  // Solo en los cambios: lo que se lleva a cambio.
  cambioPor: { type: [LineaSchema], default: [] },

  /* Plata. En una devolución es lo que se le regresa al cliente; en un cambio,
     la diferencia (positiva si el cliente paga más, negativa si se le devuelve). */
  montoDevuelto: { type: Number, default: 0 },
  diferencia: { type: Number, default: 0 },

  /* Si el producto vuelve a estar a la venta. Un defectuoso se recibe pero no
     se repone: contarlo como disponible es venderlo otra vez roto. */
  reingresaStock: { type: Boolean, default: true },
  // Se pone en true cuando el inventario ya se movió, para no moverlo dos veces.
  stockMovido: { type: Boolean, default: false },

  customerName: { type: String, default: '', trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },

  // Quién la registró, para poder preguntarle después.
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userName: { type: String, default: '', trim: true, maxlength: 120 },

  recibidaAt: { type: Date, default: null },
  resueltaAt: { type: Date, default: null },
}, { timestamps: true });

devolucionSchema.index({ businessId: 1, createdAt: -1 });
devolucionSchema.index({ businessId: 1, orderId: 1 });

/** Lo que vale lo devuelto, para no recalcularlo en cada pantalla. */
devolucionSchema.methods.valorDevuelto = function () {
  return (this.items || []).reduce((t, i) => t + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
};

devolucionSchema.statics.MOTIVOS = MOTIVOS;
devolucionSchema.statics.ESTADOS = ESTADOS;

module.exports = mongoose.models.Devolucion || mongoose.model('Devolucion', devolucionSchema);
