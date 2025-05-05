const express = require("express");
const router = express.Router();
const BusinessConfig = require("../Models/BusinessConfig");
const eventService = require('../services/eventService');
const { emitToBusiness } = require("../services/socketService");
const { findBusinessByIdentifier } = require("../utils/businessHelper");

// Obtener la configuración
router.get("/", async (req, res) => {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json({ message: "businessId requerido" });
    }
    
    try {
      // Buscar por _id o slug usando el helper
      const config = await findBusinessByIdentifier(businessId);
      
      if (!config) {
        return res.status(404).json({ 
          message: 'Negocio no encontrado', 
          detail: `No se encontró un negocio con el identificador '${businessId}'` 
        });
      }
      
      res.json(config);
    } catch (error) {
      console.error(`Error al obtener la configuración del negocio ${businessId}:`, error);
      res.status(500).json({ 
        message: 'Error al obtener la configuración del negocio',
        error: error.message 
      });
    }
});

// Actualizar la configuración
router.put("/", async (req, res) => {
    const { businessId, ...updateData } = req.body;
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    try {
      console.log('Datos recibidos para actualizar:', updateData);
      
      // Buscar por _id o slug usando el helper
      const business = await findBusinessByIdentifier(businessId);
      
      if (!business) {
        return res.status(404).json({ 
          message: 'Negocio no encontrado',
          detail: `No se encontró un negocio con el identificador '${businessId}'`
        });
      }
      
      // Asegurarse de que los campos address y googleMapsUrl están presentes
      if (updateData.address === undefined) {
        updateData.address = "";
      }
      
      if (updateData.googleMapsUrl === undefined) {
        updateData.googleMapsUrl = "";
      }
      
      // Actualizar usando el _id encontrado
      const config = await BusinessConfig.findByIdAndUpdate(
        business._id,
        updateData,
        { new: true }
      );
      
      console.log('Configuración actualizada:', config);
      res.json(config);
    } catch (error) {
      console.error(`Error al actualizar la configuración del negocio ${businessId}:`, error);
      res.status(500).json({ 
        message: 'Error al actualizar la configuración del negocio',
        error: error.message 
      });
    }
});

// Ruta específica para actualizar solo el estado del negocio (para actualizaciones rápidas)
router.put("/status", async (req, res) => {
  try {
    const { isOpen } = req.body;
    
    if (isOpen === undefined) {
      return res.status(400).json({ message: "Se requiere el estado del negocio" });
    }
    
    const config = await BusinessConfig.findOneAndUpdate(
      {},
      { isOpen },
      { new: true, upsert: true }
    );
    
    res.json(config);
  } catch (error) {
    console.error("Error al actualizar el estado del negocio:", error);
    res.status(500).json({ message: "Error al actualizar el estado del negocio" });
  }
});

// Ruta específica para actualizar/reparar el esquema
router.post("/fix-schema", async (req, res) => {
  try {
    // Buscar la configuración existente
    let config = await BusinessConfig.findOne();
    
    if (!config) {
      // Si no existe, crear una nueva con todos los campos
      config = await BusinessConfig.create({
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
        extraLink: { url: "", isVisible: false }
      });
    } else {
      // Si existe pero no tiene alguno de los campos, actualizarlo
      const updates = {};
      
      if (config.whatsappNumber === undefined) {
        updates.whatsappNumber = "";
      }
      
      if (config.address === undefined) {
        updates.address = "";
      }
      
      if (config.googleMapsUrl === undefined) {
        updates.googleMapsUrl = "";
      }
      
      if (Object.keys(updates).length > 0) {
        config = await BusinessConfig.findOneAndUpdate(
          {},
          { $set: updates },
          { new: true }
        );
      }
    }
    
    console.log("Esquema actualizado:", config);
    res.json(config);
  } catch (error) {
    console.error("Error al reparar el esquema:", error);
    res.status(500).json({ message: "Error al reparar el esquema" });
  }
});

// Endpoint para actualizar isActive (activar/desactivar negocio desde superadmin)
router.put("/active", async (req, res) => {
    const { businessId, isActive } = req.body;
    if (!businessId || typeof isActive !== 'boolean') {
      return res.status(400).json({ message: "businessId y isActive son requeridos" });
    }
    
    try {
      // Buscar por _id o slug usando el helper
      const business = await findBusinessByIdentifier(businessId);
      
      if (!business) {
        return res.status(404).json({ message: 'Negocio no encontrado' });
      }
      
      // Actualizar usando el _id encontrado
      const config = await BusinessConfig.findByIdAndUpdate(
        business._id,
        { isActive },
        { new: true }
      );
      
      // Emitir evento de WebSocket a los clientes del negocio
      emitToBusiness(business._id.toString(), "business_status_update", { isActive });
      
      res.json(config);
    } catch (error) {
      console.error(`Error al actualizar el estado activo del negocio ${businessId}:`, error);
      res.status(500).json({ 
        message: 'Error al actualizar el estado activo del negocio',
        error: error.message 
      });
    }
});

// Obtener negocio por slug
router.get("/by-slug/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ message: "slug requerido" });
  }
  
  try {
    const config = await BusinessConfig.findOne({ slug });
    
    if (!config) {
      return res.status(404).json({ 
        message: 'Negocio no encontrado',
        detail: `No se encontró un negocio con el slug '${slug}'`
      });
    }
    
    res.json(config);
  } catch (error) {
    console.error(`Error al obtener la configuración del negocio con slug ${slug}:`, error);
    res.status(500).json({ 
      message: 'Error al obtener la configuración del negocio',
      error: error.message 
    });
  }
});

module.exports = router;
