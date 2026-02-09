const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  // Contenido del anuncio
  title: {
    type: String,
    required: true,
    maxlength: 150,
    trim: true
  },
  body: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  
  // Configuración
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Seguimiento de lectura por negocio
  seenBy: [{
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessConfig',
      required: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    seenAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Creado por
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  }
}, {
  timestamps: true
});

// Índices para consultas eficientes
announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ 'seenBy.businessId': 1 });
announcementSchema.index({ 'seenBy.adminId': 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
