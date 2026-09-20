const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const Order = require('../Models/Order');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const { ORDER_STATUS } = require('../utils/constants');
const { SALES } = require('../utils/revenue');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { protectSuperAdmin: authSuperAdmin } = require('../middleware/authSuperAdmin');
const { ahoraCOL } = require('../services/whatsappAgent/horario');
const {
  RADIO_CERCANO_KM,
  CAMPOS_VITRINA,
  filtroVisible,
  idDelMenu,
  leerUbicacion,
  ordenarPorCercania,
  decorarParaVitrina,
} = require('../utils/marketplace');

// Rate limiter for public business listing/search endpoints (heavy aggregation)
const businessesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, try again later' }
});

/* Tope de la lista completa. El catálogo la pide entera y pagina en el
   navegador; antes el servidor cortaba en 50 sin ordenar, así que desde el
   negocio 51 —siempre los más nuevos— no aparecían nunca. */
const MAX_LISTA = 300;

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entero = (valor, porDefecto, min, max) => Math.min(Math.max(parseInt(valor) || porDefecto, min), max);

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
 *
 * Recibe los negocios (no solo sus ids) porque una sucursal con menú
 * compartido lee los productos de la principal: contados por su propio id
 * quedaba en cero. Devuelve null si falla, para que quien llama no confunda
 * "no pude contar" con "no tiene productos" y deje el catálogo vacío.
 */
