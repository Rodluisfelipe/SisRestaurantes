const express = require("express");
const router = express.Router();
const WhatsAppTemplate = require("../Models/WhatsAppTemplate");
const { validateAndResolveBusinessId } = require("../utils/businessValidator");
const { isValidObjectId } = require("../utils/validators");
const logger = require("../utils/logger");

/**
 * API de Templates de WhatsApp
 *
 * Proporciona endpoints para:
 * - GET /api/whatsapp-templates: Obtener template del negocio
 * - POST /api/whatsapp-templates: Crear/actualizar template
 * - DELETE /api/whatsapp-templates: Restaurar template por defecto
 */

// GET - Obtener template de WhatsApp para un negocio
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    // Validar y resolver businessId
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    let template = await WhatsAppTemplate.findOne({ businessId: businessObjectId });
    
    // Si no existe template, crear uno por defecto
    if (!template) {
      template = new WhatsAppTemplate({
        businessId: businessObjectId
      });
      await template.save();
      logger.info(`Created default WhatsApp template for business ${businessId}`);
    }
    
    res.json(template);
  } catch (error) {
    logger.error("Error getting WhatsApp template", error);
    res.status(500).json({ message: error.message });
  }
});

// POST - Crear o actualizar template de WhatsApp
router.post("/", async (req, res) => {
  try {
    const { businessId, messageTemplate, settings, availableVariables } = req.body;
    
    if (!businessId || !messageTemplate) {
      return res.status(400).json({ message: "businessId y messageTemplate son requeridos" });
    }
    
    // Validar y resolver businessId
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    // Buscar template existente o crear nuevo
    let template = await WhatsAppTemplate.findOne({ businessId: businessObjectId });
    
    if (template) {
      // Actualizar existente
      template.messageTemplate = messageTemplate;
      if (settings) template.settings = { ...template.settings, ...settings };
      if (availableVariables) template.availableVariables = new Map(Object.entries(availableVariables));
    } else {
      // Crear nuevo
      template = new WhatsAppTemplate({
        businessId: businessObjectId,
        messageTemplate,
        settings: settings || {},
        availableVariables: availableVariables ? new Map(Object.entries(availableVariables)) : undefined
      });
    }
    
    const savedTemplate = await template.save();
    
    logger.info(`Updated WhatsApp template for business ${businessId}`);
    res.json(savedTemplate);
  } catch (error) {
    logger.error("Error saving WhatsApp template", error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE - Restaurar template por defecto
router.delete("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    // Validar y resolver businessId
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    // Eliminar template existente
    await WhatsAppTemplate.findOneAndDelete({ businessId: businessObjectId });
    
    // Crear nuevo template por defecto
    const defaultTemplate = new WhatsAppTemplate({
      businessId: businessObjectId
    });
    
    const savedTemplate = await defaultTemplate.save();
    
    logger.info(`Reset WhatsApp template to default for business ${businessId}`);
    res.json(savedTemplate);
  } catch (error) {
    logger.error("Error resetting WhatsApp template", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
