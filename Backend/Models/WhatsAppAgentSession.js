/**
 * WhatsAppAgentSession — el pedido que se va armando en una conversación.
 *
 * El carrito vive ACÁ y no en la memoria del modelo. Esa es la regla que
 * sostiene todo lo demás: el modelo decide qué quiso decir el cliente, y este
 * documento guarda qué hay en el pedido, con los precios leídos de la base en
 * el momento de agregarlos. Si el carrito viviera en el hilo de la
 * conversación, el modelo terminaría inventando cantidades y totales, que es
 * exactamente la clase de error que ya nos costó pedidos con el total
 * equivocado.
 *
 * Cada línea guarda el precio con el que entró. Si el negocio sube un precio a
 * mitad de conversación, se re-valida al confirmar, igual que hace el POS.
 */
const mongoose = require('mongoose');

const lineaSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },      // unitario, leído de la base
  quantity: { type: Number, required: true, min: 1 },
  note: { type: String, default: '' },
}, { _id: false });

const whatsAppAgentSessionSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  contactPhone: { type: String, required: true, trim: true },

  estado: {
    type: String,
    enum: ['activa', 'esperando_confirmacion', 'cerrada', 'con_humano'],
    default: 'activa',
    index: true
  },

  items: [lineaSchema],
  orderType: { type: String, enum: ['inSite', 'takeaway', 'delivery', null], default: null },
  address: { type: String, default: '' },
  customerName: { type: String, default: '' },
  notes: { type: String, default: '' },

  // El pedido que se creó al final, si llegó a crearse
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderNumber: { type: String, default: '' },

  /* Por qué dejó de atender el agente. Sirve para saber dónde falla sin tener
     que leer conversaciones enteras. */
  motivoTraspaso: { type: String, default: '' },
  /* Cuándo se paso a una persona. Sirve para saber si alguien lo atendió: si
     pasa el tiempo y nadie contesta, el agente retoma en vez de dejar al
     cliente esperando indefinidamente. */
  traspasadoEn: { type: Date, default: null },

  ultimaActividad: { type: Date, default: Date.now },
}, { timestamps: true });

/* Una conversación abierta por contacto y negocio. */
whatsAppAgentSessionSchema.index({ businessId: 1, contactPhone: 1 }, { unique: true });

/* Las conversaciones viejas se borran solas a los 7 días: no aportan nada y
   esta colección crece con cada persona que escriba. */
whatsAppAgentSessionSchema.index({ ultimaActividad: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

whatsAppAgentSessionSchema.methods.total = function () {
  return (this.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
};

module.exports = mongoose.models.WhatsAppAgentSession
  || mongoose.model('WhatsAppAgentSession', whatsAppAgentSessionSchema);
