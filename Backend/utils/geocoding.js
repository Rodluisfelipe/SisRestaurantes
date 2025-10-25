const axios = require('axios');

// Cache en memoria para geocodificación
const geocodeCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Limpia el cache cuando excede el tamaño máximo
 */
function cleanCache() {
  if (geocodeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = geocodeCache.keys().next().value;
    geocodeCache.delete(firstKey);
  }
}

/**
 * Geocodifica una dirección usando Nominatim (OpenStreetMap)
 * @param {string} address - Dirección a geocodificar
 * @param {string} country - Código de país (opcional, por defecto 'CO' para Colombia)
 * @returns {Promise<Object>} Resultado con coordenadas y detalles
 */
async function geocodeAddress(address, country = 'CO') {
  if (!address || address.trim().length === 0) {
    throw new Error('La dirección no puede estar vacía');
  }

  // Crear clave de cache
  const cacheKey = `${address.toLowerCase()}_${country}`;
  
  // Verificar cache
  const cached = geocodeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    // Llamar a la API de Nominatim
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        countrycodes: country.toLowerCase(),
        format: 'json',
        limit: 5,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'SisRestaurantes/1.0' // Nominatim requiere un User-Agent
      },
      timeout: 5000
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No se encontraron resultados para esta dirección');
    }

    // Formatear resultados
    const results = response.data.map(item => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address,
      type: item.type,
      importance: item.importance,
      boundingBox: item.boundingbox
    }));

    // Guardar en cache
    cleanCache();
    geocodeCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });

    return results;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout al intentar geocodificar la dirección');
    }
    if (error.response?.status === 429) {
      throw new Error('Demasiadas solicitudes de geocodificación. Intenta de nuevo en un momento');
    }
    throw new Error(`Error al geocodificar: ${error.message}`);
  }
}

/**
 * Geocodificación inversa: convierte coordenadas en dirección
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @returns {Promise<Object>} Dirección y detalles
 */
async function reverseGeocode(lat, lon) {
  if (!lat || !lon) {
    throw new Error('Latitud y longitud son requeridas');
  }

  const cacheKey = `reverse_${lat}_${lon}`;
  
  // Verificar cache
  const cached = geocodeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json',
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'SisRestaurantes/1.0'
      },
      timeout: 5000
    });

    if (!response.data) {
      throw new Error('No se encontró información para estas coordenadas');
    }

    const result = {
      lat: parseFloat(response.data.lat),
      lon: parseFloat(response.data.lon),
      displayName: response.data.display_name,
      address: response.data.address,
      type: response.data.type
    };

    // Guardar en cache
    cleanCache();
    geocodeCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout al intentar geocodificar las coordenadas');
    }
    throw new Error(`Error en geocodificación inversa: ${error.message}`);
  }
}

/**
 * Limpia el cache completo
 */
function clearCache() {
  geocodeCache.clear();
}

/**
 * Obtiene estadísticas del cache
 */
function getCacheStats() {
  return {
    size: geocodeCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttl: CACHE_TTL
  };
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  clearCache,
  getCacheStats
};

