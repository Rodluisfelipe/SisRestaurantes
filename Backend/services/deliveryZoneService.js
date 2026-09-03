const DeliveryZone = require('../Models/DeliveryZone');
const { 
  haversineDistance, 
  pointInPolygon, 
  pointInRadius,
  isValidCoordinates,
  getPolygonCenter
} = require('../utils/geospatial');
const { findBusinessByIdentifier } = require('../utils/businessHelper');
const logger = require('../utils/logger');

/**
 * Calcula el precio de entrega según las reglas de la zona
 * @param {Object} zone - Zona de entrega
 * @param {number} distance - Distancia en km desde el centro de la zona
 * @returns {number} Precio calculado
 */
function calculateDeliveryPrice(zone, distance) {
  const { pricing } = zone;
  
  switch (pricing.mode) {
    case 'fixed':
      return pricing.basePrice;
      
    case 'distance':
      // Calcular precio por distancia
      const chargeableDistance = Math.max(0, distance - pricing.freeDistanceKm);
      return pricing.basePrice + (chargeableDistance * pricing.pricePerKm);
      
    case 'tiered':
      // Encontrar el tramo correspondiente
      const tier = pricing.tiers
        .sort((a, b) => a.maxDistance - b.maxDistance)
        .find(t => distance <= t.maxDistance);
      
      return tier ? tier.price : pricing.basePrice;
      
    default:
      return pricing.basePrice;
  }
}

/**
 * Verifica si un punto está dentro de una zona
 * @param {Object} point - {lat, lon}
 * @param {Object} zone - Zona de entrega
 * @returns {boolean}
 */
function isPointInZone(point, zone) {
  const { geometry, type } = zone;
  
  if (type === 'radius') {
    const center = {
      lat: geometry.coordinates[1],
      lon: geometry.coordinates[0]
    };
    return pointInRadius(point, center, geometry.radius);
  }
  
  if (type === 'polygon') {
    // Las coordenadas del polígono están en coordinates[0] (primer anillo)
    return pointInPolygon(point, geometry.coordinates[0]);
  }
  
  return false;
}

/**
 * Calcula la distancia desde el punto hasta el centro de la zona
 * @param {Object} point - {lat, lon}
 * @param {Object} zone - Zona de entrega
 * @returns {number} Distancia en km
 */
function getDistanceToZoneCenter(point, zone, businessLocation = null) {
  let centerLat, centerLon;
  
  if (zone.type === 'radius') {
    centerLat = zone.geometry.coordinates[1];
    centerLon = zone.geometry.coordinates[0];
  } else if (zone.type === 'polygon') {
    const center = getPolygonCenter(zone.geometry.coordinates[0]);
    centerLat = center.lat;
    centerLon = center.lon;
  }
  
  // Si se proporciona la ubicación del negocio, usar esa en su lugar
  if (businessLocation && businessLocation.lat && businessLocation.lon) {
    centerLat = businessLocation.lat;
    centerLon = businessLocation.lon;
  }
  
  return haversineDistance(point.lat, point.lon, centerLat, centerLon);
}

/**
 * Encuentra todas las zonas que cubren un punto dado
 * @param {string} businessId - ID del negocio
 * @param {Object} point - {lat, lon}
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado con zona, precio, tiempo y detalles
 */
async function findCoverageForPoint(businessId, point, options = {}) {
  const { checkSchedule = true, businessLocation = null } = options;
  
  // Validar coordenadas
  if (!isValidCoordinates(point.lat, point.lon)) {
    throw new Error('Coordenadas inválidas');
  }
  
  // Resolver businessId (puede ser slug o ObjectId)
  const business = await findBusinessByIdentifier(businessId);
  if (!business) {
    logger.warn('Negocio no encontrado en findCoverageForPoint', { businessId });
    return {
      covered: false,
      message: 'Negocio no encontrado'
    };
  }
  
  // Obtener todas las zonas activas del negocio ordenadas por prioridad
  const zones = await DeliveryZone.getActiveZones(business._id);
  
  if (zones.length === 0) {
    return {
      covered: false,
      noZonesConfigured: true,
      message: 'Este negocio no tiene zonas de entrega configuradas'
    };
  }
  
  // Filtrar zonas que cubren el punto
  const matchingZones = [];
  
  for (const zone of zones) {
    // Verificar si el punto está dentro de la zona
    if (!isPointInZone(point, zone)) {
      continue;
    }
    
    // Verificar horario si está habilitado
    if (checkSchedule && !zone.isAvailableAt(new Date())) {
      continue;
    }
    
    matchingZones.push(zone);
  }
  
  if (matchingZones.length === 0) {
    return {
      covered: false,
      message: 'Esta ubicación está fuera del área de entrega'
    };
  }
  
  // Seleccionar la zona con mayor prioridad
  const selectedZone = matchingZones[0]; // Ya están ordenadas por prioridad
  
  // Calcular distancia
  const distance = getDistanceToZoneCenter(point, selectedZone, businessLocation);
  
  // Calcular precio
  const deliveryPrice = calculateDeliveryPrice(selectedZone, distance);
  
  // Preparar respuesta
  return {
    covered: true,
    zone: {
      id: selectedZone._id,
      name: selectedZone.name,
      description: selectedZone.description,
      color: selectedZone.color,
      type: selectedZone.type
    },
    delivery: {
      price: Math.round(deliveryPrice),
      estimatedTime: selectedZone.estimatedTime,
      minimumOrder: selectedZone.pricing.minimumOrder,
      distance: Math.round(distance * 100) / 100 // Redondear a 2 decimales
    },
    alternativeZones: matchingZones.slice(1).map(z => ({
      id: z._id,
      name: z.name,
      priority: z.priority
    }))
  };
}

