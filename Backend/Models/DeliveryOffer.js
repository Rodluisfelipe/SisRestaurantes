const mongoose = require('mongoose');

/**
 * DeliveryOffer — a time-boxed, exclusive offer of a delivery to one driver.
 *
 * The offer lifecycle is the heart of Phase C:
 *   pending → accepted            (driver takes it)
 *   pending → rejected            (driver declines → re-offer to next)
 *   pending → expired             (no response in time → re-offer to next)
 *   pending → superseded          (delivery got assigned another way / cancelled)
 *
 * A background sweeper expires stale pending offers and re-offers automatically.
 */
const deliveryOfferSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: function () { return !this.envioId; }, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: function () { return !this.envioId; }, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: function () { return !this.envioId; }, index: true },
  // Envío de una empresa de reparto a sus propios clientes (no es un pedido de MenuBy)
  envioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Envio', default: undefined, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', required: true, index: true },

  state: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'superseded'], default: 'pending', index: true },
  // El negocio volvió a pedir "al más cercano": esta oferta perdida ya no lo deja por fuera
  liberadaAt: { type: Date, default: null },
  attempt: { type: Number, default: 1 },       // nth offer for this delivery
  distanceKm: { type: Number, default: null },
  // Red MenuBy: la tarifa calculada al ofrecer, que se congela al aceptar
  tarifa: { type: mongoose.Schema.Types.Mixed, default: undefined },

  offeredAt: { type: Date, default: Date.now },
  // La app del domi la recibió (la mostró). Una oferta que vence sin que la
  // haya visto no cuenta en su contra: pudo ser falla de señal o nuestra.
  vistaAt: { type: Date, default: null },
  // Se aceptó sola (aceptación automática del domi)
  automatica: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

// Fast sweep of pending offers past their expiry
deliveryOfferSchema.index({ state: 1, expiresAt: 1 });

/* Una oferta que deja de estar pendiente (la tomó otro, venció, la quitó el
   negocio) cuelga la llamada en el celular del domi. Va en el modelo y no en
   cada servicio para que ningún camino se lo salte. Nunca frena la operación. */
function colgar(ofertas) {
  if (!ofertas || !ofertas.length) return;
  setImmediate(() => {
    require('../services/fcmService').colgarOfertas(ofertas).catch(() => {});
  });
}

deliveryOfferSchema.pre('save', function marcarColgar() {
  this.$locals.colgar = !this.isNew && this.isModified('state') && this.state !== 'pending';
});

deliveryOfferSchema.post('save', function colgarAlGuardar(doc) {
  if (doc.$locals.colgar) colgar([{ _id: doc._id, driverId: doc.driverId }]);
});

deliveryOfferSchema.pre('updateMany', async function buscarPorColgar() {
  const u = this.getUpdate() || {};
  const estado = (u.$set && u.$set.state) || u.state;
  if (!estado || estado === 'pending') return;
  this._porColgar = await this.model.find({ ...this.getFilter(), state: 'pending' }).select('_id driverId').lean();
});

deliveryOfferSchema.post('updateMany', function colgarVarias() {
  colgar(this._porColgar);
});

module.exports = mongoose.model('DeliveryOffer', deliveryOfferSchema);
