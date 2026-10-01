const mongoose = require('mongoose');

/**
 * Cada cosa que hizo el domi desde la app ("llegué", "recogí", "entregué"),
 * con el id que le puso el celular.
 *
 * Sin señal, el celular guarda los eventos y los reenvía hasta que el servidor
 * confirme. Ese id es lo que impide que un reenvío entregue dos veces o gaste
 * dos intentos del código: si ya se procesó, se devuelve el mismo resultado.
 */
const domiEventoSchema = new mongoose.Schema({
  eventoId: { type: String, required: true, unique: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPerson', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig' },
  tipo: { type: String, required: true },
  // Hora en que pasó según el celular (puede llegar horas después)
  ocurrioAt: { type: Date, required: true },
  ubicacion: { lat: Number, lng: Number },
  // Lo que se le respondió, tal cual, para devolverlo igual en un reenvío
  resultado: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('DomiEvento', domiEventoSchema);
