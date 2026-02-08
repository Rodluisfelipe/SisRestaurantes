const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const DeliveryZone = require("../Models/DeliveryZone");
const authMiddleware = require("../middleware/authMiddleware");
const { 
  findCoverageForPoint,
  validateDeliveryForOrder,
  getZonesWithStats,
  validateZoneData
} = require("../services/deliveryZoneService");
const { 
  geocodeAddress, 
  reverseGeocode,
  getCacheStats 
} = require("../utils/geocoding");
const { validatePolygon } = require("../utils/geospatial");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");

// Rate limiting para geocodificación y zonas (previene abuso de APIs externas)
const rateLimit = require('express-rate-limit');
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 peticiones por minuto
  message: { success: false, message: 'Demasiadas peticiones de geocodificación. Intenta de nuevo en un minuto.' }
});
const zoneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' }
});

// ============================================
// GEOCODIFICACIÓN (DEBE IR ANTES DE LAS RUTAS CON :id)
// ============================================

/**
 * GET /api/delivery-zones/geocode
 * Convertir dirección a coordenadas (vía query params)
 */
router.get("/geocode", geocodeLimiter, async (req, res) => {
  try {
    const { address, country } = req.query;
    
    if (!address) {
      return res.status(400).json(
        formatHttpError(req, "Se requiere una dirección", 400)
      );
    }
    
    const results = await geocodeAddress(address, country);
    
    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error("Error en geocodificación", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error en geocodificación", 500));
  }
});

/**
 * POST /api/delivery-zones/geocode
 * Convertir dirección a coordenadas (vía body)
 */
router.post("/geocode", geocodeLimiter, async (req, res) => {
  try {
    const { address, country } = req.body;
    
    if (!address) {
      return res.status(400).json(
        formatHttpError(req, "Se requiere una dirección", 400)
      );
    }
    
    const results = await geocodeAddress(address, country);
    
    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error("Error en geocodificación", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error en geocodificación", 500));
  }
});

/**
 * GET /api/delivery-zones/reverse-geocode
 * Convertir coordenadas a dirección (vía query params)
 */
router.get("/reverse-geocode", geocodeLimiter, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json(
        formatHttpError(req, "Se requieren latitud y longitud", 400)
      );
    }
    
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error("Error en geocodificación inversa", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error en geocodificación inversa", 500));
  }
});

/**
 * POST /api/delivery-zones/reverse-geocode
 * Convertir coordenadas a dirección (vía body)
 */
router.post("/reverse-geocode", geocodeLimiter, async (req, res) => {
  try {
    const { lat, lon } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json(
        formatHttpError(req, "Se requieren latitud y longitud", 400)
      );
    }
    
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error("Error en geocodificación inversa", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error en geocodificación inversa", 500));
  }
});

/**
 * GET /api/delivery-zones/geocode/stats
 * Obtener estadísticas del cache de geocodificación
 */
router.get("/geocode/stats", async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error("Error al obtener stats", error, req);
    res.status(500).json(formatHttpError(req, error.message || "Error al obtener stats", 500));
  }
});

// ============================================
// VERIFICACIÓN DE COBERTURA (Público/Cliente)
// ============================================

/**
 * POST /api/delivery-zones/check-coverage
 * Verificar cobertura para un punto específico
 */
router.post("/check-coverage", zoneLimiter, async (req, res) => {
  try {
    logger.info("POST /delivery-zones/check-coverage recibido");
    
    const { businessId, lat, lon, orderTotal } = req.body;
    logger.debug("check-coverage datos", { businessId, lat, lon, hasOrderTotal: orderTotal !== undefined });
    
    if (!businessId) {
      logger.warn("check-coverage sin businessId", null, req);
      return res.status(400).json(
        formatHttpError(req, "Se requiere el ID del negocio", 400)
      );
    }
    
    if (!lat || !lon) {
      logger.warn("check-coverage sin coordenadas", null, req);
      return res.status(400).json(
        formatHttpError(req, "Se requieren las coordenadas (lat, lon)", 400)
      );
    }
    
    const point = { lat: parseFloat(lat), lon: parseFloat(lon) };
    if (process.env.NODE_ENV !== 'production') logger.debug("Punto a verificar", point);
    
    // Si se proporciona orderTotal, validar el pedido completo
    if (orderTotal !== undefined) {
      logger.debug("Validando pedido con orderTotal", { hasOrderTotal: true });
      const validation = await validateDeliveryForOrder(businessId, point, parseFloat(orderTotal));
      if (process.env.NODE_ENV !== 'production') logger.debug("Resultado de validación", validation);
      
      return res.json({
        success: true,
        ...validation
      });
    }
    
    // Solo verificar cobertura
    logger.debug("Verificando cobertura sin orderTotal");
    const coverage = await findCoverageForPoint(businessId, point);
    if (process.env.NODE_ENV !== 'production') logger.debug("Cobertura encontrada", coverage);
    
    res.json({
      success: true,
      ...coverage
    });
  } catch (error) {
    logger.error("ERROR en check-coverage", error, req);
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json(formatHttpError(
      req,
      "Error al verificar la cobertura",
      500,
      isDev ? { stack: error.stack } : undefined
    ));
  }
});

