const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const logger = require('../utils/logger');

// Función para obtener categorías reales basadas en productos
const getBusinessCategories = async (businessId) => {
  try {
    // Obtener todos los productos del negocio
    const products = await Product.find({ businessId, active: true });
    
    // Mapear palabras clave de productos a categorías
    const categoryMapping = {
      'hamburguesas': ['hamburguesa', 'burger', 'sandwich', 'combo', 'carne', 'queso', 'lechuga', 'tomate'],
      'pollo': ['pollo', 'chicken', 'alitas', 'muslo', 'pechuga', 'nuggets', 'frito'],
      'bebidas': ['bebida', 'jugo', 'gaseosa', 'refresco', 'agua', 'coca', 'pepsi', 'soda', 'limonada'],
      'pizza': ['pizza', 'masa', 'queso', 'pepperoni', 'margarita', 'hawaiana'],
      'asiatica': ['sushi', 'roll', 'asiatica', 'china', 'japonesa', 'arroz', 'salsa', 'wasabi'],
      'mexicana': ['mexicana', 'taco', 'burrito', 'quesadilla', 'nachos', 'guacamole', 'salsa picante']
    };

    const foundCategories = new Set();
    
    // Analizar cada producto
    products.forEach(product => {
      const productText = `${product.name} ${product.description || ''}`.toLowerCase();
      
      // Buscar coincidencias con las palabras clave
      for (const [category, keywords] of Object.entries(categoryMapping)) {
        const hasMatch = keywords.some(keyword => productText.includes(keyword));
        if (hasMatch) {
          foundCategories.add(category);
        }
      }
    });

    return Array.from(foundCategories);
  } catch (error) {
    logger.error('Error getting business categories:', error);
    return [];
  }
};

/**
 * GET /api/businesses
 * Obtener todos los negocios activos para el catálogo
 */
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/businesses - Obteniendo lista de negocios');

    // Obtener todos los negocios activos que estén en Chía (beta)
    const businesses = await BusinessConfig.find({ 
      isActive: true,
      city: "Chía" // Solo mostrar negocios de Chía por ahora
    }).select('businessName slug logo coverImage description theme isActive isOpen address whatsappNumber socialMedia department city createdAt updatedAt');

    // Formatear respuesta para el catálogo con categorías reales
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
        department: business.department,
        city: business.city,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
        // Usar el campo real isOpen del modelo
        isOpen: business.isOpen,
        // Agregar campos calculados
        rating: 5.0, // Rating fijo de 5 estrellas
        categories: categories // Categorías reales basadas en productos
      };
    }));

    logger.info(`GET /api/businesses - Encontrados ${formattedBusinesses.length} negocios`);
    logger.info('Negocios encontrados:', businesses.map(b => ({ name: b.businessName, isActive: b.isActive })));
    
    res.json(formattedBusinesses);
  } catch (error) {
    logger.error('GET /api/businesses - Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/businesses/:id
 * Obtener un negocio específico por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`GET /api/businesses/${id} - Obteniendo negocio`);

    // Validar y resolver el ID del negocio
    const businessResult = await validateAndResolveBusinessId(id);
    if (!businessResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }

    const businessId = businessResult.businessId;

    // Buscar el negocio
    const business = await BusinessConfig.findOne({ 
      _id: businessId,
      isActive: true 
    }).select('businessName slug logo description theme isOpen address whatsappNumber socialMedia createdAt updatedAt');

    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
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

    logger.info(`GET /api/businesses/${id} - Negocio encontrado: ${business.businessName}`);
    
    res.json(formattedBusiness);
  } catch (error) {
    logger.error(`GET /api/businesses/${id} - Error:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/businesses/search
 * Buscar negocios por nombre o descripción
 */
router.get('/search', async (req, res) => {
  try {
    const { q, category, limit = 20, offset = 0 } = req.query;
    logger.info(`GET /api/businesses/search - Búsqueda: "${q}", categoría: "${category}"`);

    // Construir filtros de búsqueda
    const filters = { isActive: true };
    
    if (q) {
      filters.$or = [
        { businessName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
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

    logger.info(`GET /api/businesses/search - Encontrados ${formattedBusinesses.length} negocios`);
    
    res.json({
      success: true,
      data: formattedBusinesses,
      total: formattedBusinesses.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('GET /api/businesses/search - Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/businesses/debug/all
 * Endpoint temporal para debug - obtener todos los negocios sin filtros
 */
router.get('/debug/all', async (req, res) => {
  try {
    logger.info('GET /api/businesses/debug/all - Debug: obteniendo todos los negocios');
    
    const allBusinesses = await BusinessConfig.find({});
    logger.info(`Debug: Encontrados ${allBusinesses.length} negocios en total`);
    
    const businessesInfo = allBusinesses.map(business => ({
      _id: business._id,
      businessName: business.businessName,
      slug: business.slug,
      isActive: business.isActive,
      createdAt: business.createdAt
    }));
    
    res.json({
      success: true,
      total: allBusinesses.length,
      businesses: businessesInfo
    });
  } catch (error) {
    logger.error('GET /api/businesses/debug/all - Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
