/**
 * Utilidades para cálculos geoespaciales sin dependencias externas
 */

/**
 * Calcula la distancia entre dos coordenadas usando la fórmula Haversine
 * @param {number} lat1 - Latitud del punto 1
 * @param {number} lon1 - Longitud del punto 1
 * @param {number} lat2 - Latitud del punto 2
 * @param {number} lon2 - Longitud del punto 2
 * @returns {number} Distancia en kilómetros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convierte grados a radianes
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Verifica si un punto está dentro de un polígono usando el algoritmo Ray Casting
 * @param {Object} point - {lat, lon}
 * @param {Array} polygon - Array de [lon, lat] del polígono (formato GeoJSON)
 * @returns {boolean}
 */
function pointInPolygon(point, polygon) {
  const { lat, lon } = point;
  let inside = false;
  
  // El primer y último punto del polígono deben ser iguales en GeoJSON
  // Usar todos los puntos menos el último (que es duplicado)
  const vertices = polygon.slice(0, -1);
  
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i]; // lon, lat
    const [xj, yj] = vertices[j]; // lon, lat
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Verifica si un punto está dentro de un círculo (radio)
 * @param {Object} point - {lat, lon}
 * @param {Object} center - {lat, lon}
 * @param {number} radius - Radio en metros
 * @returns {boolean}
 */
function pointInRadius(point, center, radius) {
  const distanceKm = haversineDistance(point.lat, point.lon, center.lat, center.lon);
  const distanceMeters = distanceKm * 1000;
  return distanceMeters <= radius;
}

/**
 * Calcula el centro (centroide) de un polígono
 * @param {Array} polygon - Array de [lon, lat]
 * @returns {Object} {lat, lon}
 */
function getPolygonCenter(polygon) {
  let sumLat = 0;
  let sumLon = 0;
  const vertices = polygon.slice(0, -1); // Excluir el punto duplicado
  
  for (const [lon, lat] of vertices) {
    sumLat += lat;
    sumLon += lon;
  }
  
  return {
    lat: sumLat / vertices.length,
    lon: sumLon / vertices.length
  };
}

/**
 * Calcula el área aproximada de un polígono en km²
 * Usa la fórmula del área de polígono esférico simplificada
 * @param {Array} polygon - Array de [lon, lat]
 * @returns {number} Área en km²
 */
function getPolygonArea(polygon) {
  const R = 6371; // Radio de la Tierra en km
  const vertices = polygon.slice(0, -1);
  
  if (vertices.length < 3) return 0;
  
  let area = 0;
  
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const [lon1, lat1] = vertices[i];
    const [lon2, lat2] = vertices[j];
    
    area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  
  area = Math.abs(area * R * R / 2);
  
  return area;
}

/**
 * Valida coordenadas
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isValidCoordinates(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

/**
 * Valida un polígono GeoJSON
 * @param {Array} coordinates - Array de coordenadas
 * @returns {Object} {isValid, error}
 */
function validatePolygon(coordinates) {
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0])) {
    return { isValid: false, error: 'Las coordenadas deben ser un array de arrays' };
  }
  
  const ring = coordinates[0];
  
  if (ring.length < 4) {
    return { isValid: false, error: 'Un polígono debe tener al menos 4 puntos' };
  }
  
  // Verificar que el primer y último punto sean iguales
  const first = ring[0];
  const last = ring[ring.length - 1];
  
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { isValid: false, error: 'El primer y último punto del polígono deben ser iguales' };
  }
  
  // Verificar que todas las coordenadas sean válidas
  for (const [lon, lat] of ring) {
    if (!isValidCoordinates(lat, lon)) {
      return { isValid: false, error: `Coordenadas inválidas: [${lon}, ${lat}]` };
    }
  }
  
  return { isValid: true };
}

/**
 * Calcula el bounding box de un polígono
 * @param {Array} polygon - Array de [lon, lat]
 * @returns {Object} {minLat, maxLat, minLon, maxLon}
 */
function getBoundingBox(polygon) {
  const vertices = polygon.slice(0, -1);
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  
  for (const [lon, lat] of vertices) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  
  return { minLat, maxLat, minLon, maxLon };
}

module.exports = {
  haversineDistance,
  pointInPolygon,
  pointInRadius,
  getPolygonCenter,
  getPolygonArea,
  isValidCoordinates,
  validatePolygon,
  getBoundingBox,
  toRad
};

