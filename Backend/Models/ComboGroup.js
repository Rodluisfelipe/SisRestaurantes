const mongoose = require("mongoose");

// Esquema para opciones individuales (productos base)
const optionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  additionalPrice: {
    type: Number,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  // Referencia al producto original si es necesario
  productRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }
});

// Esquema para subgrupos que pueden contener más subgrupos u opciones
const subGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    enum: ['PRODUCT_GROUP', 'OPTION_GROUP'],
    required: true
  },
  isMultipleChoice: {
    type: Boolean,
    default: false
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  maxSelections: {
    type: Number,
    default: 1
  },
  minSelections: {
    type: Number,
    default: 1
  },
  // Para grupos de productos
  options: [optionSchema],
  // Para subgrupos anidados
  subGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubGroup'
  }]
});

// Esquema principal para combos
const comboGroupSchema = new mongoose.Schema({
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
    required: true,
    default: 0
  },
  image: String,
  category: {
    type: String,
    required: true
  },
  subGroups: [subGroupSchema],
  active: {
    type: Boolean,
    default: true
  },
  // Configuración adicional del combo
  maxTotalItems: {
    type: Number,
    required: true
  },
  minTotalItems: {
    type: Number,
    required: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  }
}, {
  timestamps: true
});

// Crear modelos separados para Combos y SubGrupos
const SubGroup = mongoose.model("SubGroup", subGroupSchema);
const ComboGroup = mongoose.model("ComboGroup", comboGroupSchema);

module.exports = { ComboGroup, SubGroup }; 