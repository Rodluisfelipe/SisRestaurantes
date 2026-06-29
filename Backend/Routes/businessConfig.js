const express = require("express");
const router = express.Router();
const BusinessConfig = require("../Models/BusinessConfig");
const eventService = require('../services/eventService');
const { emitToBusiness } = require("../services/socketService");
const { resolveBusiness, resolveBusinessId } = require("../utils/businessResolver");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");
const { audit } = require("../utils/auditLog");
const {
  validateUpdateConfig,
  validateUpdateStatus,
  validateFixSchema,
  validateUpdateActive,
  validateUpdateHours,
  validateUpdateMenuStatus,
  validateUpdateConfigById,
} = require('../middleware/validators/businessConfigValidators');

// Obtener la configuración
router.get("/", async (req, res) => {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json({ message: "businessId requerido" });
    }
    
    try {
      // Buscar por _id o slug usando el helper
      let config;
      try {
        config = await resolveBusiness(businessId);
      } catch (error) {
        return res.status(404).json({ 
          message: 'Negocio no encontrado', 
          detail: error.message 
        });
      }
      
      res.json(config);
    } catch (error) {
      logger.error(`Error obteniendo configuración del negocio`, error, req);
      res.status(500).json(formatHttpError(req, 'Error al obtener la configuración del negocio', 500));
    }
});

// Actualizar la configuración (por businessId en body)
router.put("/", tenantAuth, validateUpdateConfig, async (req, res) => {
    const { businessId, ...updateData } = req.body;
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    // Block internal/sensitive fields (same blacklist as PUT /:businessId)
    delete updateData._id;
    delete updateData.isActive;       // Only SA can activate/deactivate
    delete updateData.slug;           // Prevent slug squatting
    delete updateData.reviewStats;    // Calculated server-side only
    delete updateData.subscriptionStatus; // Only payment webhooks can change
    delete updateData.subscriptionPlan;   // Only payment webhooks can change
    delete updateData.planType;           // Only payment webhooks can change
    delete updateData.periodEnd;          // Only payment webhooks can change
    delete updateData.graceUntil;         // Only payment webhooks can change
    delete updateData.referralCode;       // Only referral system can set
    delete updateData.referralCredits;    // Only referral system can set
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    
    try {
      logger.debug('Actualizando configuración de negocio', { businessId }, req);
      
      // Buscar por _id o slug usando el helper
      let business;
      try {
        business = await resolveBusiness(businessId);
      } catch (error) {
        return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404, { detail: error.message }));
      }
      
      // Asegurarse de que los campos address y googleMapsUrl están presentes
      if (updateData.address === undefined) {
        updateData.address = "";
      }
      
      if (updateData.googleMapsUrl === undefined) {
        updateData.googleMapsUrl = "";
      }
      
      // Actualizar usando el _id encontrado
      logger.debug('updateData being saved', { fields: Object.keys(updateData), paymentMethods: updateData.paymentMethods }, req);
      const AUDIT_FIELDS = ['businessName','theme','orderingMode','paymentMethods','whatsappNumber','address','businessHours','isOpen','menuStatus','businessType','socialMedia','extraLink','slug'];
      const beforeSnap = {};
      AUDIT_FIELDS.forEach(k => { if (business[k] !== undefined) beforeSnap[k] = business[k]; });

      const config = await BusinessConfig.findByIdAndUpdate(
        business._id,
        { $set: updateData },
        { new: true }
      );

      const afterSnap = {};
      AUDIT_FIELDS.forEach(k => { if (updateData[k] !== undefined) afterSnap[k] = updateData[k]; });

      audit({
        action: 'update',
        resource: 'businessConfig',
        resourceId: business._id,
        resourceName: business.businessName,
        businessId: business._id,
        businessName: business.businessName,
        before: beforeSnap,
        after: afterSnap,
        req,
      });

      logger.info('Configuración actualizada', { businessId: config._id }, req);
      res.json(config);
    } catch (error) {
      logger.error(`Error actualizando configuración`, error, req);
      res.status(500).json(formatHttpError(req, 'Error al actualizar la configuración del negocio', 500));
    }
});