// ============================================
// CRUD DE ZONAS DE ENTREGA (Admin)
// ============================================

/**
 * GET /api/delivery-zones
 * Obtener todas las zonas de entrega del negocio
 */
router.get("/", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    logger.info("GET /delivery-zones");
    
    // Obtener businessId del token, query param, o del admin
    let businessId = req.user.businessId || req.query.businessId;
    logger.debug("businessId inicial", { businessId });
    
    // Si es un token temporal de SuperAdmin, el businessId debe venir en el query
    if (req.user.isTempToken && !businessId) {
      logger.warn("Token temporal sin businessId", null, req);
      return res.status(400).json(
        formatHttpError(req, "businessId es requerido para tokens temporales de SuperAdmin", 400)
      );
    }
    
    if (!businessId && req.user.id) {
      // Fallback: buscar el admin y obtener su businessId
      logger.debug("Buscando businessId del admin", { adminId: req.user.id });
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      logger.debug("Admin encontrado", { adminFound: !!admin });
      if (admin && admin.businessId) {
        businessId = admin.businessId;
        logger.debug("businessId resuelto del admin");
      }
    }
    
    logger.debug("businessId final", { businessId }, req);
    
    if (!businessId) {
      logger.warn("No se pudo determinar businessId", null, req);
      return res.status(400).json(
        formatHttpError(req, "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo.", 400)
      );
    }
    
    logger.info("Obteniendo zonas para businessId", { businessId });
    const zones = await getZonesWithStats(businessId);
    logger.info("Zonas encontradas", { total: zones.length });
    
    res.json({
      success: true,
      zones,
      total: zones.length
    });
  } catch (error) {
    logger.error("Error al obtener zonas", process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json(formatHttpError(req, "Error al obtener las zonas de entrega", 500));
  }
});

/**
 * GET /api/delivery-zones/:id
 * Obtener una zona específica
 */
router.get("/:id", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;
    
    const zone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json(
        formatHttpError(req, "Zona no encontrada", 404)
      );
    }
    
    res.json({
      success: true,
      zone
    });
  } catch (error) {
    logger.error("Error al obtener zona", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener la zona", 500));
  }
});

