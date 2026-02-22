const mongoose = require("mongoose");

const deliveryZoneSchema = new mongoose.Schema({
  // Relación con el negocio/admin
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessConfig",
    required: true,
    index: true
  },
  
  // Información básica de la zona
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Tipo de delimitación
  type: {
    type: String,
    enum: ["radius", "polygon"],
    required: true,
    default: "polygon"
  },
  
  // Área geográfica en formato GeoJSON
  // Para tipo "radius": Point con propiedad radius
  // Para tipo "polygon": Polygon con coordenadas
  geometry: {
    type: {
      type: String,
      enum: ["Point", "Polygon"],
      required: true
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    // Para tipo "radius", almacenar el radio en metros
    radius: {
      type: Number,
      min: 0
    }
  },
  
  // Configuración de precios
  pricing: {
    // Modo de cálculo: fixed (tarifa fija), distance (por km), tiered (por tramos)
    mode: {
      type: String,
      enum: ["fixed", "distance", "tiered"],
      required: true,
      default: "fixed"
    },
    
    // Tarifa base (siempre aplicable)
    basePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    
    // Costo por kilómetro (para modo "distance")
    pricePerKm: {
      type: Number,
      min: 0,
      default: 0
    },
    
    // Distancia mínima gratis (km)
    freeDistanceKm: {
      type: Number,
      min: 0,
      default: 0
    },
    
    // Tramos de precio (para modo "tiered")
    // Ejemplo: [{maxDistance: 5, price: 5000}, {maxDistance: 10, price: 8000}]
    tiers: [{
      maxDistance: {
        type: Number,
        min: 0
      },
      price: {
        type: Number,
        min: 0
      }
    }],
    
    // Monto mínimo de pedido para esta zona
    minimumOrder: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Tiempo estimado de entrega (en minutos)
  estimatedTime: {
    min: {
      type: Number,
      required: true,
      min: 0,
      default: 30
    },
    max: {
      type: Number,
      required: true,
      min: 0,
      default: 45
    }
  },
  
  // Prioridad (para resolver superposiciones entre zonas)
  // Mayor número = mayor prioridad
  priority: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 100
  },
  
  // Color para visualización en el mapa (hex)
  color: {
    type: String,
    default: "#3B82F6",
    validate: {
      validator: function(v) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: props => `${props.value} no es un color hexadecimal válido`
    }
  },
  
  // Estado de la zona
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Horarios de disponibilidad (opcional)
  schedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    // Días de la semana: 0=Domingo, 1=Lunes, ..., 6=Sábado
    days: [{
      day: {
        type: Number,
        min: 0,
        max: 6
      },
      openTime: String, // Formato "HH:mm"
      closeTime: String // Formato "HH:mm"
    }]
  },
  
  // Estadísticas de uso
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    lastOrderDate: Date
  }
}, {
  timestamps: true
});

// Índices para consultas geoespaciales
deliveryZoneSchema.index({ geometry: "2dsphere" });
deliveryZoneSchema.index({ businessId: 1, isActive: 1 });
deliveryZoneSchema.index({ businessId: 1, priority: -1 });

// Método estático para obtener zonas activas de un negocio
deliveryZoneSchema.statics.getActiveZones = function(businessId) {
  return this.find({ 
    businessId, 
    isActive: true 
  }).sort({ priority: -1 });
};

// Método para validar GeoJSON antes de guardar
deliveryZoneSchema.pre('save', function(next) {
  // Validar que el tipo de geometría coincida con el tipo de zona
  if (this.type === 'radius' && this.geometry.type !== 'Point') {
    return next(new Error('Las zonas tipo "radius" deben tener geometría tipo "Point"'));
  }
  
  if (this.type === 'polygon' && this.geometry.type !== 'Polygon') {
    return next(new Error('Las zonas tipo "polygon" deben tener geometría tipo "Polygon"'));
  }
  
  // Validar que las zonas de radio tengan el campo radius
  if (this.type === 'radius' && !this.geometry.radius) {
    return next(new Error('Las zonas tipo "radius" deben tener un radio definido'));
  }
  
  // Validar tiempos estimados
  if (this.estimatedTime.min > this.estimatedTime.max) {
    return next(new Error('El tiempo mínimo no puede ser mayor al tiempo máximo'));
  }
  
  next();
});

// Método de instancia para incrementar estadísticas (atomic)
deliveryZoneSchema.methods.recordOrder = function(orderTotal) {
  return mongoose.model('DeliveryZone').updateOne(
    { _id: this._id },
    {
      $inc: { 'stats.totalOrders': 1, 'stats.totalRevenue': orderTotal },
      $set: { 'stats.lastOrderDate': new Date() }
    }
  );
};

// Método de instancia para verificar si está disponible en un horario
deliveryZoneSchema.methods.isAvailableAt = function(date = new Date()) {
  if (!this.schedule.enabled) {
    return true;
  }
  
  const dayOfWeek = date.getDay();
  const currentTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  
  const daySchedule = this.schedule.days.find(d => d.day === dayOfWeek);
  
  if (!daySchedule) {
    return false;
  }
  
  return currentTime >= daySchedule.openTime && currentTime <= daySchedule.closeTime;
};

const DeliveryZone = mongoose.model("DeliveryZone", deliveryZoneSchema);

module.exports = DeliveryZone;

