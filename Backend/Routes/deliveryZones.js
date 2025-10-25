const express = require("express");
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

// Middleware vacío para no romper compatibilidad (rate limiting deshabilitado temporalmente)
const geocodeLimiter = (req, res, next) => next();
const zoneLimiter = (req, res, next) => next();

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
      return res.status(400).json({
        success: false,
        message: "Se requiere una dirección"
      });
    }
    
    const results = await geocodeAddress(address, country);
    
    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error("Error en geocodificación:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
      return res.status(400).json({
        success: false,
        message: "Se requiere una dirección"
      });
    }
    
    const results = await geocodeAddress(address, country);
    
    res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    console.error("Error en geocodificación:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
      return res.status(400).json({
        success: false,
        message: "Se requieren latitud y longitud"
      });
    }
    
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error en geocodificación inversa:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
      return res.status(400).json({
        success: false,
        message: "Se requieren latitud y longitud"
      });
    }
    
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error en geocodificación inversa:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
    console.error("Error al obtener stats:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
    console.log("=== POST /check-coverage ===");
    console.log("req.body:", JSON.stringify(req.body));
    console.log("Content-Type:", req.headers['content-type']);
    console.log("Origin:", req.headers.origin);
    
    const { businessId, lat, lon, orderTotal } = req.body;
    console.log("📊 Datos extraídos - businessId:", businessId, "lat:", lat, "lon:", lon, "orderTotal:", orderTotal);
    
    if (!businessId) {
      console.log("❌ Error: businessId no proporcionado");
      return res.status(400).json({
        success: false,
        message: "Se requiere el ID del negocio"
      });
    }
    
    if (!lat || !lon) {
      console.log("❌ Error: coordenadas no proporcionadas");
      return res.status(400).json({
        success: false,
        message: "Se requieren las coordenadas (lat, lon)"
      });
    }
    
    const point = { lat: parseFloat(lat), lon: parseFloat(lon) };
    console.log("📍 Punto a verificar:", point);
    
    // Si se proporciona orderTotal, validar el pedido completo
    if (orderTotal !== undefined) {
      console.log("💰 Validando pedido completo con orderTotal:", orderTotal);
      const validation = await validateDeliveryForOrder(businessId, point, parseFloat(orderTotal));
      console.log("✅ Resultado de validación:", JSON.stringify(validation));
      
      return res.json({
        success: true,
        ...validation
      });
    }
    
    // Solo verificar cobertura
    console.log("🔍 Verificando solo cobertura (sin orderTotal)");
    const coverage = await findCoverageForPoint(businessId, point);
    console.log("✅ Cobertura encontrada:", JSON.stringify(coverage));
    
    res.json({
      success: true,
      ...coverage
    });
  } catch (error) {
    console.error("❌ ERROR en check-coverage:");
    console.error("Error completo:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error al verificar la cobertura",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    console.log("=== GET /delivery-zones ===");
    console.log("req.user:", req.user);
    console.log("req.query.businessId:", req.query.businessId);
    
    // Obtener businessId del token, query param, o del admin
    let businessId = req.user.businessId || req.query.businessId;
    console.log("businessId inicial:", businessId);
    
    // Si es un token temporal de SuperAdmin, el businessId debe venir en el query
    if (req.user.isTempToken && !businessId) {
      console.log("❌ Token temporal sin businessId");
      return res.status(400).json({
        success: false,
        message: "businessId es requerido para tokens temporales de SuperAdmin"
      });
    }
    
    if (!businessId && req.user.id) {
      // Fallback: buscar el admin y obtener su businessId
      console.log("Buscando businessId del admin:", req.user.id);
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      console.log("Admin encontrado:", admin ? admin._id : 'NO ENCONTRADO');
      if (admin && admin.businessId) {
        businessId = admin.businessId;
        console.log("businessId del admin:", businessId);
      }
    }
    
    console.log("businessId final:", businessId);
    
    if (!businessId) {
      console.log("❌ No se pudo determinar businessId");
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo."
      });
    }
    
    console.log("📦 Obteniendo zonas para businessId:", businessId);
    const zones = await getZonesWithStats(businessId);
    console.log("✅ Zonas encontradas:", zones.length);
    
    res.json({
      success: true,
      zones,
      total: zones.length
    });
  } catch (error) {
    console.error("Error al obtener zonas:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener las zonas de entrega",
      error: error.message
    });
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
      return res.status(404).json({
        success: false,
        message: "Zona no encontrada"
      });
    }
    
    res.json({
      success: true,
      zone
    });
  } catch (error) {
    console.error("Error al obtener zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la zona",
      error: error.message
    });
  }
});

