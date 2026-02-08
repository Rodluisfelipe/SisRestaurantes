const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const DeliveryZone = require('../Models/DeliveryZone');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { pointInPolygon, pointInRadius } = require('../utils/geospatial');

// Función para obtener categorías reales basadas en productos
const getBusinessCategories = async (businessId) => {
  try {
    // Obtener todos los productos activos del negocio
    const products = await Product.find({ businessId, active: true })
      .select('name description')
      .lean();
    
    if (products.length === 0) {
      logger.debug('No active products', { businessId });
      return [];
    }
    
    // Categorías GENÉRICAS del catálogo (como Rappi, DiDi)
    const categoryKeywords = {
      'hamburguesas': ['hamburguesa', 'burger', 'whopper', 'big mac', 'mcpollo', 'cheeseburger', 'carne de res'],
      'pollo': ['pollo', 'chicken', 'alitas', 'wings', 'nuggets', 'broaster', 'pechuga', 'mcnuggets'],
      'pizza': ['pizza', 'pizzeta', 'pepperoni', 'hawaiana', 'margarita', 'quattro'],
      'bebidas': ['coca', 'pepsi', 'gaseosa', 'jugo', 'agua', 'bebida', 'refresco', 'limonada', 'té', 'cafe', 'soda', 'sprite', 'fanta'],
      'postres': ['postre', 'helado', 'pastel', 'torta', 'brownie', 'flan', 'dulce', 'sundae', 'mcflurry', 'oreo', 'cheesecake'],
      'sandwich': ['sandwich', 'sándwich', 'sub', 'bocadillo', 'mccrispy'],
      'papas': ['papa', 'fries', 'papas fritas'],
      'ensaladas': ['ensalada', 'salad', 'vegetal'],
      'combos': ['combo', 'menu', 'cajita feliz']
    };

    const foundCategories = new Set();
    
    // Analizar cada producto por nombre Y descripción
    products.forEach(product => {
      const productText = `${product.name} ${product.description || ''}`.toLowerCase();
      
      // Buscar coincidencias con palabras clave de categorías genéricas
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        const hasMatch = keywords.some(keyword => productText.includes(keyword));
        if (hasMatch) {
          foundCategories.add(category);
        }
      }
    });

    const categories = Array.from(foundCategories);
    logger.debug('Generic categories found', { businessId, categories, productCount: products.length });
    
    return categories;
  } catch (error) {
    logger.error('Error getting business categories:', error);
    return [];
  }
};

/**
 * GET /api/businesses
 * Obtener todos los negocios activos para el catálogo
 * Si se proporcionan lat/lon, filtra solo los que cubren esa ubicación
 */
