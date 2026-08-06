const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const DeliveryZone = require('../Models/DeliveryZone');
const Order = require('../Models/Order');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const { ORDER_STATUS } = require('../utils/constants');
const { SALES, DELIVERY, TIPS } = require('../utils/revenue');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { pointInPolygon, pointInRadius } = require('../utils/geospatial');
const { protectSuperAdmin: authSuperAdmin } = require('../middleware/authSuperAdmin');

// Rate limiter for public business listing/search endpoints (heavy aggregation)
const businessesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, try again later' }
});

/**
 * Compute whether a business is currently open based on its hours schedule.
 * Needed because .lean() strips Mongoose virtuals from documents.
 */
function computeIsCurrentlyOpen(business) {
  if (!business?.isOpen) return false;
  if (!business.businessHours) return business.isOpen;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayHours = business.businessHours[dayNames[new Date().getDay()]];
  if (!todayHours?.isOpen) return false;
  if (!todayHours.open || !todayHours.close) return business.isOpen;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const open = toMin(todayHours.open);
  const close = toMin(todayHours.close);
  return close < open ? (now >= open || now <= close) : (now >= open && now <= close);
}

// Simple in-memory cache for getBatchBusinessInfo (5-min TTL)
const _batchCache = new Map();
const BATCH_CACHE_TTL = 5 * 60 * 1000;
function _getCached(key) {
  const e = _batchCache.get(key);
  if (!e || Date.now() - e.ts > BATCH_CACHE_TTL) { _batchCache.delete(key); return null; }
  return e.data;
}
function _setCached(key, data) {
  _batchCache.set(key, { data, ts: Date.now() });
  if (_batchCache.size > 200) {
    const oldest = [..._batchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    _batchCache.delete(oldest[0]);
  }
}

// Palabras clave para categorías genéricas del catálogo (estilo Rappi/DiDi)
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

/**
 * Obtener categorías + productCount + minPrice + topProducts + popularityScore
 * para MULTIPLES negocios. Elimina el problema N+1.
 */
const getBatchBusinessInfo = async (businessIds) => {
  try {
    if (!businessIds.length) return {};
    const cacheKey = businessIds.map(id => id.toString()).sort().join(',');
    const cached = _getCached(cacheKey);
    if (cached) return cached;

    // Queries en paralelo: productos + órdenes recientes (30 días)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [products, orderCounts] = await Promise.all([
      Product.find({
        businessId: { $in: businessIds },
        active: true
      }).select('businessId name description price image isFeatured').lean(),
      Order.aggregate([
        {
          $match: {
            businessId: { $in: businessIds },
            status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.DELIVERED] },
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: '$businessId',
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' },
            totalRevenue: { $sum: SALES }
          }
        }
      ])
    ]);

    // Map de order stats
    const orderStats = {};
    for (const stat of orderCounts) {
      orderStats[stat._id.toString()] = stat;
    }

    const byBusiness = {};
    for (const id of businessIds) {
      byBusiness[id.toString()] = {
        categories: new Set(),
        productCount: 0,
        minPrice: Infinity,
        topProducts: [],
        orderCount: 0,
        avgOrderValue: 0,
        popularityScore: 0
      };
    }

    for (const product of products) {
      const bid = product.businessId.toString();
      if (!byBusiness[bid]) continue;
      const entry = byBusiness[bid];
      entry.productCount++;

      if (product.price < entry.minPrice) {
        entry.minPrice = product.price;
      }

      if (entry.topProducts.length < 3) {
        if (product.isFeatured || product.image) {
          entry.topProducts.push({
            name: product.name,
            price: product.price,
            image: product.image || null
          });
        }
      }

      const text = `${product.name} ${product.description || ''}`.toLowerCase();
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
          entry.categories.add(category);
        }
      }
    }

    for (const bid of Object.keys(byBusiness)) {
      byBusiness[bid].categories = Array.from(byBusiness[bid].categories);
      if (byBusiness[bid].minPrice === Infinity) byBusiness[bid].minPrice = 0;
      // Calcular popularidad real
      const stats = orderStats[bid];
      if (stats) {
        byBusiness[bid].orderCount = stats.orderCount;
        byBusiness[bid].avgOrderValue = Math.round(stats.avgOrderValue || 0);
        // Score: órdenes * 10 + productos * 2 (ponderado)
        byBusiness[bid].popularityScore = stats.orderCount * 10 + byBusiness[bid].productCount * 2;
      } else {
        byBusiness[bid].popularityScore = byBusiness[bid].productCount * 2;
      }
    }

    _setCached(cacheKey, byBusiness);
    return byBusiness;
  } catch (error) {
    logger.error('Error in getBatchBusinessInfo:', error);
    return {};
  }
};

