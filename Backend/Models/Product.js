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

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);
