const mongoose = require('mongoose');

/**
 * El código con el que una caja se vincula a un negocio.
 *
 * Reemplaza al flujo anterior —copiar un JWT desde las herramientas del
 * navegador—, que funcionaba pero solo para quien ya sabía qué es un JWT. Esto
 * lo hace el dueño del negocio: en el panel le da a "Vincular caja", sale un
 * código de ocho caracteres, lo dicta por teléfono si hace falta, y el cajero
 * lo escribe en la terminal. Como emparejar un televisor.
 *
 * Tres propiedades que lo hacen seguro sin volverlo incómodo:
 *
 * - **Corto de vida**: diez minutos. Un código que quedó en una nota pegada al
 *   monitor no sirve mañana.
 * - **De un solo uso**: en cuanto una caja lo canjea, se quema. Dos terminales
 *   no pueden nacer del mismo código.
 * - **Difícil de adivinar**: ocho caracteres de un alfabeto de 32 son 2^40
 *   combinaciones. Con el límite por IP, probarlas es inviable.
 *
 * El alfabeto excluye 0/O/1/I/L a propósito: este código se lee en voz alta por
 * teléfono y se escribe en un teclado táctil, y esas cinco son las que hacen
 * que alguien escriba lo que no era.
 */
const posVinculacionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true,
  },

  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },

  /** Cómo se va a llamar la caja que use este código. */
  nombre: { type: String, default: 'Caja', trim: true, maxlength: 60 },

  creadaPor: { type: mongoose.Schema.Types.ObjectId, default: null },

  /* Al canjearse queda la marca, no se borra: si alguien pregunta "¿quién
     vinculó esa caja y cuándo?", la respuesta tiene que existir. */
  usadoEn: { type: Date, default: null },
  usadoPorCaja: { type: mongoose.Schema.Types.ObjectId, default: null },

  expiraEn: { type: Date, required: true },
}, { timestamps: true });

/* Mongo borra solo los códigos viejos una hora después de vencer. El margen es
   para que, si alguien reclama "puse el código y dijo que no existe", quede
   rastro de que existió y venció, en vez de haber desaparecido sin más. */
posVinculacionSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.models.PosVinculacion || mongoose.model('PosVinculacion', posVinculacionSchema);
