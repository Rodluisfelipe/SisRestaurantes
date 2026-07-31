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
    enum: ['fast_food', 'restaurant', 'cafe', 'bakery', 'ice_cream', 'bar', 'food_truck', 'salon', 'spa', 'clinic', 'services', 'hotel', 'other'],
    default: 'restaurant'
  },
  // Booking / appointment system
  enableBookings: {
    type: Boolean,
    default: false
  },
  bookingSettings: {
    slotInterval: { type: Number, default: 30 },
    maxAdvanceDays: { type: Number, default: 30 },
    bufferMinutes: { type: Number, default: 0 },
    autoConfirm: { type: Boolean, default: true },
    // Cancellation policy
    allowCancellation: { type: Boolean, default: true },
    cancellationDeadlineHours: { type: Number, default: 2 }, // hours before booking
    // Staff assignment
    enableStaffAssignment: { type: Boolean, default: false },
    // Reminder notifications
    enableReminders: { type: Boolean, default: true },
    reminderHoursBefore: [{ type: Number }] // default set in code: [24, 1]
  },
  // Email notification settings (platform-level multi-provider)
  emailSettings: {
    enabled: { type: Boolean, default: false },
    sendOnBookingConfirmed: { type: Boolean, default: true },
    sendOnBookingCancelled: { type: Boolean, default: true }
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
  tagline: {
    type: String,
    default: "",
    maxlength: 80
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
  phoneCountryCode: {
    type: String,
    default: "+57"
  },
  currency: {
    type: String,
    default: "COP"
  },
  address: {
    type: String,
    default: ""
  },
  googleMapsUrl: {
    type: String,
    default: ""
  },
  // Vinculación con Google Places: rating, conteo y enlace para reseñas
  google: {
    placeId: { type: String, default: "" },
    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: 0 },
    reviewUrl: { type: String, default: "" },   // deep-link para escribir reseña
    mapsUrl: { type: String, default: "" },
    website: { type: String, default: "" },
    syncedAt: { type: Date, default: null },
    // Snapshot de hasta 5 reseñas escritas de Google (se refresca al vincular)
    reviews: {
      type: [{
        author: { type: String, default: "" },
        authorUrl: { type: String, default: "" },
        photo: { type: String, default: "" },
        rating: { type: Number, default: 0 },
        text: { type: String, default: "" },
        relativeTime: { type: String, default: "" },
        publishTime: { type: Date, default: null }
      }],
      default: []
    },
    // Referencias de fotos del lugar (se resuelven vía proxy /api/places/photo)
    photos: {
      type: [{
        name: { type: String, default: "" },
        widthPx: { type: Number, default: 0 },
        heightPx: { type: Number, default: 0 }
      }],
      default: []
    }
  },
  // Qué reseñas mostrar en el menú: ambas | solo internas | solo Google | ninguna
  reviewsDisplay: {
    type: String,
    enum: ['both', 'internal', 'google', 'none'],
    default: 'both'
  },
  // Cómo recolectar reseñas del cliente
  reviewCollection: {
    // funnel = califica aquí y solo si es alta se invita a Google (protege reputación)
    // choice = el cliente elige dónde calificar
    // internal = nunca se envía a Google
    mode: { type: String, enum: ['funnel', 'choice', 'internal'], default: 'funnel' },
    // Umbral mínimo (estrellas) para invitar a Google en modo embudo
    googleThreshold: { type: Number, default: 4, min: 1, max: 5 }
  },
  // NIT / Tax ID del negocio
  // Wi-Fi del local para los comensales. Solo se sirve si enabled = true
  // (ver el transform de toJSON, que lo filtra en las APIs públicas).
  wifi: {
    ssid: { type: String, trim: true, maxlength: 64, default: '' },
    password: { type: String, trim: true, maxlength: 64, default: '' },
    enabled: { type: Boolean, default: false }
  },

  nit: {
    type: String,
    default: ""
  },
  // Printer / ticket settings
  printerSettings: {
    paperSize: { type: String, enum: ['55', '58'], default: '55' },
    showQR: { type: Boolean, default: true }
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
    buttonTextColor: { type: String, default: "#ffffff" },
    primaryColor: { type: String, default: "" },
    menuFont: { type: String, enum: ['', 'inter', 'playfair', 'poppins', 'lora', 'montserrat'], default: '' },
    // Menú colapsado: muestra el índice de categorías y el cliente entra a cada una.
    // Ideal para cartas con muchos productos.
    collapsedMenu: { type: Boolean, default: false }
  },
  // Feature flags
  features: {
    favoritesEnabled: { type: Boolean, default: true },
    orderHistoryEnabled: { type: Boolean, default: true },
    posBetaEnabled: { type: Boolean, default: false },
    // Menú V2 ("perfil + historias"). Beta por negocio: apagado = menú actual
    // sin ningún cambio visible. Mismo patrón que posBetaEnabled.
    menuV2: { type: Boolean, default: false }
  },
  // "Los más pedidos" — sección premium de recomendados en el menú
  popularSection: {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'Los más pedidos', maxlength: 40 },
    // auto = solo ventas reales | hybrid = ventas + destacados + favoritos | manual = solo fijados
    mode: { type: String, enum: ['auto', 'hybrid', 'manual'], default: 'hybrid' },
    windowDays: { type: Number, default: 30, min: 1, max: 365 },
    limit: { type: Number, default: 10, min: 3, max: 24 },
    minOrders: { type: Number, default: 1, min: 0 },
    showBadges: { type: Boolean, default: true },
    showOrderCounts: { type: Boolean, default: true },
    pinnedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    hiddenProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },
  // In-app ordering configuration
  orderingMode: {
    type: String,
    enum: ['whatsapp', 'inapp', 'both'],
    default: 'whatsapp'
  },
  // Tipos de pedido habilitados
  orderTypes: {
    inSite: { type: Boolean, default: true },
    takeaway: { type: Boolean, default: true },
    delivery: { type: Boolean, default: true },
    viewOnly: { type: Boolean, default: false }
  },
  // Código de confirmación obligatorio para domiciliarios
  requireDeliveryCode: {
    type: Boolean,
    default: true
  },
  // Código diario de recogida: el restaurante se lo da al domi al llegar para
  // confirmar la recogida. Se regenera automáticamente cada día.
  dailyPickupCode: {
    type: String,
    default: null
  },
  dailyPickupCodeDate: {
    type: String, // YYYY-MM-DD
    default: null
  },
  // Monto mínimo de pedido (0 = sin mínimo). Se valida en el menú y en el backend.
  minOrderAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Configuración del módulo de domicilios: modo de asignación y partners externos
  deliverySettings: {
    // manual: el admin asigna a mano
    // auto_nearest: asigna al domi propio disponible más cercano
    // auto_scored: asigna por scoring (distancia + carga + rating)
    assignmentMode: {
      type: String,
      enum: ['manual', 'auto_nearest', 'auto_scored'],
      default: 'manual'
    },
    // Si no hay domi propio disponible, ofrecer el pedido a empresas partner
    usePartners: {
      type: Boolean,
      default: false
    },
    // Empresas externas asociadas a este negocio, con prioridad de oferta
    partners: [{
      partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner' },
      enabled: { type: Boolean, default: true },
      priority: { type: Number, default: 1 } // menor = mayor prioridad
    }],
    // Radio máximo (km) para considerar un domi "cercano" en auto-asignación
    maxAssignRadiusKm: {
      type: Number,
      default: 8
    },
    // Segundos que un domi tiene para aceptar una oferta antes de que expire
    offerTimeoutSec: {
      type: Number,
      default: 30
    },
    // Minutos que una empresa partner tiene para aceptar antes de re-ofrecer
    partnerOfferTimeoutMin: {
      type: Number,
      default: 10
    }
  },
  // API key para Print Agent (auto-print de tiquetes)
  printAgentKey: {
    type: String,
    default: null
  },
  // Print Agent auto-print mode: comanda, recibo, both
  printAgentMode: {
    type: String,
    enum: ['comanda', 'recibo', 'both'],
    default: 'both'
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
  // Métodos de pago configurables por modo de pedido
  paymentMethods: {
    efectivo: {
      enabled: { type: Boolean, default: false },
      modes: {
        whatsapp: { type: Boolean, default: true },
        inapp: { type: Boolean, default: true }
      }
    },
    nequi: {
      enabled: { type: Boolean, default: false },
      modes: {
        whatsapp: { type: Boolean, default: true },
        inapp: { type: Boolean, default: true }
      }
    },
    daviplata: {
      enabled: { type: Boolean, default: false },
      modes: {
        whatsapp: { type: Boolean, default: true },
        inapp: { type: Boolean, default: true }
      }
    },
    transferencia: {
      enabled: { type: Boolean, default: false },
      modes: {
        whatsapp: { type: Boolean, default: true },
        inapp: { type: Boolean, default: true }
      }
    }
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
  },
  // Crew marketplace wallet — billetera prepago del negocio para escrow de turnos.
  // Toda publicación de turno reserva saldo aquí; el dinero se libera al worker
  // cuando el turno se completa. Si se cancela, las reglas de devolución
  // determinan cuánto vuelve a `balance` vs. queda como penalización para Crew.
  crewWallet: {
    balance: { type: Number, default: 0, min: 0 },        // disponible para reservar nuevos turnos
    pendingBalance: { type: Number, default: 0, min: 0 }, // reservado en escrow (turnos publicados, sin liberar)
    totalReserved: { type: Number, default: 0 },          // suma histórica de todo lo reservado
    totalSpent: { type: Number, default: 0 },             // suma histórica liberada a workers
    totalCommissionPaid: { type: Number, default: 0 },    // suma histórica que Crew se ha quedado
    currency: { type: String, default: 'COP' },
    lastRechargeAt: { type: Date, default: null },
  },

  // Referral program
  referralCode: {
    type: String,
    uppercase: true,
    trim: true
  },
  referralCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  // Marketplace de proveedores — activado por SuperAdmin
  isSupplier: {
    type: Boolean,
    default: false
  },
  supplierInfo: {
    categories: [{ type: String }],
    description: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null }
  },
  lastWhatsappCampaign: { type: Date, default: null },
  // Multi-branch / brand
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', default: null },
  isMainBranch: { type: Boolean, default: false },
  branchLabel: { type: String, default: null, trim: true },
  useSharedMenu: { type: Boolean, default: false },
  mainBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', default: null },
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

// Strip sensitive fields from JSON output (public APIs)
businessConfigSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.emailSettings) {
      ret.emailSettings = {
        enabled: ret.emailSettings.enabled || false,
        sendOnBookingConfirmed: ret.emailSettings.sendOnBookingConfirmed !== false,
        sendOnBookingCancelled: ret.emailSettings.sendOnBookingCancelled !== false
      };
    }
    // La clave del wifi solo viaja si el dueño lo activó para los comensales.
    // Apagado, ni siquiera se expone el nombre de la red.
    if (!ret.wifi || !ret.wifi.enabled) {
      ret.wifi = { enabled: false };
    }
    return ret;
  }
});

businessConfigSchema.index({ isActive: 1 });
businessConfigSchema.index({ department: 1, city: 1 });
businessConfigSchema.index({ referralCode: 1 }, { unique: true, sparse: true });

// Importante: esto es para asegurarnos de que usamos el mismo modelo si ya existe
const BusinessConfig = mongoose.models.BusinessConfig || mongoose.model("BusinessConfig", businessConfigSchema);

// El _id de este documento es el businessId que se usará para multi-negocio

module.exports = BusinessConfig; 