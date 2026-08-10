/**
 * El cambio que espera un "sí".
 *
 * Va a la base y no a memoria a propósito: el servidor se despliega en azul y
 * verde, así que entre la pregunta y la respuesta el proceso puede ser otro.
 * En memoria, el "sí" del dueño llegaría a un servidor que no recuerda nada y
 * el cambio se perdería sin decir por qué.
 *
 * Caduca a los cinco minutos. Un "sí" suelto media hora después no puede
 * agotar un producto que nadie recordaba haber nombrado.
 */
const mongoose = require('mongoose');

const VIGENCIA_MS = 5 * 60 * 1000;

const esquema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  contactPhone: { type: String, required: true, trim: true },
  accion: { type: mongoose.Schema.Types.Mixed, required: true },
  creadoEn: { type: Date, default: Date.now },
}, { timestamps: true });

esquema.index({ businessId: 1, contactPhone: 1 }, { unique: true });
/* Mongo lo borra solo pasada la vigencia: sin esto quedarían confirmaciones
   muertas acumulándose para siempre. */
esquema.index({ creadoEn: 1 }, { expireAfterSeconds: VIGENCIA_MS / 1000 });

const AccionPendiente = mongoose.models.WhatsAppAccionPendiente
  || mongoose.model('WhatsAppAccionPendiente', esquema);

async function guardar(businessId, contactPhone, accion) {
  await AccionPendiente.findOneAndUpdate(
    { businessId, contactPhone },
    { $set: { accion, creadoEn: new Date() } },
    { upsert: true },
  );
}

async function leer(businessId, contactPhone) {
  const doc = await AccionPendiente.findOne({ businessId, contactPhone }).lean();
  if (!doc) return null;

  /* El índice de caducidad de Mongo pasa cada minuto, así que puede devolver
     uno recién vencido. Se comprueba también acá. */
  if (Date.now() - new Date(doc.creadoEn).getTime() > VIGENCIA_MS) {
    await borrar(businessId, contactPhone);
    return null;
  }
  return doc.accion;
}

async function borrar(businessId, contactPhone) {
  await AccionPendiente.deleteOne({ businessId, contactPhone });
}

module.exports = { guardar, leer, borrar, VIGENCIA_MS, AccionPendiente };
