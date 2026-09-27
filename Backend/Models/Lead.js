const mongoose = require('mongoose');

/**
 * CRM de Menuby: los negocios que podrían volverse clientes.
 *
 * Un lead entra solo (escribe al WhatsApp de Menuby, llena el formulario de la
 * web o se registra) o lo crea alguien del equipo. Avanza por etapas hasta
 * ganarse o perderse, y todo lo que pasa con él queda en su actividad.
 */

const ETAPAS = ['nuevo', 'contactado', 'interesado', 'demo', 'negociacion', 'ganado', 'perdido'];
const FUENTES = ['whatsapp', 'formulario', 'registro', 'referido', 'manual', 'evento', 'otro'];

const leadSchema = new mongoose.Schema({
  nombre: { type: String, trim: true, maxlength: 120, default: '' },       // la persona
  negocio: { type: String, trim: true, maxlength: 120, default: '' },      // su restaurante
  // Teléfono normalizado (57300…): es la llave con la que se une a WhatsApp.
  telefono: { type: String, trim: true, maxlength: 20, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
  ciudad: { type: String, trim: true, maxlength: 80, default: '' },
  tipoNegocio: { type: String, trim: true, maxlength: 60, default: '' },

  fuente: { type: String, enum: FUENTES, default: 'manual', index: true },
  // De qué página o campaña llegó (utm_source, la landing de nicho, etc.)
  origen: { type: String, trim: true, maxlength: 120, default: '' },
  etapa: { type: String, enum: ETAPAS, default: 'nuevo', index: true },
  motivoPerdida: { type: String, trim: true, maxlength: 200, default: '' },

  valorEstimado: { type: Number, default: 0, min: 0 }, // COP al mes
  planInteres: { type: String, trim: true, maxlength: 40, default: '' },
  etiquetas: [{ type: String, trim: true, maxlength: 30 }],

  responsable: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
    nombre: { type: String, default: '' },
  },
  proximaAccion: {
    texto: { type: String, trim: true, maxlength: 200, default: '' },
    fecha: { type: Date, default: null },
  },

  // Lo último que pasó por WhatsApp, para la lista sin abrir la conversación.
  ultimoMensaje: {
    texto: { type: String, default: '' },
    direccion: { type: String, enum: ['in', 'out', ''], default: '' },
    fecha: { type: Date, default: null },
  },
  noLeidos: { type: Number, default: 0 },
  ultimoContacto: { type: Date, default: null },

  // Si se registró en Menuby, su negocio.
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', default: null },
  ganadoEn: { type: Date, default: null },
}, { timestamps: true });

leadSchema.index({ telefono: 1 }, { unique: true, partialFilterExpression: { telefono: { $gt: '' } } });
leadSchema.index({ etapa: 1, updatedAt: -1 });
leadSchema.index({ 'proximaAccion.fecha': 1 });

const actividadSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  tipo: { type: String, enum: ['nota', 'llamada', 'reunion', 'etapa', 'sistema', 'whatsapp'], required: true },
  texto: { type: String, trim: true, maxlength: 2000, default: '' },
  por: {
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
    nombre: { type: String, default: '' },
  },
  fecha: { type: Date, default: Date.now },
}, { timestamps: false });
actividadSchema.index({ leadId: 1, fecha: -1 });

module.exports = {
  ETAPAS,
  FUENTES,
  Lead: mongoose.models.Lead || mongoose.model('Lead', leadSchema),
  LeadActividad: mongoose.models.LeadActividad || mongoose.model('LeadActividad', actividadSchema),
};