/**
 * Filtra una lista de negocios según cobertura de zona de entrega para un punto dado.
 * Añade `deliveryZone` a cada negocio que cubre el punto.
 * Devuelve solo los negocios con cobertura.
 */
async function filterByDeliveryCoverage(businesses, lat, lon) {
  const userPoint = { lat: parseFloat(lat), lon: parseFloat(lon) };
  const allBusinessIds = businesses.map(b => b._id);
  const allZones = await DeliveryZone.find({ businessId: { $in: allBusinessIds }, isActive: true }).lean();

  const zonesByBusiness = {};
  for (const zone of allZones) {
    const bid = zone.businessId.toString();
    if (!zonesByBusiness[bid]) zonesByBusiness[bid] = [];
    zonesByBusiness[bid].push(zone);
  }

  return businesses.filter(business => {
    const zones = zonesByBusiness[business._id.toString()] || [];
    if (zones.length === 0) return false;
    for (const zone of zones.sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
      let inZone = false;
      if (zone.type === 'polygon') {
        inZone = pointInPolygon(userPoint, zone.geometry.coordinates[0]);
      } else if (zone.type === 'circle') {
        const center = { lat: zone.geometry.center.coordinates[1], lon: zone.geometry.center.coordinates[0] };
        inZone = pointInRadius(userPoint, center, zone.geometry.radius);
      }
      if (inZone) {
        business.deliveryZone = { name: zone.name, estimatedTime: zone.estimatedTime, pricing: zone.pricing };
        return true;
      }
    }
    return false;
  });
}

/**
 * GET /api/businesses
 * Obtener todos los negocios activos para el catálogo
 * Query params: lat, lon, limit, offset, open (filtro abierto ahora)
 */