// Validación de entrada para crear zona de entrega
const validateDeliveryZoneInput = (req, res, next) => {
  const errors = [];
  const { name, type, geometry, pricing } = req.body;
  
  // Validar name
  if (!name) {
    errors.push({ field: 'name', message: 'name es requerido' });
  } else if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name debe ser un string no vacío' });
  }
  
  // Validar type
  const validTypes = ['polygon', 'radius'];
  if (!type) {
    errors.push({ field: 'type', message: 'type es requerido' });
  } else if (!validTypes.includes(type)) {
    errors.push({ field: 'type', message: `type debe ser uno de: ${validTypes.join(', ')}` });
  }
  
  // Validar geometry según type
  if (!geometry) {
    errors.push({ field: 'geometry', message: 'geometry es requerido' });
  } else {
    if (type === 'polygon') {
      if (!geometry.type || geometry.type !== 'Polygon') {
        errors.push({ field: 'geometry.type', message: 'Para type="polygon", geometry.type debe ser "Polygon"' });
      }
      if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
        errors.push({ field: 'geometry.coordinates', message: 'geometry.coordinates debe ser un array' });
      } else if (geometry.coordinates.length === 0) {
        errors.push({ field: 'geometry.coordinates', message: 'geometry.coordinates no puede estar vacío' });
      }
    } else if (type === 'radius') {
      if (!geometry.type || geometry.type !== 'Point') {
        errors.push({ field: 'geometry.type', message: 'Para type="radius", geometry.type debe ser "Point"' });
      }
      if (!geometry.coordinates || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) {
        errors.push({ field: 'geometry.coordinates', message: 'Para type="radius", geometry.coordinates debe ser [lon, lat]' });
      } else {
        const [lon, lat] = geometry.coordinates;
        if (typeof lon !== 'number' || typeof lat !== 'number' || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          errors.push({ field: 'geometry.coordinates', message: 'Coordenadas inválidas: lat entre -90 y 90, lon entre -180 y 180' });
        }
      }
      if (typeof geometry.radius !== 'number' || geometry.radius <= 0) {
        errors.push({ field: 'geometry.radius', message: 'geometry.radius debe ser un número > 0 para type="radius"' });
  }
    }
  }
  
  // Validar pricing (opcional pero si existe debe tener estructura válida)
  if (pricing !== undefined && pricing !== null) {
    if (typeof pricing !== 'object') {
      errors.push({ field: 'pricing', message: 'pricing debe ser un objeto' });
    } else {
      if (pricing.fixedFee !== undefined && (typeof pricing.fixedFee !== 'number' || pricing.fixedFee < 0)) {
        errors.push({ field: 'pricing.fixedFee', message: 'pricing.fixedFee debe ser un número >= 0' });
      }
      if (pricing.minOrderValue !== undefined && (typeof pricing.minOrderValue !== 'number' || pricing.minOrderValue < 0)) {
        errors.push({ field: 'pricing.minOrderValue', message: 'pricing.minOrderValue debe ser un número >= 0' });
      }
      if (pricing.distanceFee !== undefined && (typeof pricing.distanceFee !== 'number' || pricing.distanceFee < 0)) {
        errors.push({ field: 'pricing.distanceFee', message: 'pricing.distanceFee debe ser un número >= 0' });
      }
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

/**
 * POST /api/delivery-zones
 * Crear nueva zona de entrega
 */
router.post("/", authMiddleware, zoneLimiter, validateDeliveryZoneInput, async (req, res) => {
  try {
    logger.info("POST /delivery-zones");
    
    let businessId = req.user.businessId || req.body.businessId;
    logger.debug("businessId inicial", { businessId });
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      logger.debug("Buscando businessId del admin", { adminId: req.user.id });
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      logger.debug("Admin encontrado", { adminFound: !!admin });
      if (admin && admin.businessId) {
        businessId = admin.businessId;
        logger.debug("businessId resuelto del admin");
      }
    }
    
    logger.debug("businessId final", { businessId });
    
    if (!businessId) {
      return res.status(400).json(
        formatHttpError(req, "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo.", 400)
      );
    }
    
    const zoneData = req.body;
    
    // Normalizar datos del círculo (el frontend envía type: 'radius' pero geometry.type: 'Point')
    if (zoneData.type === 'radius' && zoneData.geometry) {
      zoneData.geometry.type = 'Point';
    }
    
    // Validar datos
    const validation = validateZoneData(zoneData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Datos de zona inválidos",
        errors: validation.errors
      });
    }
    
    // Validar polígono si es tipo polygon
    if (zoneData.type === 'polygon' && zoneData.geometry && zoneData.geometry.coordinates) {
      const polygonValidation = validatePolygon(zoneData.geometry.coordinates);
      if (!polygonValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: polygonValidation.error
        });
      }
    }
    
    if (process.env.NODE_ENV !== 'production') logger.debug("Datos que se van a guardar", zoneData);
    
    // Crear zona
    const newZone = new DeliveryZone({
      ...zoneData,
      businessId: new mongoose.Types.ObjectId(businessId)
    });
    
    logger.info("Guardando zona");
    await newZone.save();
    logger.info("Zona guardada exitosamente", { zoneId: newZone._id.toString() });
    
    res.status(201).json({
      success: true,
      message: "Zona de entrega creada exitosamente",
      zone: newZone
    });
  } catch (error) {
    logger.error("Error al crear zona", process.env.NODE_ENV !== 'production' ? error : undefined);
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json(formatHttpError(
      req,
      "Error al crear la zona de entrega",
      500,
      isDev ? { stack: error.stack } : undefined
    ));
  }
});

/**
 * PUT /api/delivery-zones/:id
 * Actualizar zona de entrega
 */