/**
 * POST /api/delivery-zones
 * Crear nueva zona de entrega
 */
router.post("/", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    console.log("=== POST /delivery-zones ===");
    console.log("req.user:", req.user);
    console.log("req.body.businessId:", req.body.businessId);
    
    let businessId = req.user.businessId || req.body.businessId;
    console.log("businessId inicial:", businessId);
    
    // Si no hay businessId en el token, buscar en el modelo Admin
    if (!businessId && req.user.id) {
      console.log("Buscando businessId del admin:", req.user.id);
      const Admin = require("../Models/Admin");
      const admin = await Admin.findById(req.user.id);
      console.log("Admin encontrado:", admin);
      if (admin && admin.businessId) {
        businessId = admin.businessId;
        console.log("businessId del admin:", businessId);
      }
    }
    
    console.log("businessId final:", businessId);
    
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo."
      });
    }
    
    const zoneData = req.body;
    
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
    if (zoneData.type === 'polygon') {
      const polygonValidation = validatePolygon(zoneData.geometry.coordinates);
      if (!polygonValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: polygonValidation.error
        });
      }
    }
    
    // Crear zona
    const newZone = new DeliveryZone({
      ...zoneData,
      businessId
    });
    
    await newZone.save();
    
    res.status(201).json({
      success: true,
      message: "Zona de entrega creada exitosamente",
      zone: newZone
    });
  } catch (error) {
    console.error("Error al crear zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al crear la zona de entrega",
      error: error.message
    });
  }
});

/**
 * PUT /api/delivery-zones/:id
 * Actualizar zona de entrega
 */
router.put("/:id", authMiddleware, zoneLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    let businessId = req.user.businessId || req.body.businessId;
    
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
        message: "No se pudo determinar el negocio. Por favor, cierre sesión e inicie de nuevo."
      });
    }
    
    const updateData = req.body;
    
    // Buscar zona
    const zone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zona no encontrada"
      });
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
    if (updateData.geometry && updateData.type === 'polygon') {
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
    console.error("Error al actualizar zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar la zona",
      error: error.message
    });
  }
});

/**
 * DELETE /api/delivery-zones/:id
 * Eliminar zona de entrega
 */
router.delete("/:id", authMiddleware, zoneLimiter, async (req, res) => {
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
    
    const zone = await DeliveryZone.findOneAndDelete({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zona no encontrada"
      });
    }
    
    res.json({
      success: true,
      message: "Zona eliminada exitosamente"
    });
  } catch (error) {
    console.error("Error al eliminar zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la zona",
      error: error.message
    });
  }
});

/**
 * PATCH /api/delivery-zones/:id/toggle
 * Activar/desactivar zona
 */
router.patch("/:id/toggle", authMiddleware, zoneLimiter, async (req, res) => {
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
    
    const zone = await DeliveryZone.findOne({ _id: id, businessId });
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zona no encontrada"
      });
    }
    
    zone.isActive = !zone.isActive;
    await zone.save();
    
    res.json({
      success: true,
      message: `Zona ${zone.isActive ? 'activada' : 'desactivada'} exitosamente`,
      zone
    });
  } catch (error) {
    console.error("Error al cambiar estado de zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al cambiar el estado de la zona",
      error: error.message
    });
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
      return res.status(404).json({
        success: false,
        message: "Zona no encontrada"
      });
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
    console.error("Error al duplicar zona:", error);
    res.status(500).json({
      success: false,
      message: "Error al duplicar la zona",
      error: error.message
    });
  }
});

module.exports = router;