// Ruta específica para actualizar solo el estado del negocio (para actualizaciones rápidas)
router.put("/status", tenantAuth, validateUpdateStatus, async (req, res) => {
  try {
    const { isOpen, businessId } = req.body;
    
    if (isOpen === undefined) {
      return res.status(400).json({ message: "Se requiere el estado del negocio" });
    }
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }

    let business;
    try {
      business = await resolveBusiness(businessId);
    } catch (error) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    
    const config = await BusinessConfig.findByIdAndUpdate(
      business._id,
      { isOpen },
      { new: true }
    );

    audit({
      action: 'toggle',
      resource: 'businessConfig',
      resourceId: business._id,
      resourceName: business.businessName,
      businessId: business._id,
      businessName: business.businessName,
      before: { isOpen: business.isOpen },
      after: { isOpen },
      req,
    });

    res.json(config);
  } catch (error) {
    logger.error("Error actualizando estado del negocio", error, req);
    res.status(500).json(formatHttpError(req, "Error al actualizar el estado del negocio", 500));
  }
});

// Ruta específica para actualizar/reparar el esquema
router.post("/fix-schema", tenantAuth, validateFixSchema, async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }

    let business;
    try {
      business = await resolveBusiness(businessId);
    } catch (error) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }

    // Buscar la configuración existente
    let config = business;
    
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
    
    logger.info('Schema fixed/updated', null, req);
    res.json(config);
  } catch (error) {
    logger.error("Error reparando esquema", error, req);
    res.status(500).json(formatHttpError(req, "Error al reparar el esquema", 500));
  }
});

// Endpoint para actualizar isActive (activar/desactivar negocio desde superadmin)
router.put("/active", tenantAuth, validateUpdateActive, async (req, res) => {
    const { businessId, isActive } = req.body;
    if (!businessId || typeof isActive !== 'boolean') {
      return res.status(400).json({ message: "businessId y isActive son requeridos" });
    }
    
    try {
      // Buscar por _id o slug usando el helper
      const business = await resolveBusiness(businessId);
      
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

      audit({
        action: 'toggle',
        resource: 'businessConfig',
        resourceId: business._id,
        resourceName: business.businessName,
        businessId: business._id,
        businessName: business.businessName,
        before: { isActive: business.isActive },
        after: { isActive },
        req,
      });

      res.json(config);
    } catch (error) {
      logger.error('Error actualizando estado activo del negocio', error, req);
      res.status(500).json(formatHttpError(req, 'Error al actualizar el estado activo del negocio', 500));
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
    logger.error('Error obteniendo configuración por slug', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la configuración del negocio', 500));
  }
});

// Obtener estado del negocio (horarios + menú)
router.get("/status/:businessId", async (req, res) => {
  const { businessId } = req.params;
  
  try {
    const business = await resolveBusiness(businessId);
    
    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }
    
    const status = business.getBusinessStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error obteniendo estado del negocio', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener el estado del negocio', 500));
  }
});

