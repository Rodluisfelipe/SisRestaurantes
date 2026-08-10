/**
 * WhatsAppMessage — cada mensaje que entra o sale por el número del negocio.
 *
 * Meta REINTENTA los webhooks cuando no recibe un 200 rápido, así que el mismo
 * mensaje llega varias veces. Por eso `wamid` (el id que asigna Meta) es único:
 * es la misma lección que la billetera de Crew, donde sin clave de idempotencia
 * un cobro se podía aplicar dos veces. Acá el costo de no tenerla sería mostrar
 * el chat duplicado y, cuando entre el agente, crear el pedido dos veces.
 */
const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true },

  /* Id de Meta. Para los salientes se guarda el que devuelve el envío. */
  wamid: { type: String, required: true, trim: true },

  direction: { type: String, enum: ['in', 'out'], required: true, index: true },

  // El teléfono del cliente, siempre en formato internacional sin '+'
  contactPhone: { type: String, required: true, trim: true, index: true },
  contactName: { type: String, trim: true, default: '' },

  type: {
    type: String,
    enum: ['text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'button', 'interactive', 'reaction', 'unsupported'],
    default: 'text'
  },
  text: { type: String, default: '', maxlength: 8000 },
  /* Para adjuntos guardamos la referencia de Meta, no el archivo: descargarlo
     exige el token y los medios expiran, así que se resuelve bajo demanda. */
  mediaId: { type: String, default: null },
  mediaMimeType: { type: String, default: '' },

  /* Lo que decía la nota de voz. Va en su propio campo y no en `text`: `text`
     es lo que el cliente escribió, y mezclarlo con lo que una máquina creyó
     entender haría imposible saber cuál es cuál cuando la transcripción se
     equivoque —que se equivoca. */
  transcripcion: { type: String, default: '' },

  /* Estado de entrega que Meta reporta por webhook para los salientes. */
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  errorMessage: { type: String, default: '' },

  // Quién lo mandó, si salió del panel
  sentBy: { type: mongoose.Schema.Types.ObjectId, default: null },

  sentAt: { type: Date, default: Date.now, index: true },
  readByStaffAt: { type: Date, default: null }
}, { timestamps: true });

/* La clave anti-duplicados. Meta reintenta; sin esto el chat se llena de copias. */
whatsAppMessageSchema.index({ wamid: 1 }, { unique: true });

/* La consulta que hace la bandeja: los mensajes de un chat, del más nuevo al
   más viejo, siempre acotados al negocio dueño. */
whatsAppMessageSchema.index({ businessId: 1, contactPhone: 1, sentAt: -1 });

module.exports = mongoose.models.WhatsAppMessage
  || mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