const getBatchBusinessInfo = async (negocios) => {
  try {
    if (!negocios.length) return {};
    const menuDe = new Map(negocios.map(b => [b._id.toString(), idDelMenu(b)]));
    const cacheKey = [...menuDe].map(([id, menu]) => `${id}:${menu}`).sort().join(',');
    const cached = _getCached(cacheKey);
    if (cached) return cached;

    // Queries en paralelo: productos + órdenes recientes (30 días)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [products, orderCounts] = await Promise.all([
      Product.find({
        businessId: { $in: [...new Set(menuDe.values())] },
        active: true
      }).select('businessId name description price image isFeatured').lean(),
      Order.aggregate([
        {
          $match: {
            businessId: { $in: negocios.map(b => b._id) },
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

    const porMenu = {};
    for (const product of products) {
      const menu = product.businessId.toString();
      if (!porMenu[menu]) porMenu[menu] = { categories: new Set(), productCount: 0, minPrice: Infinity, topProducts: [] };
      const entry = porMenu[menu];
      entry.productCount++;
      if (product.price < entry.minPrice) entry.minPrice = product.price;
      if (entry.topProducts.length < 3 && (product.isFeatured || product.image)) {
        entry.topProducts.push({ name: product.name, price: product.price, image: product.image || null });
      }
      const text = `${product.name} ${product.description || ''}`.toLowerCase();
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => text.includes(kw))) entry.categories.add(category);
      }
    }

    const orderStats = Object.fromEntries(orderCounts.map(stat => [stat._id.toString(), stat]));

    const byBusiness = {};
    for (const [bid, menu] of menuDe) {
      const m = porMenu[menu];
      const stats = orderStats[bid];
      const productCount = m?.productCount || 0;
      const orderCount = stats?.orderCount || 0;
      byBusiness[bid] = {
        categories: m ? Array.from(m.categories) : [],
        productCount,
        minPrice: m && m.minPrice !== Infinity ? m.minPrice : 0,
        topProducts: m ? m.topProducts : [],
        orderCount,
        avgOrderValue: Math.round(stats?.avgOrderValue || 0),
        // Score: órdenes * 10 + productos * 2 (ponderado)
        popularityScore: orderCount * 10 + productCount * 2
      };
    }

    _setCached(cacheKey, byBusiness);
    return byBusiness;
  } catch (error) {
    logger.error('Error in getBatchBusinessInfo:', error);
    return null;
  }
};

const INFO_VACIA = { categories: [], productCount: 0, minPrice: 0, topProducts: [], orderCount: 0, popularityScore: 0 };

/** La forma que consume el catálogo, igual en todos los endpoints. */
function formatear(b, info) {
  const i = info?.[b._id.toString()] || INFO_VACIA;
  const c = b.location?.coordinates;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return {
    _id: b._id,
    businessName: b.businessName,
    slug: b.slug,
    logo: b.logo,
    coverImage: b.coverImage,
    description: b.description,
    theme: b.theme,
    address: b.address,
    whatsappNumber: b.whatsappNumber,
    socialMedia: b.socialMedia,
    department: b.department,
    city: b.city,
    coordinates: c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    isOpen: b.isOpen,
    isCurrentlyOpen: b.isCurrentlyOpen,
    tipoTienda: b.tipoTienda || 'restaurante',
    businessHours: b.businessHours,
    todayHours: b.businessHours?.[ahoraCOL().dia] || null,
    distance: b.distance,
    tieneDomicilio: b.tieneDomicilio,
    deliveryZone: b.deliveryZone,
    recibePedidos: b.recibePedidos,
    isNew: b.createdAt >= thirtyDaysAgo,
    productCount: i.productCount,
    minPrice: i.minPrice,
    topProducts: i.topProducts,
    popularityScore: i.popularityScore,
    orderCount: i.orderCount,
    categories: i.categories,
    reviewStats: b.reviewStats || { averageRating: 0, totalReviews: 0 }
  };
}

const conMenu = (negocios, info) => (info ? negocios.filter(b => info[b._id.toString()]?.productCount > 0) : negocios);

/**
 * GET /api/businesses
 * Todos los negocios visibles, del más cercano al más lejano.
 * Query params: lat, lon|lng, limit, offset, open (filtro abierto ahora)
 */
router.get('/', businessesLimiter, async (req, res) => {
  try {
    const origen = leerUbicacion(req.query);
    const limit = entero(req.query.limit, MAX_LISTA, 1, MAX_LISTA);
    const offset = entero(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    logger.info('GET /api/businesses', { withLocation: !!origen, limit, offset, open: req.query.open });

    const negocios = await BusinessConfig.find(filtroVisible()).select(CAMPOS_VITRINA).lean();
    const info = await getBatchBusinessInfo(negocios);

    let lista = await decorarParaVitrina(conMenu(negocios, info), origen);
    if (req.query.open === 'true') lista = lista.filter(b => b.isCurrentlyOpen);

    const popularidad = (b) => info?.[b._id.toString()]?.popularityScore || 0;
    ordenarPorCercania(lista, (a, b) => popularidad(b) - popularidad(a));

    const data = lista.slice(offset, offset + limit).map(b => formatear(b, info));

    logger.info(`Found ${data.length} businesses (total: ${lista.length})`, { count: data.length, total: lista.length });

    res.json({ data, total: lista.length, limit, offset });
  } catch (error) {
    logger.error('GET /api/businesses - Error', error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

/**
 * GET /api/businesses/featured
 * Secciones curadas: trending, precio bajo, recién llegados, menús grandes
 */
router.get('/featured', businessesLimiter, async (req, res) => {
  try {
    const origen = leerUbicacion(req.query);

    const negocios = await BusinessConfig.find(filtroVisible()).select(CAMPOS_VITRINA).lean();
    let lista = await decorarParaVitrina(negocios, origen);

    /* Las secciones son "lo bueno cerca de ti": un "Popular" de otra ciudad no
       le sirve a nadie. La lista completa sí trae a todos. */
    if (origen) lista = lista.filter(b => b.distance != null && b.distance <= RADIO_CERCANO_KM);

    const info = await getBatchBusinessInfo(lista);
    const allFormatted = ordenarPorCercania(conMenu(lista, info)).map(b => formatear(b, info));

    // Threshold relativo para cheapEats: negocios cuyo precio mínimo está por debajo
    // del promedio — funciona independientemente de la moneda del negocio.
    const validPrices = allFormatted.filter(b => b.minPrice > 0).map(b => b.minPrice);
    const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;
    const cheapThreshold = avgPrice * 0.75;

    // Solo con pedidos reales: sin ese filtro el puntaje de productos metía a cualquiera.
    const trending = allFormatted
      .filter(b => b.orderCount > 0)
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 8);

    const cheapEats = cheapThreshold > 0
      ? allFormatted
          .filter(b => b.minPrice > 0 && b.minPrice <= cheapThreshold)
          .sort((a, b) => a.minPrice - b.minPrice)
          .slice(0, 8)
      : [];

    const newOnes = allFormatted.filter(b => b.isNew).slice(0, 8);

    const bigMenus = allFormatted
      .filter(b => b.productCount >= 5)
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 8);

    res.json({
      success: true,
      sections: {
        trending: { title: '🔥 Trending', subtitle: 'Los más pedidos este mes', data: trending },
        cheapEats: { title: '💰 Comer barato', subtitle: 'Por debajo del precio promedio', data: cheapEats },
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
 * Retorna restaurantes + los productos que matchearon, del más cercano al más lejano
 */
router.get('/search/products', businessesLimiter, async (req, res) => {
  try {
    const { q } = req.query;
    const limit = entero(req.query.limit, 20, 1, 50);
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const negocios = await BusinessConfig.find(filtroVisible()).select(CAMPOS_VITRINA).lean();
    if (!negocios.length) return res.json({ success: true, data: [], total: 0, query: q });

    /* Se busca solo dentro de los menús de negocios visibles. Antes se tomaban
       los primeros 200 productos de toda la base —incluidos los de negocios
       ocultos o de prueba— y esos se comían el cupo. */
    const escapedQ = escaparRegex(q.trim());
    const matchingProducts = await Product.find({
      businessId: { $in: [...new Set(negocios.map(idDelMenu))] },
      active: true,
      $or: [
        { name: { $regex: escapedQ, $options: 'i' } },
        { description: { $regex: escapedQ, $options: 'i' } }
      ]
    }).select('businessId name price image').limit(500).lean();

    if (matchingProducts.length === 0) {
      return res.json({ success: true, data: [], total: 0, query: q });
    }

    const porMenu = {};
    for (const p of matchingProducts) {
      const menu = p.businessId.toString();
      if (!porMenu[menu]) porMenu[menu] = { productos: [], total: 0 };
      porMenu[menu].total++;
      if (porMenu[menu].productos.length < 4) {
        porMenu[menu].productos.push({ name: p.name, price: p.price, image: p.image || null });
      }
    }

    const conCoincidencias = negocios.filter(b => porMenu[idDelMenu(b)]);
    const decorados = await decorarParaVitrina(conCoincidencias, leerUbicacion(req.query));

    const results = ordenarPorCercania(
      decorados.map(b => {
        const m = porMenu[idDelMenu(b)];
        return { ...formatear(b), matchingProducts: m.productos, matchCount: m.total };
      }),
      (a, b) => b.matchCount - a.matchCount
    ).slice(0, limit);

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
    const { q } = req.query;
    const limit = entero(req.query.limit, 20, 1, 50);
    const offset = entero(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    logger.debug('Searching businesses', { query: q }, req);

    const extra = {};
    if (q) {
      const escapedQ = escaparRegex(q);
      extra.$or = [
        { businessName: { $regex: escapedQ, $options: 'i' } },
        { description: { $regex: escapedQ, $options: 'i' } }
      ];
    }

    const negocios = await BusinessConfig.find(filtroVisible(extra))
      .select(CAMPOS_VITRINA)
      .sort({ createdAt: -1 })
      .lean();

    const decorados = ordenarPorCercania(await decorarParaVitrina(negocios, leerUbicacion(req.query)));
    const pagina = decorados.slice(offset, offset + limit);
    const info = await getBatchBusinessInfo(pagina);

    res.json({
      success: true,
      data: pagina.map(b => formatear(b, info)),
      total: decorados.length,
      limit,
      offset
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
 * Obtener un negocio específico por ID o slug — con datos completos.
 * No aplica las reglas del marketplace: quien tiene el enlace llega igual que
 * al menú, que sigue accesible aunque el negocio no se recomiende.
 */
router.get('/:id', businessesLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const businessResult = await validateAndResolveBusinessId(id);
    if (!businessResult.success) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    const business = await BusinessConfig.findOne({
      _id: businessResult.businessId,
      isActive: true
    }).select(CAMPOS_VITRINA).lean();

    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }

    const [decorado] = await decorarParaVitrina([business], leerUbicacion(req.query));
    const info = await getBatchBusinessInfo([business]);

    logger.info(`Business found`, { id: business._id, name: business.businessName }, req);

    res.json(formatear(decorado, info));
  } catch (error) {
    logger.error(`GET /api/businesses/${req.params.id} - Error`, error, req);
    res.status(500).json(formatHttpError(req, 'Error interno del servidor', 500));
  }
});

module.exports = router;
