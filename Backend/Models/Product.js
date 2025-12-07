const mongoose = require("mongoose");

/**
 * Modelo de Producto
 *
 * Define la estructura de datos para los productos en MongoDB.
 * Incluye información como nombre, descripción, precio, categoría,
 * imagen y grupos de opciones (toppings).
 */

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  price: {
    type: Number,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  image: String,
  toppingGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ToppingGroup'
  }],
  toppingGroupsOrder: [{
    toppingGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ToppingGroup'
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  active: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredOrder: {
    type: Number,
    default: 0
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  }
});

// Índices para mejorar rendimiento de consultas comunes
// Índice compuesto para consultas filtradas por negocio, categoría y estado activo
ProductSchema.index({ businessId: 1, category: 1, active: 1 });

// Índice compuesto para ordenamiento eficiente por displayOrder dentro de un negocio
ProductSchema.index({ businessId: 1, displayOrder: 1 });

// Índice para productos destacados
ProductSchema.index({ businessId: 1, isFeatured: 1, featuredOrder: 1 });

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);
