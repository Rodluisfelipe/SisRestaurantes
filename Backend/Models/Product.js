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
  // Item type: product (physical goods) or service (requires booking)
  itemType: {
    type: String,
    enum: ['product', 'service'],
    default: 'product'
  },
  // Duration in minutes (only relevant for services)
  durationMinutes: {
    type: Number,
    default: null
  },
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
  // Inventario por producto
  trackStock: {
    type: Boolean,
    default: false
  },
  /* Costo de compra. Sin esto, el "valor en bodega" se calculaba con el precio
     al público, que no es lo que el negocio tiene invertido: mostraba una
     cifra que parecía una valoración y no lo era. */
  cost: {
    type: Number,
    default: null   // null = no se ha registrado
  },
  stock: {
    type: Number,
    default: null  // null = ilimitado
  },
  lowStockAlert: {
    type: Number,
    default: 5
  },
  /* Receta: qué insumos consume una unidad de este producto. Solo aplica en el
     inventario avanzado. Con receta, vender descuenta los insumos en vez del
     contador del producto — es lo que de verdad se agota en la cocina. */
  recipe: [{
    supplyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supply', required: true },
    quantity: { type: Number, required: true, min: 0 },
  }],
  // Promo / Producto del día con cuenta regresiva
  promo: {
    active: { type: Boolean, default: false },
    price: { type: Number, default: null },   // precio promocional
    endsAt: { type: Date, default: null },     // fin de la promo (countdown)
    label: { type: String, default: '' }        // ej. "Producto del día"
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  }
}, { timestamps: true });

// Índices para mejorar rendimiento de consultas comunes
// Índice compuesto para consultas filtradas por negocio, categoría y estado activo
ProductSchema.index({ businessId: 1, category: 1, active: 1 });

// Índice compuesto para ordenamiento eficiente por displayOrder dentro de un negocio
ProductSchema.index({ businessId: 1, displayOrder: 1 });

// Índice para productos destacados
ProductSchema.index({ businessId: 1, isFeatured: 1, featuredOrder: 1 });

module.exports = mongoose.models.Product || mongoose.model("Product", ProductSchema);
