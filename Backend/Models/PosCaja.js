const mongoose = require('mongoose');

/**
 * Las cajas registradoras vinculadas a un negocio.
 *
 * Existe por una sola razón: **poder matar un token desde el panel**. Un token
 * firmado es válido hasta que vence, haga lo que haga el servidor; la única
 * forma de revocarlo antes es que el servidor consulte algo en cada petición.
 * Ese algo es esta colección.
 *
 * El costo es una lectura por sincronización. Con una caja que sube cada
 * treinta segundos eso es nada, y compra algo que no se puede improvisar el día
 * que se pierda una terminal o se vaya un empleado con ella.
 */
const posCajaSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true,
  },

  /** Como la llama el dueño: "Caja principal", "Barra". */
  nombre: { type: String, required: true, trim: true, maxlength: 60 },

  /* El identificador del token (jti). No es el token: es su nombre. Guardar el
     token entero sería guardar la llave en la cerradura. */
  tokenId: { type: String, required: true, unique: true, index: true },

  revocada: { type: Boolean, default: false, index: true },
  revocadaEn: { type: Date, default: null },

  /* Cuándo habló esta caja por última vez. Es lo que le dice al dueño cuál de
     sus terminales está viva y cuál lleva tres días muda porque alguien la
     desconectó del internet. */
  ultimaVezVista: { type: Date, default: null },
  /** Qué hizo la última vez: vender, cerrar turno, bajar catálogo. */
  ultimaActividad: { type: String, default: '', trim: true, maxlength: 40 },

  vinculadaPor: { type: mongoose.Schema.Types.ObjectId, default: null },
  venceEn: { type: Date, required: true },
}, { timestamps: true });

posCajaSchema.index({ businessId: 1, revocada: 1 });

module.exports = mongoose.models.PosCaja || mongoose.model('PosCaja', posCajaSchema);