router.get('/', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const hasLocation = lat && lon && !isNaN(lat) && !isNaN(lon);
    
    logger.info('GET /api/businesses - Obteniendo lista de negocios', {
      withLocation: hasLocation,
      lat,
      lon
    });

    // Obtener todos los negocios activos
    const businesses = await BusinessConfig.find({ 
      isActive: true
    }).select('businessName slug logo coverImage description theme isActive isOpen address whatsappNumber socialMedia department city location createdAt updatedAt');

    // Si hay ubicación, filtrar por cobertura
    let businessesToShow = businesses;
    
    if (hasLocation) {
      const userPoint = {
        lat: parseFloat(lat),
        lon: parseFloat(lon)  // Cambiar lng a lon para coincidir con geospatial.js
      };
      
      logger.debug('Filtrando por ubicación del usuario', { userPoint }, req);
      
      // Verificar cobertura para cada negocio
      const businessesWithCoverage = await Promise.all(
        businesses.map(async (business) => {
          // Buscar zonas activas del negocio
          const zones = await DeliveryZone.find({
            businessId: business._id,
            isActive: true
          });
          
          if (zones.length === 0) {
            return null; // No tiene zonas configuradas
          }
          
          // Verificar si el usuario está en alguna zona y obtener la zona con mayor prioridad
          let matchedZone = null;
          
          for (const zone of zones.sort((a, b) => b.priority - a.priority)) {
            let isInZone = false;
            
            if (zone.type === 'polygon') {
              // GeoJSON Polygon: coordinates es [[...]], necesitamos el array interno [0]
              const polygonRing = zone.geometry.coordinates[0];
              isInZone = pointInPolygon(userPoint, polygonRing);
            } else if (zone.type === 'circle') {
              const center = {
                lat: zone.geometry.center.coordinates[1],
                lon: zone.geometry.center.coordinates[0]
              };
              isInZone = pointInRadius(userPoint, center, zone.geometry.radius);
            }
            
            if (isInZone) {
              matchedZone = zone;
              break; // Tomar la primera zona que coincida (ya están ordenadas por prioridad)
            }
          }
          
          if (matchedZone) {
            logger.debug(`Usuario en cobertura`, { businessId: business._id, zoneName: matchedZone.name }, req);
            // Agregar información de la zona al negocio
            business._doc.deliveryZone = {
              name: matchedZone.name,
              estimatedTime: matchedZone.estimatedTime,
              pricing: matchedZone.pricing
            };
            return business;
          } else {
            return null;
          }
        })
      );
      
      // Filtrar solo los que tienen cobertura
      businessesToShow = businessesWithCoverage.filter(b => b !== null);
      logger.debug(`Restaurantes con cobertura filtrados`, { count: businessesToShow.length, total: businesses.length }, req);
    }
    
    // Formatear respuesta para el catálogo con categorías reales
    const formattedBusinesses = await Promise.all(businessesToShow.map(async (business) => {
      const categories = await getBusinessCategories(business._id);
      
      // Extraer coordenadas del campo location
      let coordinates = null;
      if (business.location && business.location.coordinates) {
        coordinates = {
          lat: business.location.coordinates.lat,
          lng: business.location.coordinates.lng
        };
      }
      
      return {
        _id: business._id,
        businessName: business.businessName,
        slug: business.slug,
        logo: business.logo,
        coverImage: business.coverImage,
        description: business.description,
        theme: business.theme,
        address: business.address,
        whatsappNumber: business.whatsappNumber,
        socialMedia: business.socialMedia,
        department: business.department,
        city: business.city,
        coordinates: coordinates, // Coordenadas para calcular distancia
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
        // Usar el campo real isOpen del modelo
        isOpen: business.isOpen,
        // Agregar campos calculados
        rating: 5.0, // Rating fijo de 5 estrellas
        categories: categories, // Categorías reales basadas en productos
        deliveryZone: business._doc?.deliveryZone || business.deliveryZone || null // Información de zona de entrega
      };
    }));

    logger.info(`Found ${formattedBusinesses.length} businesses`, { count: formattedBusinesses.length }, req);
    
    res.json(formattedBusinesses);
  } catch (error) {
    logger.error('GET /api/businesses - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/:id
 * Obtener un negocio específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validar y resolver el ID del negocio
    const businessResult = await validateAndResolveBusinessId(id);
    if (!businessResult.success) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    const businessId = businessResult.businessId;

    // Buscar el negocio
    const business = await BusinessConfig.findOne({ 
      _id: businessId,
      isActive: true 
    }).select('businessName slug logo description theme isOpen address whatsappNumber socialMedia createdAt updatedAt');

    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    // Formatear respuesta
    const formattedBusiness = {
      _id: business._id,
      businessName: business.businessName,
      slug: business.slug,
      logo: business.logo,
      description: business.description,
      theme: business.theme,
      address: business.address,
      whatsappNumber: business.whatsappNumber,
      socialMedia: business.socialMedia,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      // Usar el campo real isOpen del modelo
      isOpen: business.isOpen,
      // Agregar campos calculados
      rating: 4.5,
      categories: []
    };

    logger.info(`Business found`, { id: business._id, name: business.businessName }, req);
    
    res.json(formattedBusiness);
  } catch (error) {
    logger.error(`GET /api/businesses/${req.params.id} - Error`, error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/search
 * Buscar negocios por nombre o descripción
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, limit = 20, offset = 0 } = req.query;
    logger.debug('Searching businesses', { query: q, category }, req);

    // Construir filtros de búsqueda
    const filters = { isActive: true };
    
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.$or = [
        { businessName: { $regex: escapedQ, $options: 'i' } },
        { description: { $regex: escapedQ, $options: 'i' } }
      ];
    }

    // Buscar negocios
    const businesses = await BusinessConfig.find(filters)
      .select('businessName slug logo coverImage description theme isOpen address whatsappNumber socialMedia createdAt')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort({ createdAt: -1 });

    // Formatear respuesta
    const formattedBusinesses = await Promise.all(businesses.map(async (business) => {
      const categories = await getBusinessCategories(business._id);
      
      return {
        _id: business._id,
        businessName: business.businessName,
        slug: business.slug,
        logo: business.logo,
        coverImage: business.coverImage,
        description: business.description,
        theme: business.theme,
        address: business.address,
        whatsappNumber: business.whatsappNumber,
        socialMedia: business.socialMedia,
        createdAt: business.createdAt,
        // Usar el campo real isOpen del modelo
        isOpen: business.isOpen,
        rating: 5.0, // Rating fijo de 5 estrellas
        categories: categories // Categorías reales
      };
    }));

    logger.info(`Found ${formattedBusinesses.length} businesses in search`, { count: formattedBusinesses.length }, req);
    
    res.json({
      success: true,
      data: formattedBusinesses,
      total: formattedBusinesses.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('GET /api/businesses/search - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/debug/all
 * Endpoint temporal para debug - obtener todos los negocios sin filtros
 */
router.get('/debug/all', async (req, res) => {
  try {
    const allBusinesses = await BusinessConfig.find({});
    
    const businessesInfo = allBusinesses.map(business => ({
      _id: business._id,
      businessName: business.businessName,
      slug: business.slug,
      isActive: business.isActive,
      createdAt: business.createdAt
    }));
    
    logger.info(`Found ${allBusinesses.length} total businesses (debug)`, { count: allBusinesses.length }, req);
    
    res.json({
      success: true,
      total: allBusinesses.length,
      businesses: businessesInfo
    });
  } catch (error) {
    logger.error('GET /api/businesses/debug/all - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

module.exports = router;
