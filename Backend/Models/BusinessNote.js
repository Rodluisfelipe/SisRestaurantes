const mongoose = require('mongoose');

/**
 * BusinessNote — memoria de soporte sobre un negocio.
 *
 * Salud dice quién está en riesgo; esto dice qué se hizo al respecto: a quién
 * se llamó, qué contestó y qué quedó pendiente. Sin esto cada caso empieza de
 * cero, y con equipo nadie sabe qué hizo el otro.
 */
const businessNoteSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true,
  },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  // Quién la escribió (queda aunque el usuario del equipo se elimine)
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin', default: null },
  authorEmail: { type: String, default: '' },
  // Para separar una llamada de una nota suelta o de un recordatorio
  kind: { type: String, enum: ['note', 'call', 'email', 'whatsapp'], default: 'note' },
  pinned: { type: Boolean, default: false },
}, { timestamps: true });

businessNoteSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.models.BusinessNote || mongoose.model('BusinessNote', businessNoteSchema);
