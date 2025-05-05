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
  isActive: {
    type: Boolean,
    default: true
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

// Importante: esto es para asegurarnos de que usamos el mismo modelo si ya existe
const BusinessConfig = mongoose.models.BusinessConfig || mongoose.model("BusinessConfig", businessConfigSchema);

// El _id de este documento es el businessId que se usará para multi-negocio

module.exports = BusinessConfig; 