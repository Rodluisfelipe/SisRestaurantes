/**
 * WhatsAppAccount — el número de WhatsApp propio de un negocio.
 *
 * Es la pieza que vuelve multi-tenant toda la integración. Meta manda todos los
 * webhooks de la app a UNA sola URL, y lo único que distingue de quién es cada
 * mensaje es `metadata.phone_number_id`. Por eso ese campo es único acá: es la
 * llave con la que el webhook resuelve a qué negocio pertenece lo que llegó.
 *
 * Nada de esto usa Baileys. Baileys mantiene un socket vivo por sesión y no
 * aguanta un número por restaurante en un servidor chico, además del riesgo de
 * que Meta banee el número del cliente. Cloud API es webhook: sin socket, sin
 * sesión en disco, y es la vía oficial.
 *
 * El token se guarda cifrado (ver utils/secretBox): quien lo tenga puede
 * escribir mensajes haciéndose pasar por el restaurante.
 */
const mongoose = require('mongoose');
const { seal, open, hint } = require('../utils/secretBox');

const whatsAppAccountSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },

  // ── Identificadores de Meta ──
  wabaId: { type: String, trim: true, default: '' },      // WhatsApp Business Account
  phoneNumberId: { type: String, required: true, trim: true }, // la llave del enrutador
  displayNumber: { type: String, trim: true, default: '' },    // +57 300 ... (solo para mostrar)
  verifiedName: { type: String, trim: true, default: '' },

  /* Token cifrado. Nunca se expone: los endpoints devuelven `tokenHint`. */
  accessTokenEnc: { type: String, default: '' },
  tokenHint: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'error'],
    default: 'pending',
    index: true
  },
  lastError: { type: String, default: '' },
  lastInboundAt: { type: Date, default: null },
  lastOutboundAt: { type: Date, default: null },

  /* Cómo se conectó: hoy el negocio pega sus datos, mañana puede venir del
     Embedded Signup de Meta. Ambos caminos terminan en este mismo documento. */
  connectedVia: {
    type: String,
    enum: ['manual', 'embedded_signup'],
    default: 'manual'
  },
  connectedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  connectedAt: { type: Date, default: null },

  /* Agente de IA. Apagado por defecto a propósito: que un modelo conteste en
     nombre del negocio es una decisión del negocio, no algo que se active solo
     al conectar el número. */
  agente: {
    activo: { type: Boolean, default: false },
    // Indicaciones propias del negocio: tono, qué no ofrecer, cuándo escalar.
    reglas: { type: String, default: '', maxlength: 2000 },
    // Horario en que puede contestar; vacío = siempre.
    soloEnHorario: { type: Boolean, default: false }
  }
}, { timestamps: true });

/* Un phone_number_id pertenece a un solo negocio. Sin esta restricción, dos
   negocios podrían reclamar el mismo número y el webhook entregaría los chats
   de uno al panel del otro. */
whatsAppAccountSchema.index({ phoneNumberId: 1 }, { unique: true });
whatsAppAccountSchema.index({ businessId: 1, status: 1 });

whatsAppAccountSchema.methods.setAccessToken = function (token) {
  const clean = String(token || '').trim();
  this.accessTokenEnc = clean ? seal(clean) : '';
  this.tokenHint = clean ? hint(clean) : '';
  return this;
};

whatsAppAccountSchema.methods.getAccessToken = function () {
  return this.accessTokenEnc ? open(this.accessTokenEnc) : '';
};

/** Vista segura para el panel: sin token, ni cifrado ni en claro. */
whatsAppAccountSchema.methods.toPanel = function () {
  return {
    _id: this._id,
    businessId: this.businessId,
    wabaId: this.wabaId,
    phoneNumberId: this.phoneNumberId,
    displayNumber: this.displayNumber,
    verifiedName: this.verifiedName,
    status: this.status,
    lastError: this.lastError,
    lastInboundAt: this.lastInboundAt,
    lastOutboundAt: this.lastOutboundAt,
    connectedVia: this.connectedVia,
    connectedAt: this.connectedAt,
    tokenHint: this.tokenHint,
    agente: {
      activo: !!this.agente?.activo,
      reglas: this.agente?.reglas || '',
      soloEnHorario: !!this.agente?.soloEnHorario
    }
  };
};

module.exports = mongoose.models.WhatsAppAccount
  || mongoose.model('WhatsAppAccount', whatsAppAccountSchema);
