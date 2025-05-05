const mongoose = require("mongoose");

// Esquema para opciones individuales dentro de un subgrupo
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
  }
});

// Esquema para subgrupos (ejemplo: tipos de papas, bebidas, etc.)
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
  options: [optionSchema]
});

// Esquema principal para grupos de opciones (combos)
const optionGroupSchema = new mongoose.Schema({
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
  isCombo: {
    type: Boolean,
    default: false
  },
  subGroups: [subGroupSchema],
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.OptionGroup || mongoose.model("OptionGroup", optionGroupSchema); 