router.put("/:id", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    let businessId = req.user.businessId || req.body.businessId || req.query.businessId;
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.businessId) {
        businessId = admin.businessId;
      }
    }
    
    // Requerir businessId cuando sea un token temporal de SuperAdmin
    if (req.user.isTempToken && !businessId) {
      return res.status(400).json(
        formatHttpError(req, "businessId es requerido para tokens temporales de SuperAdmin", 400)
      );
    }
    
    if (!businessId) {
      return res.status(400).json(
        formatHttpError(req, "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo.", 400)
      );
    }
    
    const updateData = req.body;
    
    // Normalizar datos del círculo (el frontend envía type: 'radius' pero geometry.type: 'Point')
    if (updateData.type === 'radius' && updateData.geometry) {
      updateData.geometry.type = 'Point';
    }
    
    // Buscar zona
    const zone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json(
        formatHttpError(req, "Zona no encontrada", 404)
      );
    }
    
    // Validar datos si se están actualizando campos críticos
    if (updateData.geometry || updateData.pricing || updateData.type) {
      const dataToValidate = {
        ...zone.toObject(),
        ...updateData
      };
      
      const validation = validateZoneData(dataToValidate);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: "Datos de zona inválidos",
          errors: validation.errors
        });
      }
    }
    
    // Validar polígono si se está actualizando
    if (updateData.geometry && updateData.type === 'polygon' && updateData.geometry.coordinates) {
      const polygonValidation = validatePolygon(updateData.geometry.coordinates);
      if (!polygonValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: polygonValidation.error
        });
      }
    }
    
    // Actualizar zona
    Object.assign(zone, updateData);
    await zone.save();
    
    res.json({
      success: true,
      message: "Zona actualizada exitosamente",
      zone
    });
  } catch (error) {
    logger.error("Error al actualizar zona", error, req);
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json(formatHttpError(
      req,
      "Error al actualizar la zona",
      500,
      isDev ? { stack: error.stack } : undefined
    ));
  }
});

/**
 * DELETE /api/delivery-zones/:id
 * Eliminar zona de entrega
 */
router.delete("/:id", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    let businessId = req.user.businessId || req.body.businessId || req.query.businessId;
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.businessId) {
        businessId = admin.businessId;
      }
    }
    
    // Requerir businessId cuando sea un token temporal de SuperAdmin
    if (req.user.isTempToken && !businessId) {
      return res.status(400).json(
        formatHttpError(req, "businessId es requerido para tokens temporales de SuperAdmin", 400)
      );
    }
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar el negocio."
      });
    }
    
    const zone = await DeliveryZone.findOneAndDelete({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json(
        formatHttpError(req, "Zona no encontrada", 404)
      );
    }
    
    res.json({
      success: true,
      message: "Zona eliminada exitosamente"
    });
  } catch (error) {
    logger.error("Error al eliminar zona", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar la zona", 500));
  }
});

/**
 * PATCH /api/delivery-zones/:id/toggle
 * Activar/desactivar zona
 */
router.patch("/:id/toggle", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    let businessId = req.user.businessId || req.body.businessId || req.query.businessId;
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.businessId) {
        businessId = admin.businessId;
      }
    }
    
    // Requerir businessId cuando sea un token temporal de SuperAdmin
    if (req.user.isTempToken && !businessId) {
      return res.status(400).json(
        formatHttpError(req, "businessId es requerido para tokens temporales de SuperAdmin", 400)
      );
    }
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar el negocio."
      });
    }
    
    const zone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json(
        formatHttpError(req, "Zona no encontrada", 404)
      );
    }
    
    zone.isActive = !zone.isActive;
    await zone.save();
    
    res.json({
      success: true,
      message: `Zona ${zone.isActive ? 'activada' : 'desactivada'} exitosamente`,
      zone
    });
  } catch (error) {
    logger.error("Error al cambiar estado de zona", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar el estado de la zona", 500));
  }
});

// ============================================
// DUPLICAR ZONA
// ============================================

/**
 * POST /api/delivery-zones/:id/duplicate
 * Duplicar una zona existente
 */
router.post("/:id/duplicate", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    let businessId = req.user.businessId;
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      if (admin && admin.businessId) {
        businessId = admin.businessId;
      }
    }
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar el negocio."
      });
    }
    
    const originalZone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!originalZone) {
      return res.status(404).json(
        formatHttpError(req, "Zona no encontrada", 404)
      );
    }
    
    // Crear copia
    const zoneData = originalZone.toObject();
    delete zoneData._id;
    delete zoneData.createdAt;
    delete zoneData.updatedAt;
    delete zoneData.stats;
    
    zoneData.name = `${zoneData.name} (Copia)`;
    zoneData.priority = originalZone.priority + 1;
    
    const newZone = new DeliveryZone(zoneData);
    await newZone.save();
    
    res.status(201).json({
      success: true,
      message: "Zona duplicada exitosamente",
      zone: newZone
    });
  } catch (error) {
    logger.error("Error al duplicar zona", error, req);
    res.status(500).json(formatHttpError(req, "Error al duplicar la zona", 500));
  }
});

module.exports = router;

