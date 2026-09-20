const mongoose = require('mongoose');

/**
 * Excepciones de una caja: anulaciones, descuentos a mano y aperturas de cajón.
 *
 * No va en `AuditLog` porque eso registra quién editó un producto o una
 * categoría desde el panel. Esto es otra cosa: lo que pasa en el mostrador con
 * un cliente al frente, y lo que el dueño mira cuando la caja no cuadra.
 *
 * Las tres columnas que le dan sentido son `cajero`, `autorizo` y `motivo`.
 * Sin las tres, un patrón como "el cajero A anuló ocho cafés el martes, todos
 * autorizados por el supervisor B a las tres de la tarde" es invisible.
 *
 * Llega por la cola del POS, así que puede aparecer dos días tarde si esa caja
 * estuvo sin internet: la fecha que vale es `ocurridaEn`, la del mostrador.
 */
const posExcepcionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true,
  },

  /* Id que generó la caja (UUIDv7). Llave de idempotencia: el POS reintenta
     hasta que confirmemos, y sin esto cada reintento duplicaría la anulación
     en los informes del dueño. */
  posExcepcionId: { type: String, required: true, trim: true, maxlength: 64 },
  turnoId: { type: String, default: '', trim: true, maxlength: 64 },

  tipo: {
    type: String,
    enum: ['anular_item', 'descuento', 'abrir_cajon', 'descartar_pausada'],
    required: true,
    index: true,
  },

  /** Qué se anuló o sobre qué se aplicó el descuento. */
  detalle: { type: String, default: '', trim: true, maxlength: 200 },
  /** Cuánta plata dejó de cobrarse. */
  monto: { type: Number, default: 0 },
  motivo: { type: String, default: '', trim: true, maxlength: 200 },

  /** Quién tenía la caja. */
  cajero: { type: String, default: '', trim: true, maxlength: 80, index: true },
  /** Quién lo autorizó con su PIN. Vacío en lo que no requiere autorización. */
  autorizo: { type: String, default: '', trim: true, maxlength: 80 },

  /** La hora del mostrador, no la del servidor. */
  ocurridaEn: { type: Date, required: true },
}, { timestamps: true });

posExcepcionSchema.index({ businessId: 1, ocurridaEn: -1 });
posExcepcionSchema.index({ businessId: 1, posExcepcionId: 1 }, { unique: true });

module.exports = mongoose.models.PosExcepcion || mongoose.model('PosExcepcion', posExcepcionSchema);
