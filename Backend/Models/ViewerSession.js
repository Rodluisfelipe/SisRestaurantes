const mongoose = require('mongoose');

/**
 * ViewerSession — persiste cada sesión de un visitante viendo el menú.
 * Se crea al conectar (viewer:join) y se actualiza al desconectar (disconnect/viewer:leave).
 * Permite analytics históricos: tasa de conversión, carritos abandonados, fuentes de tráfico, horas pico.
 */
const viewerSessionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },

  // Customer data
  customerName: { type: String, default: 'Anónimo' },
  phone: { type: String, default: null },
  device: { type: String, enum: ['iOS', 'Android', 'Desktop', null], default: null },

  // Traffic source
  source: {
    type: String,
    enum: ['instagram', 'whatsapp', 'google', 'facebook', 'tiktok', 'direct', 'other'],
    default: 'direct'
  },
  referrer: { type: String, default: null },

  // Session timing
  enteredAt: { type: Date, default: Date.now, index: true },
  leftAt: { type: Date, default: null },
  duration: { type: Number, default: 0 }, // seconds

  // Category browsing: last category the viewer was seeing
  lastCategory: { type: String, default: null },

  // Cart at moment of leaving
  cartProducts: [{
    name: { type: String },
    qty: { type: Number, default: 1 },
    price: { type: Number, default: 0 }
  }],
  cartTotal: { type: Number, default: 0 },

  // Conversion
  converted: { type: Boolean, default: false },

  // Returning customer data
  isReturning: { type: Boolean, default: false },
  previousOrders: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Compound index for common queries
viewerSessionSchema.index({ businessId: 1, enteredAt: -1 });
viewerSessionSchema.index({ businessId: 1, converted: 1, enteredAt: -1 });
viewerSessionSchema.index({ businessId: 1, source: 1, enteredAt: -1 });

// Virtual: abandoned cart = had products but didn't convert
viewerSessionSchema.virtual('abandonedCart').get(function () {
  return !this.converted && this.cartTotal > 0;
});

// Ensure virtuals show in JSON
viewerSessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ViewerSession', viewerSessionSchema);
