const mongoose = require('mongoose');

/**
 * MenuPopup — anuncio/popup que el dueño del negocio monta en su propio menú
 * (self-service, sin aprobación). Se muestra al cliente al abrir el menú y
 * lleva sus propias estadísticas de vistas y clics.
 *
 * No confundir con:
 *  - Banner  → marketing cross-negocio aprobado por SuperAdmin.
 *  - Announcement → avisos del SuperAdmin al panel del negocio.
 */
const menuPopupSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, trim: true, maxlength: 600, default: '' },
  image: { type: String, default: null },
  // Formato de presentación en el menú
  format: {
    type: String,
    enum: ['modal', 'bar-top', 'bar-bottom', 'toast', 'fullscreen'],
    default: 'modal'
  },
  // Botón de acción (opcional)
  ctaText: { type: String, trim: true, maxlength: 40, default: '' },
  ctaUrl: { type: String, trim: true, maxlength: 500, default: '' },
  // Formulario de captura de datos (opcional) — se muestra debajo de la imagen
  form: {
    enabled: { type: Boolean, default: false },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    fields: [{
      key: { type: String, enum: ['name', 'email', 'phone', 'birthday'], required: true },
      label: { type: String, trim: true, maxlength: 40 },
      required: { type: Boolean, default: false },
      _id: false,
    }],
    submitText: { type: String, trim: true, maxlength: 40, default: 'Enviar' },
    successMessage: { type: String, trim: true, maxlength: 200, default: '¡Gracias!' },
  },
  // Estado / programación
  active: { type: Boolean, default: true },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  // Frecuencia con la que se muestra a un mismo visitante
  frequency: {
    type: String,
    enum: ['once', 'session', 'daily', 'always'],
    default: 'session'
  },
  delaySeconds: { type: Number, default: 1, min: 0, max: 60 },
  // Estadísticas
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  submissions: { type: Number, default: 0 },
}, { timestamps: true });

menuPopupSchema.index({ businessId: 1, active: 1 });

// ¿El popup está vigente ahora mismo? (activo + dentro de fechas)
menuPopupSchema.methods.isLive = function () {
  if (!this.active) return false;
  const now = new Date();
  if (this.startsAt && this.startsAt > now) return false;
  if (this.endsAt && this.endsAt < now) return false;
  return true;
};

module.exports = mongoose.models.MenuPopup || mongoose.model('MenuPopup', menuPopupSchema);
