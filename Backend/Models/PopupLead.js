const mongoose = require('mongoose');

/**
 * PopupLead — dato de contacto que un cliente dejó en el formulario de un
 * popup/anuncio del menú. El dueño del negocio los ve y exporta desde el panel.
 */
const popupLeadSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  popupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuPopup',
    required: true,
    index: true
  },
  popupTitle: { type: String, default: '' },
  name: { type: String, trim: true, maxlength: 120, default: '' },
  email: { type: String, trim: true, maxlength: 160, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  birthday: { type: String, trim: true, maxlength: 20, default: '' },
}, { timestamps: true });

popupLeadSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.models.PopupLead || mongoose.model('PopupLead', popupLeadSchema);