// Actualizar horarios del negocio
router.put("/hours", tenantAuth, validateUpdateHours, async (req, res) => {
  const { businessId, businessHours } = req.body;
  
  if (!businessId || !businessHours) {
    return res.status(400).json({ message: "businessId y businessHours son requeridos" });
  }
  
  try {
    const business = await resolveBusiness(businessId);
    
    if (!business) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    
    // Validar estructura de horarios
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validatedHours = {};
    
    validDays.forEach(day => {
      if (businessHours[day]) {
        validatedHours[day] = {
          isOpen: Boolean(businessHours[day].isOpen),
          openTime: businessHours[day].openTime || "08:00",
          closeTime: businessHours[day].closeTime || "22:00"
        };
      } else {
        validatedHours[day] = {
          isOpen: true,
          openTime: "08:00",
          closeTime: "22:00"
        };
      }
    });
    
    const config = await BusinessConfig.findByIdAndUpdate(
      business._id,
      { businessHours: validatedHours },
      { new: true }
    );
    
    // Emitir evento de WebSocket
    emitToBusiness(business._id.toString(), "business_hours_update", { businessHours: validatedHours });

    audit({
      action: 'update',
      resource: 'businessConfig',
      resourceId: business._id,
      resourceName: business.businessName,
      businessId: business._id,
      businessName: business.businessName,
      before: { businessHours: business.businessHours },
      after: { businessHours: validatedHours },
      req,
    });

    logger.info('Business hours updated', { businessId }, req);
    res.json(config);
  } catch (error) {
    logger.error('Error actualizando horarios del negocio', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar horarios del negocio', 500));
  }
});

// Actualizar estado del menú (pausar/activar)
router.put("/menu-status", tenantAuth, validateUpdateMenuStatus, async (req, res) => {
  const { businessId, menuStatus } = req.body;
  
  if (!businessId || !menuStatus) {
    return res.status(400).json({ message: "businessId y menuStatus son requeridos" });
  }
  
  if (!['active', 'paused'].includes(menuStatus)) {
    return res.status(400).json({ message: "menuStatus debe ser 'active' o 'paused'" });
  }
  
  try {
    const business = await resolveBusiness(businessId);
    
    if (!business) {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    
    const config = await BusinessConfig.findByIdAndUpdate(
      business._id,
      { menuStatus },
      { new: true }
    );
    
    // Emitir evento de WebSocket
    emitToBusiness(business._id.toString(), "menu_status_update", { menuStatus });

    audit({
      action: 'toggle',
      resource: 'businessConfig',
      resourceId: business._id,
      resourceName: business.businessName,
      businessId: business._id,
      businessName: business.businessName,
      before: { menuStatus: business.menuStatus },
      after: { menuStatus },
      req,
    });

    logger.info('Menu status updated', { businessId, menuStatus }, req);
    res.json(config);
  } catch (error) {
    logger.error('Error actualizando estado del menú', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar estado del menú', 500));
  }
});

// Actualizar la configuración (por businessId en URL)
// IMPORTANTE: Esta ruta debe estar AL FINAL porque captura cualquier PUT con un parámetro
router.put("/:businessId", tenantAuth, validateUpdateConfigById, async (req, res) => {
    const { businessId } = req.params;
    const updateData = { ...req.body };
    
    // Block internal/sensitive fields that admins should not modify directly
    delete updateData._id;
    delete updateData.isActive;       // Only SA can activate/deactivate
    delete updateData.slug;           // Prevent slug squatting
    delete updateData.reviewStats;    // Calculated server-side only
    delete updateData.subscriptionStatus; // Only payment webhooks can change
    delete updateData.subscriptionPlan;   // Only payment webhooks can change
    delete updateData.planType;           // Only payment webhooks can change
    delete updateData.periodEnd;          // Only payment webhooks can change
    delete updateData.graceUntil;         // Only payment webhooks can change
    delete updateData.referralCode;       // Only referral system can set
    delete updateData.referralCredits;    // Only referral system can set
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    try {
      logger.debug('Actualizando configuración (URL param)', { businessId }, req);
      
      // Buscar por _id o slug usando el helper
      let business;
      try {
        business = await resolveBusiness(businessId);
      } catch (error) {
        return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404, { detail: error.message }));
      }
      
      const AUDIT_FIELDS = ['businessName','theme','orderingMode','paymentMethods','whatsappNumber','address','businessHours','isOpen','menuStatus','businessType','socialMedia','extraLink'];
      const beforeSnap = {};
      AUDIT_FIELDS.forEach(k => { if (business[k] !== undefined) beforeSnap[k] = business[k]; });

      // Actualizar usando el _id encontrado
      const config = await BusinessConfig.findByIdAndUpdate(
        business._id,
        updateData,
        { new: true, runValidators: true }
      );

      const afterSnap = {};
      AUDIT_FIELDS.forEach(k => { if (updateData[k] !== undefined) afterSnap[k] = updateData[k]; });

      audit({
        action: 'update',
        resource: 'businessConfig',
        resourceId: business._id,
        resourceName: business.businessName,
        businessId: business._id,
        businessName: business.businessName,
        before: beforeSnap,
        after: afterSnap,
        req,
      });

      logger.info('Configuración actualizada (URL param)', { businessId: config._id }, req);
      res.json(config);
    } catch (error) {
      logger.error('Error actualizando configuración (URL param)', error, req);
      res.status(500).json(formatHttpError(req, 'Error al actualizar la configuración del negocio', 500));
    }
});

// GET /api/business-config/catalog - Listar todos los negocios activos (para sitemap/SEO)
router.get("/catalog", async (req, res) => {
  try {
    const businesses = await BusinessConfig.find(
      { isActive: true },
      'slug businessName logo description city department updatedAt'
    ).sort({ updatedAt: -1 }).lean();
    
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(businesses);
  } catch (error) {
    logger.error('Error obteniendo catálogo de negocios', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener el catálogo', 500));
  }
});

module.exports = router;
