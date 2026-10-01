const mongoose = require('mongoose');

/**
 * Un cuadre cerrado entre el negocio y un domi: "me entregó $43.000 del
 * efectivo de estas 6 entregas, ya descontado lo suyo".
 *
 * Las entregas que entran aquí dejan de salir como pendientes en la app del
 * domi y en el panel. Los montos se guardan tal como se calcularon ese día:
 * si luego cambia la regla de pago, el cuadre viejo no se mueve.
 */
const domiLiquidacionSchema = new mongoose.Schema({
  // Un negocio de MenuBy liquida sus pedidos; una empresa de reparto, sus envíos
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: function () { return !this.partnerId; }, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', default: undefined, index: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', required: true, index: true },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId }],
  entregas: { type: Number, default: 0 },
  efectivo: { type: Number, default: 0 },
  ganancias: { type: Number, default: 0 },
  // efectivo − ganancias: > 0 lo entregó el domi, < 0 se lo pagó el negocio
  neto: { type: Number, default: 0 },
  nota: { type: String, default: '', maxlength: 200 },
  creadoPor: { type: String, default: '' },
}, { timestamps: true });

domiLiquidacionSchema.index({ driverId: 1, createdAt: -1 });
domiLiquidacionSchema.index({ businessId: 1, orderIds: 1 });

module.exports = mongoose.model('DomiLiquidacion', domiLiquidacionSchema);
