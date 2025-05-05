/**
 * Este script actualiza el esquema de la base de datos
 * para incluir el campo whatsappNumber en el modelo BusinessConfig
 */

const mongoose = require("mongoose");
require('dotenv').config();

// MongoDB connection string (usar la misma que en server.js)
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://tu-mongodb-uri";

// Esquema para redes sociales (igual que en el modelo original)
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
  whatsappNumber: {
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
  }
}, { timestamps: true });

// Crear el modelo
const BusinessConfig = mongoose.model("BusinessConfig", businessConfigSchema);

// Función para actualizar el esquema
async function updateSchema() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Conectado a MongoDB");

    // Buscar el documento existente
    const existingConfig = await BusinessConfig.findOne({});
    
    if (!existingConfig) {
      console.log("No existe configuración, creando una nueva...");
      const newConfig = await BusinessConfig.create({
        businessName: "Mi Restaurante",
        logo: "",
        coverImage: "",
        isOpen: true,
        whatsappNumber: "",
        socialMedia: {
          facebook: { url: "", isVisible: false },
          instagram: { url: "", isVisible: false },
          tiktok: { url: "", isVisible: false }
        },
        extraLink: { url: "", isVisible: false }
      });
      console.log("Configuración creada:", newConfig);
    } else {
      // Actualizar el documento existente para asegurar que tenga el campo whatsappNumber
      console.log("Configuración existente:", existingConfig);
      
      // Verificar si ya tiene el campo whatsappNumber
      if (existingConfig.whatsappNumber === undefined) {
        console.log("Actualizando esquema para agregar campo whatsappNumber...");
        
        // Actualizar el documento
        const result = await BusinessConfig.updateOne(
          { _id: existingConfig._id },
          { $set: { whatsappNumber: "" } }
        );
        
        console.log("Resultado de la actualización:", result);
        
        // Verificar la actualización
        const updatedConfig = await BusinessConfig.findOne({});
        console.log("Configuración actualizada:", updatedConfig);
      } else {
        console.log("El campo whatsappNumber ya existe en el documento.");
      }
    }

    console.log("Proceso completado con éxito");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Cerrar la conexión a MongoDB
    mongoose.connection.close();
    console.log("Conexión a MongoDB cerrada");
  }
}

// Ejecutar la función
updateSchema(); 