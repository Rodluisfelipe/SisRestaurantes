/**
 * Message — un mensaje dentro de una Conversation.
 * El sender puede ser 'worker' o 'business' (lo identificamos por kind).
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderKind: { type: String, enum: ['worker', 'business'], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true }, // ref polimórfico
  body: { type: String, maxlength: 2000, default: '' },
  attachmentUrl: { type: String, default: null }, // imagen/foto opcional
  readAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