router.get('/', businessesLimiter, async (req, res) => {
  try {
    const { lat, lon, limit = 50, offset = 0, open } = req.query;
    const hasLocation = lat && lon && !isNaN(lat) && !isNaN(lon);
    
    logger.info('GET /api/businesses', { withLocation: hasLocation, lat, lon, limit, offset, open });

    // Obtener todos los negocios activos
    const businesses = await BusinessConfig.find({ 
      isActive: true
    }).select('businessName slug logo coverImage description theme isActive isOpen address whatsappNumber socialMedia department city location businessHours reviewStats createdAt updatedAt').lean();

    // Si hay ubicación, filtrar por cobertura
    let businessesToShow = businesses;
    if (hasLocation) {
      businessesToShow = await filterByDeliveryCoverage(businesses, lat, lon);
    }

    // Filtro "abierto ahora" — usa horarios reales calculados desde businessHours
    if (open === 'true') {
      businessesToShow = businessesToShow.filter(b => computeIsCurrentlyOpen(b));
    }

    // Paginar PRIMERO, luego enriquecer solo la página actual (no todos los negocios)
    const total = businessesToShow.length;
    const paginatedBusinesses = businessesToShow.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    // Batch: obtener categorías + productCount solo para los negocios de esta página
    const businessIds = paginatedBusinesses.map(b => b._id);
    const batchInfo = await getBatchBusinessInfo(businessIds);

    // Formatear respuesta
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formattedBusinesses = paginatedBusinesses.map(business => {
      const bid = business._id.toString();
      const info = batchInfo[bid] || { categories: [], productCount: 0, minPrice: 0, topProducts: [] };
      
      let coordinates = null;
      if (business.location && business.location.coordinates) {
        coordinates = {
          lat: business.location.coordinates.lat,
          lng: business.location.coordinates.lng
        };
      }

      // Obtener horario de hoy
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayKey = dayNames[now.getDay()];
      const todayHours = business.businessHours?.[todayKey] || null;
      
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
        coordinates,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
        isOpen: business.isOpen,
        isCurrentlyOpen: computeIsCurrentlyOpen(business),
        businessHours: business.businessHours,
        todayHours,
        productCount: info.productCount,
        minPrice: info.minPrice,
        topProducts: info.topProducts,
        isNew: business.createdAt >= thirtyDaysAgo,
        popularityScore: info.popularityScore || 0,
        orderCount: info.orderCount || 0,
        categories: info.categories,
        reviewStats: business.reviewStats || { averageRating: 0, totalReviews: 0 },
        deliveryZone: business.deliveryZone || null
      };
    });

    logger.info(`Found ${formattedBusinesses.length} businesses (total: ${total})`, { count: formattedBusinesses.length, total });
    
    res.json({
      data: formattedBusinesses,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('GET /api/businesses - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/featured
 * Secciones curadas: trending, envio gratis, precio bajo, mejor valorados
 */
router.get('/featured', businessesLimiter, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const hasLocation = lat && lon && !isNaN(lat) && !isNaN(lon);

    const allBusinesses = await BusinessConfig.find({ isActive: true })
      .select('businessName slug logo coverImage description isOpen businessHours location department city reviewStats createdAt')
      .lean();

    // Filtrar por cobertura de zona si hay ubicación
    const businesses = hasLocation
      ? await filterByDeliveryCoverage(allBusinesses, lat, lon)
      : allBusinesses;

    const businessIds = businesses.map(b => b._id);
    const batchInfo = await getBatchBusinessInfo(businessIds);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = dayNames[now.getDay()];

    // Formatear todos
    let allFormatted = businesses.map(b => {
      const bid = b._id.toString();
      const info = batchInfo[bid] || { categories: [], productCount: 0, minPrice: 0, topProducts: [], popularityScore: 0, orderCount: 0 };
      let coordinates = null;
      if (b.location?.coordinates) {
        coordinates = { lat: b.location.coordinates.lat, lng: b.location.coordinates.lng };
      }
      return {
        _id: b._id,
        businessName: b.businessName,
        slug: b.slug,
        logo: b.logo,
        coverImage: b.coverImage,
        description: b.description,
        isOpen: b.isOpen,
        isCurrentlyOpen: computeIsCurrentlyOpen(b),
        todayHours: b.businessHours?.[todayKey] || null,
        coordinates,
        isNew: b.createdAt >= thirtyDaysAgo,
        productCount: info.productCount,
        minPrice: info.minPrice,
        topProducts: info.topProducts,
        popularityScore: info.popularityScore,
        orderCount: info.orderCount,
        categories: info.categories,
        reviewStats: b.reviewStats || { averageRating: 0, totalReviews: 0 }
      };
    });

    // Threshold relativo para cheapEats: negocios cuyo precio mínimo está por debajo
    // del promedio — funciona independientemente de la moneda del negocio.
    const validPrices = allFormatted.filter(b => b.minPrice > 0).map(b => b.minPrice);
    const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;
    const cheapThreshold = avgPrice * 0.75;

    // Secciones
    const trending = [...allFormatted]
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .filter(b => b.popularityScore > 0)
      .slice(0, 8);

    const cheapEats = cheapThreshold > 0
      ? [...allFormatted]
          .filter(b => b.minPrice > 0 && b.minPrice <= cheapThreshold)
          .sort((a, b) => a.minPrice - b.minPrice)
          .slice(0, 8)
      : [];

    const newOnes = allFormatted.filter(b => b.isNew).slice(0, 8);

    const bigMenus = [...allFormatted]
      .filter(b => b.productCount >= 5)
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 8);

    res.json({
      success: true,
      sections: {
        trending: { title: '🔥 Trending', subtitle: 'Los más pedidos esta semana', data: trending },
        cheapEats: { title: '💰 Comer barato', subtitle: 'Precios desde $5.000', data: cheapEats },
        newOnes: { title: '✨ Recién llegados', subtitle: 'Nuevos en MenuBy', data: newOnes },
        bigMenus: { title: '📋 Menús grandes', subtitle: 'Más variedad para elegir', data: bigMenus }
      }
    });
  } catch (error) {
    logger.error('GET /api/businesses/featured - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/search/products
 * Buscar restaurantes por nombre de PRODUCTO (ej: "hamburguesa" → restaurantes que la venden)
 * Retorna restaurantes + los productos que matchearon
 */
router.get('/search/products', businessesLimiter, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Buscar productos que matcheen
    const matchingProducts = await Product.find({
      active: true,
      $or: [
        { name: { $regex: escapedQ, $options: 'i' } },
        { description: { $regex: escapedQ, $options: 'i' } }
      ]
    }).select('businessId name price image').limit(200).lean();

    if (matchingProducts.length === 0) {
      return res.json({ success: true, data: [], total: 0, query: q });
    }

    // Agrupar productos por negocio
    const productsByBusiness = {};
    for (const p of matchingProducts) {
      const bid = p.businessId.toString();
      if (!productsByBusiness[bid]) productsByBusiness[bid] = [];
      if (productsByBusiness[bid].length < 4) {
        productsByBusiness[bid].push({ name: p.name, price: p.price, image: p.image || null });
      }
    }

    const businessIds = Object.keys(productsByBusiness);

    // Obtener datos de los negocios
    const businesses = await BusinessConfig.find({
      _id: { $in: businessIds },
      isActive: true
    }).select('businessName slug logo coverImage description theme isOpen address department city location businessHours reviewStats createdAt').lean();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = dayNames[now.getDay()];

    const results = businesses.map(b => {
      const bid = b._id.toString();
      let coordinates = null;
      if (b.location?.coordinates) {
        coordinates = { lat: b.location.coordinates.lat, lng: b.location.coordinates.lng };
      }
      return {
        _id: b._id,
        businessName: b.businessName,
        slug: b.slug,
        logo: b.logo,
        coverImage: b.coverImage,
        description: b.description,
        theme: b.theme,
        address: b.address,
        department: b.department,
        city: b.city,
        coordinates,
        isOpen: b.isOpen,
        todayHours: b.businessHours?.[todayKey] || null,
        isNew: b.createdAt >= thirtyDaysAgo,
        createdAt: b.createdAt,
        reviewStats: b.reviewStats || { averageRating: 0, totalReviews: 0 },
        matchingProducts: productsByBusiness[bid] || [],
        matchCount: (productsByBusiness[bid] || []).length
      };
    }).sort((a, b) => b.matchCount - a.matchCount).slice(0, parseInt(limit));

    res.json({ success: true, data: results, total: results.length, query: q });
  } catch (error) {
    logger.error('GET /api/businesses/search/products - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/search
 * Buscar negocios por nombre o descripción
 * IMPORTANTE: Debe estar ANTES de /:id para que Express no lo capture como parámetro
 */
router.get('/search', businessesLimiter, async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    logger.debug('Searching businesses', { query: q }, req);

    const filters = { isActive: true };
    
    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.$or = [
        { businessName: { $regex: escapedQ, $options: 'i' } },
        { description: { $regex: escapedQ, $options: 'i' } }
      ];
    }

    const [businesses, total] = await Promise.all([
      BusinessConfig.find(filters)
        .select('businessName slug logo coverImage description theme isOpen address whatsappNumber socialMedia department city location businessHours reviewStats createdAt')
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .sort({ createdAt: -1 })
        .lean(),
      BusinessConfig.countDocuments(filters)
    ]);

    const businessIds = businesses.map(b => b._id);
    const batchInfo = await getBatchBusinessInfo(businessIds);

    const formattedBusinesses = businesses.map(business => {
      const bid = business._id.toString();
      const info = batchInfo[bid] || { categories: [], productCount: 0 };
      let coordinates = null;
      if (business.location?.coordinates) {
        coordinates = { lat: business.location.coordinates.lat, lng: business.location.coordinates.lng };
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
        coordinates,
        createdAt: business.createdAt,
        isOpen: business.isOpen,
        isCurrentlyOpen: computeIsCurrentlyOpen(business),
        businessHours: business.businessHours,
        productCount: info.productCount,
        categories: info.categories,
        reviewStats: business.reviewStats || { averageRating: 0, totalReviews: 0 }
      };
    });

    res.json({
      success: true,
      data: formattedBusinesses,
      total,
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
 * Requiere autenticación de superadmin
 */
router.get('/debug/all', authSuperAdmin, async (req, res) => {
  try {
    const allBusinesses = await BusinessConfig.find({});
    const businessesInfo = allBusinesses.map(b => ({
      _id: b._id, businessName: b.businessName, slug: b.slug, isActive: b.isActive, createdAt: b.createdAt
    }));
    res.json({ success: true, total: allBusinesses.length, businesses: businessesInfo });
  } catch (error) {
    logger.error('GET /api/businesses/debug/all - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/:id
 * Obtener un negocio específico por ID o slug — con datos completos
 */
router.get('/:id', businessesLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const businessResult = await validateAndResolveBusinessId(id);
    if (!businessResult.success) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    const businessId = businessResult.businessId;

    const business = await BusinessConfig.findOne({ 
      _id: businessId,
      isActive: true 
    }).select('businessName slug logo coverImage description theme isOpen address whatsappNumber socialMedia department city location businessHours reviewStats createdAt updatedAt');

    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    // Obtener categorías y productCount
    const batchInfo = await getBatchBusinessInfo([business._id]);
    const info = batchInfo[business._id.toString()] || { categories: [], productCount: 0 };

    let coordinates = null;
    if (business.location?.coordinates) {
      coordinates = { lat: business.location.coordinates.lat, lng: business.location.coordinates.lng };
    }

    const formattedBusiness = {
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
      coordinates,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
      isOpen: business.isOpen,
      isCurrentlyOpen: typeof business.isCurrentlyOpen === 'function' ? business.isCurrentlyOpen() : business.isOpen,
      businessHours: business.businessHours,
      productCount: info.productCount,
      categories: info.categories,
      reviewStats: business.reviewStats || { averageRating: 0, totalReviews: 0 }
    };

    logger.info(`Business found`, { id: business._id, name: business.businessName }, req);
    
    res.json(formattedBusiness);
  } catch (error) {
    logger.error(`GET /api/businesses/${req.params.id} - Error`, error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

module.exports = router;
