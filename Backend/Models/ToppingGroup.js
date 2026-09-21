const mongoose = require("mongoose");

// Definir el esquema para las opciones
const toppingOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  // Foto opcional de la opción (se muestra al elegir extras en el menú)
  image: {
    type: String,
    default: ''
  }
});

// Definir el esquema para los subgrupos
const subGroupSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  isMultipleChoice: {
    type: Boolean,
    default: true  // Por defecto, las opciones son multiple choice (checkboxes)
  },
  isRequired: {
    type: Boolean,
    default: false // Por defecto, no es obligatorio seleccionar
  },
  // Tope de opciones elegibles cuando isMultipleChoice es true (ej: "máx 3 de 4 vegetales").
  // null/undefined = sin límite.
  maxSelections: {
    type: Number,
    default: null,
    min: 1
  },
  // Si es true, el cliente puede elegir la misma opción más de una vez
  // (ej: "zanahoria x2"), contando cada repetición contra maxSelections.
  allowRepeats: {
    type: Boolean,
    default: false
  },
  options: [toppingOptionSchema]
});

const toppingGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  basePrice: {
    type: Number,
    default: 0
  },
  isMultipleChoice: {
    type: Boolean,
    default: false
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  /* Este grupo es el tamaño o la presentación del producto.

     Lo marca el dueño en el panel y la caja lo lee para poner sus opciones
     en la botonera de tamaños del mostrador: con [Mediano] puesto, tocar la
     gaseosa marca la mediana sin abrir nada.

     Existe porque la caja lo venía adivinando por el nombre del grupo
     —'Tamaño', 'Combo', 'Porción'— y adivinar siempre deja bordes sueltos:
     el negocio que llama a su grupo 'Presentaciones' no aparecía, y el que
     llama 'Combo' a un grupo de adiciones aparecía mal.

     Por defecto `false`: un grupo que nadie marcó no debe colarse en esa
     botonera. La heurística por nombre sigue viva en la caja como red para
     los negocios que todavía no han marcado nada. */
  esCombo: {
    type: Boolean,
    default: false
  },
  // Opciones directas en el grupo principal
  options: [toppingOptionSchema],
  // Subgrupos
  subGroups: [subGroupSchema],
  active: {
    type: Boolean,
    default: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  }
}, { timestamps: true });

toppingGroupSchema.index({ businessId: 1, active: 1 });

module.exports = mongoose.models.ToppingGroup || mongoose.model("ToppingGroup", toppingGroupSchema); 