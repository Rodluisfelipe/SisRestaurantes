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
});

module.exports = mongoose.models.ToppingGroup || mongoose.model("ToppingGroup", toppingGroupSchema); 