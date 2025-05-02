const mongoose = require("mongoose");

// Esquema para redes sociales
const socialMediaItemSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  isVisible: { type: Boolean, default: false }
}, { _id: false });

// Esquema para la configuración del negocio
const businessConfigSchema = new mongoose.Schema({
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
  socialMedia: {
    facebook: socialMediaItemSchema,
    instagram: socialMediaItemSchema,
    tiktok: socialMediaItemSchema
  },
  extraLink: {
    url: { type: String, default: "" },
    isVisible: { type: Boolean, default: false }
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
      socialMedia: {
        facebook: { url: "", isVisible: false },
        instagram: { url: "", isVisible: false },
        tiktok: { url: "", isVisible: false }
      },
      extraLink: { url: "", isVisible: false }
    });
  }
  return config;
};

const BusinessConfig = mongoose.models.BusinessConfig || mongoose.model("BusinessConfig", businessConfigSchema);

module.exports = BusinessConfig; 