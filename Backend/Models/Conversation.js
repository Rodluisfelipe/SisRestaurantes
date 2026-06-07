/**
 * Conversation — chat 1:1 entre un worker y un business.
 *
 * Scope: una conversación queda atada a un ShiftBooking específico,
 * para evitar abuso (no chat libre, solo en contexto de un turno aceptado).
 *
 * Identidad participantes:
 *   - workerId: Worker
 *   - businessId: BusinessConfig
 *   - bookingId: ShiftBooking (opcional pero recomendado)
 */
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true, index: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftBooking', default: null },

  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, maxlength: 100, default: '' },

  // Contadores de no leídos por lado
  workerUnread: { type: Number, default: 0 },
  businessUnread: { type: Number, default: 0 },

  // Estado
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true });

// Una conversación única por (worker, business, booking)
conversationSchema.index({ workerId: 1, businessId: 1, bookingId: 1 }, { unique: true });
conversationSchema.index({ workerId: 1, lastMessageAt: -1 });
conversationSchema.index({ businessId: 1, lastMessageAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
