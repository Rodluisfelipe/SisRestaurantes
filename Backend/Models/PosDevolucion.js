const mongoose = require('mongoose');

/**
 * Una devolución hecha en el mostrador, desde la caja nativa.
 *
 * **No modifica la venta original.** Es un registro aparte que la referencia,
 * y esa es la diferencia entre contabilidad y datos que se pueden alterar: si
 * devolver editara la venta, el día en que se cobró cambiaría cada vez que
 * alguien devuelve algo de ayer, y ningún informe cerrado volvería a cuadrar.
 *
 * Lo que sí cambia es el inventario, que sube de nuevo: eso lo hace la ruta con
 * la misma función que usa el resto del sistema.
 */
const posDevolucionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },

  /* Id que generó la caja (UUIDv7). Es la llave de idempotencia: la cola
     reintenta hasta que le confirmemos, y sin esto una devolución reintentada
     sumaría el inventario dos veces. */
  posRefundId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 64
  },

  /* La venta de la caja que se está devolviendo. Se guarda aunque no
     encontremos la orden: la venta pudo hacerse en otra terminal o seguir en
     su propia cola, y la devolución no puede esperar por eso. */
  posSaleId: { type: String, trim: true, maxlength: 64 },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompletedOrder',
    default: null
  },
  orderNumber: { type: Number, default: 0 },

  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    variante: {
      valores: [{ type: String, trim: true, maxlength: 40 }],
      sku: { type: String, trim: true, maxlength: 40, default: '' }
    }
  }],

  total: { type: Number, required: true, min: 0 },

  /* Cómo salió la plata. En efectivo salió de la gaveta —y el arqueo de ese
     turno ya lo restó—; por datáfono la reversa la hizo el banco. */
  medio: { type: String, trim: true, maxlength: 30, default: 'efectivo' },

  motivo: { type: String, trim: true, maxlength: 200, required: true },

  /* Quién la hizo y quién la autorizó. Una devolución sin nombre encima es una
     salida de efectivo que nadie firmó. */
  cajero: { type: String, trim: true, maxlength: 80, default: '' },
  autorizo: { type: String, trim: true, maxlength: 80, required: true },

  turnoId: { type: String, trim: true, maxlength: 64, default: '' }
}, { timestamps: true });

/* Único por negocio, no global: dos cajas de negocios distintos pueden —en
   teoría— generar el mismo id, y bloquear la segunda dejaría una devolución
   sin registrar. Parcial porque el campo es la llave y tiene que existir. */
posDevolucionSchema.index(
  { businessId: 1, posRefundId: 1 },
  { unique: true, partialFilterExpression: { posRefundId: { $type: 'string' } } }
);

// Para el listado del panel: las de un turno, y las de una venta.
posDevolucionSchema.index({ businessId: 1, turnoId: 1 });
posDevolucionSchema.index({ businessId: 1, posSaleId: 1 });

module.exports = mongoose.model('PosDevolucion', posDevolucionSchema);
