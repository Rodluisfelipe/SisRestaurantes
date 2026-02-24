const mongoose = require("mongoose");

// Esquema para redes sociales
const socialMediaItemSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  isVisible: { type: Boolean, default: false }
}, { _id: false });

// Esquema para la configuración del negocio
const businessConfigSchema = new mongoose.Schema({
  // businessId: {
  //   type: String,
  //   required: true,
  //   unique: true
  // },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  businessName: {
    type: String,
    required: true,
    default: "Mi Restaurante"
  },
  businessType: {
    type: String,
    enum: ['fast_food', 'restaurant', 'cafe', 'bakery', 'ice_cream', 'bar', 'food_truck', 'other'],
    default: 'restaurant'
  },
  // Onboarding tracking
  onboarding: {
    level: { type: Number, default: 0, min: 0, max: 6 },
    completedAt: { type: Date, default: null },
    guidesShown: [{ type: String }]
  },
  description: {
    type: String,
    default: "Deliciosa comida casera con ingredientes frescos y servicio de calidad.",
    maxlength: 300
  },
  logo: {
    type: String,
    default: ""
  },
  coverImage: {
    type: String,
    default: ""
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  // Configuración de horarios del negocio
  businessHours: {
    monday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    tuesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    wednesday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    thursday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    friday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    saturday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    },
    sunday: {
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: "08:00" },
      closeTime: { type: String, default: "22:00" }
    }
  },
  // Estado del menú (pausado/activo)
  menuStatus: {
    type: String,
    enum: ['active', 'paused'],
    default: 'active'
  },
  whatsappNumber: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  googleMapsUrl: {
    type: String,
    default: ""
  },
  location: {
    coordinates: {
      lat: {
        type: Number,
        default: null
      },
      lng: {
        type: Number,
        default: null
      }
    },
    address: {
      type: String,
      default: ""
    }
  },
  socialMedia: {
    facebook: socialMediaItemSchema,
    instagram: socialMediaItemSchema,
    tiktok: socialMediaItemSchema
  },
  extraLink: {
    url: { type: String, default: "" },
    isVisible: { type: Boolean, default: false }
  },
  theme: {
    buttonColor: { type: String, default: "#2563eb" },
    buttonTextColor: { type: String, default: "#ffffff" }
  },
  // Feature flags
  features: {
    favoritesEnabled: { type: Boolean, default: true },
    orderHistoryEnabled: { type: Boolean, default: true }
  },
  // In-app ordering configuration
  orderingMode: {
    type: String,
    enum: ['whatsapp', 'inapp', 'both'],
    default: 'whatsapp'
  },
  paymentInfo: {
    nequi: { type: String, default: '' },
    daviplata: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankAccountType: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    accountHolder: { type: String, default: '' },
    instructions: { type: String, default: '' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Campos para el catálogo por ubicación
  department: {
    type: String,
    default: ""
  },
  city: {
    type: String,
    default: ""
  },

  // Review statistics (auto-calculated)
  // Feature creation date for onboarding detection
  onboardingFeatureDate: {
    type: Date,
    default: null
  },
  reviewStats: {
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    },
    thumbsFeedback: {
      thumbsUp: { type: Number, default: 0 },
      thumbsDown: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    favoriteProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  }
}, { timestamps: true }); // Agregar timestamps para debugging

// Método para obtener la configuración
businessConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      businessName: "Mi Restaurante",
      logo: "",
      coverImage: "",
      isOpen: true,
      businessHours: {
        monday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        tuesday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        wednesday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        thursday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        friday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        saturday: { isOpen: true, openTime: "08:00", closeTime: "22:00" },
        sunday: { isOpen: true, openTime: "08:00", closeTime: "22:00" }
      },
      menuStatus: 'active',
      whatsappNumber: "",
      address: "",
      googleMapsUrl: "",
      socialMedia: {
        facebook: { url: "", isVisible: false },
        instagram: { url: "", isVisible: false },
        tiktok: { url: "", isVisible: false }
      },
      extraLink: { url: "", isVisible: false },
      theme: {
        buttonColor: "#2563eb",
        buttonTextColor: "#ffffff"
      }
    });
  }
  return config;
};

// Método para verificar si el negocio está abierto según horarios
businessConfigSchema.methods.isCurrentlyOpen = function() {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().substring(0, 5); // 'HH:MM'
  
  const dayMap = {
    'monday': 'monday',
    'tuesday': 'tuesday', 
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
    'sunday': 'sunday'
  };
  
  const dayKey = dayMap[currentDay];
  if (!dayKey || !this.businessHours[dayKey]) {
    return false;
  }
  
  const dayHours = this.businessHours[dayKey];
  if (!dayHours.isOpen) {
    return false;
  }
  
  return currentTime >= dayHours.openTime && currentTime <= dayHours.closeTime;
};

// Método para obtener el estado completo del negocio
businessConfigSchema.methods.getBusinessStatus = function() {
  const isOpenByHours = this.isCurrentlyOpen();
  const isMenuActive = this.menuStatus === 'active';
  
  return {
    isOpen: this.isOpen && isOpenByHours && isMenuActive,
    isOpenByHours,
    isMenuActive,
    menuStatus: this.menuStatus,
    nextOpenTime: this.getNextOpenTime()
  };
};

// Método para obtener la próxima hora de apertura
businessConfigSchema.methods.getNextOpenTime = function() {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const currentDayIndex = dayOrder.indexOf(currentDay);
  
  // Buscar el próximo día abierto
  for (let i = 0; i < 7; i++) {
    const dayIndex = (currentDayIndex + i) % 7;
    const dayKey = dayOrder[dayIndex];
    const dayHours = this.businessHours[dayKey];
    
    if (dayHours && dayHours.isOpen) {
      return {
        day: dayKey,
        time: dayHours.openTime
      };
    }
  }
  
  return null;
};

businessConfigSchema.index({ isActive: 1 });
businessConfigSchema.index({ department: 1, city: 1 });

// Importante: esto es para asegurarnos de que usamos el mismo modelo si ya existe
const BusinessConfig = mongoose.models.BusinessConfig || mongoose.model("BusinessConfig", businessConfigSchema);

// El _id de este documento es el businessId que se usará para multi-negocio

module.exports = BusinessConfig; 