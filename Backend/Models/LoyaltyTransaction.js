const mongoose = require('mongoose');

/**
 * El registro de cada movimiento de puntos hecho desde una caja.
 *
 * Existe por lo que encontramos auditando: `/loyalty/redeem` era un endpoint
 * público que solo pedía el teléfono del cliente. Quien supiera ese número
 * podía quemarle los puntos, y no quedaba rastro de quién lo hizo.
 *
 * Esta colección es la contraparte: **de solo agregar**, con quién cobró, en
 * qué terminal y contra qué venta. Los puntos son dinero —el cliente los
 * cambió por consumo— y el dinero que sale de algún lado sin firma es el
 * primer sitio donde mirar cuando algo no cuadra.
 *
 * Que cada redención tenga que apuntar a una venta real (`posSaleId`) es lo
 * que impide la redención al aire: no se pueden quemar puntos sin que haya un
 * cobro detrás al que el cliente asistió.
 */
const loyaltyTransactionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },

  tipo: {
    type: String,
    enum: ['REDENCION', 'ACUMULACION', 'AJUSTE'],
    required: true
  },

  /* El cliente. Se guardan las dos formas de identificarlo: el id cuando
     existe y el teléfono siempre, porque el programa de puntos lleva la cuenta
     por teléfono y un cliente puede redimir sin tener ficha creada. */
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  telefono: { type: String, required: true, trim: true, maxlength: 30 },

  /** Positivo = entraron puntos. Negativo = salieron. */
  puntos: { type: Number, required: true },

  rewardId: { type: mongoose.Schema.Types.ObjectId, default: null },
  rewardNombre: { type: String, trim: true, maxlength: 120, default: '' },

  /* ── Quién y desde dónde ───────────────────────────────────────────────

     Una redención hecha desde una caja trae las tres. Una hecha desde el menú
     web por el propio cliente no trae ninguna, y también es legítima: la
     diferencia se ve en `origen`. */
  origen: {
    type: String,
    enum: ['pos', 'menu', 'panel'],
    default: 'menu',
    index: true
  },
  /* La terminal, identificada por el jti de su token. No por su _id: el
     token es lo único que la petición trae consigo, y resolver el _id
     costaría una consulta más en cada canje para guardar el mismo dato.
     `PosCaja` se encuentra por `tokenId`, que ya está indexado. */
  cajaTokenId: { type: String, trim: true, maxlength: 64, default: '' },
  cajaNombre: { type: String, trim: true, maxlength: 80, default: '' },
  /** El nombre del cajero que la procesó, tal como lo manda la terminal. */
  autorizadoPor: { type: String, trim: true, maxlength: 80, default: '' },

  /* La venta contra la que se redimió. Es la llave de idempotencia: la cola de
     la caja reintenta hasta que confirmemos, y sin esto un reintento
     descontaría los puntos dos veces. */
  posSaleId: { type: String, trim: true, maxlength: 64, default: '' },

  /** Cuántos puntos le quedaron al cliente después de esto. */
  saldoResultante: { type: Number, default: 0 }
}, { timestamps: true });

/* Único por venta y recompensa: dos reintentos de la misma redención son uno
   solo. Parcial porque las redenciones del menú web no traen `posSaleId`. */
loyaltyTransactionSchema.index(
  { businessId: 1, posSaleId: 1, rewardId: 1 },
  { unique: true, partialFilterExpression: { posSaleId: { $gt: '' } } }
);

// Para el informe: los movimientos de un cliente, y los de un turno.
loyaltyTransactionSchema.index({ businessId: 1, telefono: 1, createdAt: -1 });

module.exports =
  mongoose.models.LoyaltyTransaction ||
  mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
