const mongoose = require("mongoose");

/**
 * Enlaces marcados: los que el negocio reparte para saber de dónde le llegan
 * las ventas.
 *
 * El valor de `source` es lo que viaja en la URL (`?source=instagram`) y queda
 * grabado en cada pedido. La regla de qué tipo de pedido fuerza el enlace vive
 * ACÁ y no en la URL a propósito: así el negocio puede cambiar un enlace de
 * "en sitio" a "domicilio" desde el panel y los QR ya impresos y pegados en las
 * mesas siguen sirviendo, sin reimprimir nada.
 */
const trackedLinkSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },

  // Nombre legible para el panel: "QR de las mesas", "Bio de Instagram".
  nombre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },

  /* Lo que va en ?source=. Mismo saneado que en el menú y en el pedido
     (utils/origenVisita.js y Routes/orders.js): solo letras, números, punto y
     guion, máximo 40. Si acá se permitiera algo más, el valor llegaría distinto
     al pedido y el reporte partiría el mismo canal en dos filas. */
  source: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40
  },

  /* Qué tipo de pedido impone este enlace. Con esto, el QR de la mesa muestra
     solo "en sitio" y esconde recoger y domicilio: menos ruido para el
     comensal. `null` = el menú muestra todas las opciones del negocio. */
  forzarTipo: {
    type: String,
    enum: ['inSite', 'takeaway', 'delivery', null],
    default: null
  },

  // Los predefinidos se crean solos la primera vez y no se pueden borrar,
  // solo desactivar: son los que sostienen los QR que ya estan pegados.
  predefinido: {
    type: Boolean,
    default: false
  },

  activo: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Un mismo `source` no puede repetirse dentro de un negocio: si se repitiera,
// el reporte sumaria dos enlaces distintos en la misma fila.
trackedLinkSchema.index({ businessId: 1, source: 1 }, { unique: true });

/** Saneado idéntico al del menú, para que el valor cuadre de punta a punta. */
trackedLinkSchema.statics.limpiarSource = function (valor) {
  return String(valor || '').trim().slice(0, 40).replace(/[^\w.-]/g, '').toLowerCase();
};

/* Los tres que se crean solos al abrir el módulo. Cubren el caso que pidió el
   negocio: que el QR de la mesa no ofrezca domicilio, y que el enlace de
   domicilio no ofrezca comer en sitio. */
trackedLinkSchema.statics.PREDEFINIDOS = [
  { nombre: 'QR en el local', source: 'en-sitio', forzarTipo: 'inSite' },
  { nombre: 'Para recoger', source: 'para-recoger', forzarTipo: 'takeaway' },
  { nombre: 'Domicilios', source: 'domicilio', forzarTipo: 'delivery' },
  /* El botón "Enviar menú" de la bandeja de WhatsApp ya venía agregando
     `?source=whatsapp` desde antes de este módulo. Se registra acá para que ese
     tráfico aparezca con nombre propio en el reporte en vez de como un origen
     suelto. Sin `forzarTipo` a propósito: así el enlace que ya se está enviando
     se comporta exactamente igual que hoy. */
  { nombre: 'WhatsApp', source: 'whatsapp', forzarTipo: null },
];

module.exports = mongoose.models.TrackedLink || mongoose.model("TrackedLink", trackedLinkSchema);
