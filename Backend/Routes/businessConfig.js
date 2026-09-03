const express = require("express");
const router = express.Router();
const BusinessConfig = require("../Models/BusinessConfig");
const eventService = require('../services/eventService');
const { emitToBusiness, printEmitter } = require("../services/socketService");
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

/**
 * Avisa al agente de impresión que cambió algo que afecta al ticket.
 *
 * El agente lee esta configuración al conectarse y puede quedarse conectado
 * durante días, así que sin este aviso el negocio activaba el QR en el panel
 * y el recibo seguía saliendo igual hasta reiniciar el agente. Va envuelto en
 * try porque un fallo acá no puede tumbar el guardado de la configuración.
 */
function notificarAgenteDeImpresion(config) {
  try {
    if (!config?._id) return;
    const base = (process.env.FRONTEND_URL || 'https://menuby.tech').replace(/\/$/, '');
    printEmitter.emit(`settings:${config._id.toString()}`, {
      showQR: config.printerSettings?.showQR !== false,
      menuUrl: config.slug ? `${base}/${config.slug}` : '',
      printMode: config.printAgentMode || 'both'
    });
  } catch (e) {
    logger.warn('No se pudo avisar al agente de impresión', { error: e.message });
  }
}

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
      
      /* Este endpoint es público: lo consulta cualquiera que abra un menú.
         printAgentKey es la credencial del stream de impresión — con ella se
         puede abrir el flujo de pedidos en vivo de un negocio y leer nombres,
         teléfonos y direcciones de sus clientes. No puede salir de aquí.
         El panel la obtiene por GET /api/print-agent/key, que sí exige sesión. */
      const publico = config?.toObject ? config.toObject() : { ...config };
      delete publico.printAgentKey;

      res.json(publico);
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

      /* Si cambió algo que le importa a la impresora, avisarle al agente en
         caliente. Antes el agente solo leía esto al conectarse, así que
         activar el QR no tenía efecto hasta reiniciarlo. */
      if (updateData.printerSettings !== undefined || updateData.slug !== undefined) {
        notificarAgenteDeImpresion(config);
      }

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

/* GET /api/business-config/discover — red de descubrimiento MenuBy
 *
 * Params: lat, lng (opcional), exclude (slug a omitir), limit, radiusKm
 *
 * Con ubicación se muestran SOLO los que están dentro del radio. Antes se
 * ordenaba por distancia pero no se filtraba, así que bajo el título "cerca de
 * ti" aparecían negocios a 1.000 km y otros sin coordenadas: para el comensal
 * era ruido, y para el negocio listado, tráfico que nunca iba a convertir.
 */
// Radio por defecto: cubre un área metropolitana sin llegar a la ciudad vecina.
const DISCOVER_RADIUS_KM = 30;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

router.get("/discover", async (req, res) => {
  try {
    const { lat, lng, exclude } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 12, 30);
    const hasGeo = lat != null && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

    const businesses = await BusinessConfig.find(
      { isActive: true, menuStatus: { $ne: 'paused' }, showInMarketplace: { $ne: false } },
      'slug businessName logo coverImage description businessType city department location.coordinates google.rating google.reviewCount businessHours updatedAt'
    ).lean();

    const cLat = hasGeo ? parseFloat(lat) : null;
    const cLng = hasGeo ? parseFloat(lng) : null;

    let list = businesses
      .filter(b => b.slug && b.slug !== exclude)
      .map(b => {
        const coords = b.location?.coordinates;
        let distanceKm = null;
        if (hasGeo && coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
          distanceKm = Math.round(haversineKm(cLat, cLng, coords.lat, coords.lng) * 10) / 10;
        }
        return {
          slug: b.slug,
          businessName: b.businessName,
          logo: b.logo || null,
          coverImage: b.coverImage || null,
          businessType: b.businessType || null,
          city: b.city || '',
          rating: b.google?.rating ?? null,
          reviewCount: b.google?.reviewCount ?? 0,
          distanceKm,
          businessHours: b.businessHours || null,
        };
      });

    /* Con ubicación: solo los que están dentro del radio, ordenados por
       cercanía. Si no hay ninguno se devuelve vacío y la sección no aparece —
       recomendar un negocio de otra ciudad no le sirve a nadie. Los que no
       tienen coordenadas quedan fuera: no se puede afirmar que estén cerca. */
    let cercanos = false;
    if (hasGeo) {
      const radio = Math.min(Math.max(parseFloat(req.query.radiusKm) || DISCOVER_RADIUS_KM, 1), 500);
      list = list.filter(b => b.distanceKm != null && b.distanceKm <= radio);
      list.sort((a, b) => a.distanceKm - b.distanceKm);
      cercanos = true;
    } else {
      /* Sin ubicación no hay forma de saber qué está cerca. Se muestran los
         mejor valorados, sin afirmar cercanía. */
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ businesses: list.slice(0, limit), cercanos });
  } catch (error) {
    logger.error('Error en descubrimiento MenuBy', error, req);
    res.status(500).json({ businesses: [] });
  }
});

module.exports = router;