/**
 * Valida si un pedido puede ser enviado a una ubicación
 * @param {string} businessId - ID del negocio
 * @param {Object} point - {lat, lon}
 * @param {number} orderTotal - Total del pedido
 * @returns {Promise<Object>}
 */
async function validateDeliveryForOrder(businessId, point, orderTotal) {
  const coverage = await findCoverageForPoint(businessId, point);
  
  if (!coverage.covered) {
    return {
      valid: false,
      noZonesConfigured: coverage.noZonesConfigured || false,
      error: coverage.message
    };
  }
  
  // Verificar monto mínimo
  if (orderTotal < coverage.delivery.minimumOrder) {
    return {
      valid: false,
      error: `El monto mínimo para esta zona es de $${coverage.delivery.minimumOrder}`,
      coverage
    };
  }
  
  return {
    valid: true,
    coverage
  };
}

/**
 * Obtiene todas las zonas de un negocio con estadísticas
 * @param {string} businessId
 * @returns {Promise<Array>}
 */
async function getZonesWithStats(businessId) {
  // Convertir businessId a ObjectId para la búsqueda y contemplar datos históricos guardados como string
  const mongoose = require('mongoose');
  const isValid = mongoose.Types.ObjectId.isValid(businessId);
  const asObjectId = isValid ? new mongoose.Types.ObjectId(businessId) : null;
  const asString = String(businessId);

  const query = asObjectId
    ? { businessId: { $in: [asObjectId, asString] } }
    : { businessId: asString };

  const zones = await DeliveryZone.find(query)
    .sort({ priority: -1, createdAt: -1 });
  
  logger.debug('Found zones for business', { businessId, count: zones.length });
  
  return zones.map(zone => ({
    id: zone._id,
    name: zone.name,
    description: zone.description,
    type: zone.type,
    geometry: zone.geometry, // IMPORTANTE: para mostrar en el mapa
    isActive: zone.isActive,
    priority: zone.priority,
    color: zone.color,
    pricing: zone.pricing,
    estimatedTime: zone.estimatedTime,
    stats: zone.stats,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt
  }));
}

/**
 * Valida los datos de una zona antes de crear o actualizar
 * @param {Object} zoneData
 * @returns {Object} {valid, errors}
 */
function validateZoneData(zoneData) {
  const errors = [];
  
  // Validar nombre
  if (!zoneData.name || zoneData.name.trim().length === 0) {
    errors.push('El nombre de la zona es requerido');
  } else if (zoneData.name.trim().length > 100) {
    // Debe coincidir con el maxlength del modelo (DeliveryZone.name): sin esto,
    // un nombre largo pasaba esta validación y tronaba como 500 genérico al
    // guardar, en vez de un error claro que el formulario pueda mostrar.
    errors.push('El nombre de la zona no puede tener más de 100 caracteres. Si necesitas describir varios barrios, usa el campo de descripción.');
  }
  
  // Validar tipo
  if (!['radius', 'polygon'].includes(zoneData.type)) {
    errors.push('El tipo de zona debe ser "radius" o "polygon"');
  }
  
  // Validar geometría
  if (!zoneData.geometry || !zoneData.geometry.type || !zoneData.geometry.coordinates) {
    errors.push('La geometría de la zona es inválida');
  } else {
    if (zoneData.type === 'radius') {
      if (zoneData.geometry.type !== 'Point') {
        errors.push('Las zonas tipo "radius" deben tener geometría tipo "Point"');
      }
      if (!zoneData.geometry.radius || zoneData.geometry.radius <= 0) {
        errors.push('El radio debe ser mayor a 0');
      }
    }
    
    if (zoneData.type === 'polygon') {
      if (zoneData.geometry.type !== 'Polygon') {
        errors.push('Las zonas tipo "polygon" deben tener geometría tipo "Polygon"');
      }
    }
  }
  
  // Validar pricing
  if (!zoneData.pricing || typeof zoneData.pricing !== 'object') {
    errors.push('La configuración de precios es requerida');
  } else {
    if (!['fixed', 'distance', 'tiered'].includes(zoneData.pricing.mode)) {
      errors.push('El modo de precio debe ser "fixed", "distance" o "tiered"');
    }
    
    if (typeof zoneData.pricing.basePrice !== 'number' || zoneData.pricing.basePrice < 0) {
      errors.push('El precio base debe ser un número mayor o igual a 0');
    }
    
    if (zoneData.pricing.mode === 'tiered' && (!zoneData.pricing.tiers || zoneData.pricing.tiers.length === 0)) {
      errors.push('Las zonas con precio por tramos deben tener al menos un tramo definido');
    }
  }
  
  // Validar tiempo estimado
  if (!zoneData.estimatedTime || typeof zoneData.estimatedTime !== 'object') {
    errors.push('El tiempo estimado es requerido');
  } else {
    if (typeof zoneData.estimatedTime.min !== 'number' || zoneData.estimatedTime.min < 0) {
      errors.push('El tiempo mínimo debe ser un número mayor o igual a 0');
    }
    if (typeof zoneData.estimatedTime.max !== 'number' || zoneData.estimatedTime.max < 0) {
      errors.push('El tiempo máximo debe ser un número mayor o igual a 0');
    }
    if (zoneData.estimatedTime.min > zoneData.estimatedTime.max) {
      errors.push('El tiempo mínimo no puede ser mayor al tiempo máximo');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  findCoverageForPoint,
  validateDeliveryForOrder,
  getZonesWithStats,
  validateZoneData,
  calculateDeliveryPrice,
  isPointInZone,
  getDistanceToZoneCenter
};

