const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  // Información del restaurante
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  businessName: {
    type: String,
    required: true
  },
  businessSlug: {
    type: String,
    required: true
  },
  
  // Información del banner
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 200
  },
  image: {
    type: String,
    required: true
  },
  
  // Estado del banner
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Fechas
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Metadatos
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  // Información de aprobación
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  
  // Estadísticas
  clicks: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
bannerSchema.index({ status: 1, startDate: 1, endDate: 1 });
bannerSchema.index({ businessId: 1, status: 1 });
bannerSchema.index({ priority: -1, createdAt: -1 });

// Middleware para validar fechas
bannerSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('La fecha de fin debe ser posterior a la fecha de inicio'));
  }
  next();
});

// Método para verificar si el banner está activo
bannerSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'approved' && 
         this.startDate <= now && 
         this.endDate >= now;
};

// Método para incrementar clicks
bannerSchema.methods.incrementClicks = function() {
  this.clicks += 1;
  return this.save();
};

// Método para incrementar impresiones
bannerSchema.methods.incrementImpressions = function() {
  this.impressions += 1;
  return this.save();
};

module.exports = mongoose.model('Banner', bannerSchema);
