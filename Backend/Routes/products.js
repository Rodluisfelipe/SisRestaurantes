const express = require("express");
const router = express.Router();
const Product = require("../Models/Product");
const { emitToBusiness } = require("../services/socketService");
const mongoose = require("mongoose");
const { validateAndResolveBusinessId, createBusinessFilter } = require("../utils/businessValidator");
const { resolveBusinessId } = require("../utils/businessResolver");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");
const { audit } = require('../utils/auditLog');
const BusinessConfig = require('../Models/BusinessConfig');
const CompletedOrder = require('../Models/CompletedOrder');
const rateLimit = require('express-rate-limit');
const { getPlanLimitStatus, getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const {
  validateProductsReorder,
  validateReorderFeatured,
  validateToggleFeatured,
  validateDeleteProduct,
  validateToggleProduct,
  validateUpdateProductParam,
} = require('../middleware/validators/productValidators');

// Rate limiter for public product reads
const publicProductLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un momento' }
});

/**
 * API de Productos
 *
 * Proporciona endpoints para:
 * - GET /api/products: Obtener todos los productos
 * - POST /api/products: Crear un nuevo producto
 * - PUT /api/products/:id: Actualizar un producto existente
 * - DELETE /api/products/:id: Eliminar un producto
 */

// Función auxiliar para obtener todos los productos con sus relaciones
const getAllProducts = async () => {
  logger.debug('Getting all products with relations');
  const products = await Product.find()
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    })
    .lean();
  
  logger.debug(`Found ${products.length} products`);
  return products;
};

// Función para emitir actualización de productos
const emitProductsUpdate = async (req) => {
  try {
    const products = await getAllProducts();
    logger.info(`Emitting products update (${products.length} products)`);
    req.emitEvent('products_update', products);
  } catch (error) {
    logger.error('Error emitting products update', error);
  }
};

// GET all products
router.get("/", publicProductLimiter, async (req, res) => {
  try {
    let { businessId } = req.query;

    // useSharedMenu: redirect public menu queries to main branch's products
    try {
      const rawId = businessId && await resolveBusinessId(businessId);
      if (rawId) {
        const bizMeta = await BusinessConfig.findById(rawId, 'useSharedMenu mainBranchId').lean();
        if (bizMeta?.useSharedMenu && bizMeta?.mainBranchId) businessId = String(bizMeta.mainBranchId);
      }
    } catch (_) {}

    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    
    logger.debug('Searching products with filter', filter);
    
    const products = await Product.find(filter)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      })
      .sort({ displayOrder: 1, createdAt: 1 })
      .limit(500)
      .lean();
    
    logger.info(`Found ${products.length} products for business ${businessId}`);
    res.json(products);
  } catch (error) {
    logger.error("Error getting products", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET featured products (productos destacados) - DEBE estar ANTES de /:id
router.get("/featured", publicProductLimiter, async (req, res) => {
  try {
    let { businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }

    businessId = await resolveBusinessId(businessId);

    const featuredProducts = await Product.find({ 
      businessId,
      isFeatured: true,
      active: true
    })
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    })
    .sort({ featuredOrder: 1, displayOrder: 1 })
    .lean();

    logger.info(`Found ${featuredProducts.length} featured products for business ${businessId}`);
    res.json(featuredProducts);
  } catch (error) {
    logger.error("Error getting featured products", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener productos destacados", 500));
  }
});

// ─────────────────────────────────────────────────────────────
// GET /products/popular — "Los más pedidos" (sección premium del menú)
// Ranking por ventas reales + híbrido (destacados + favoritos por reseñas).
// Gated por plan de pago (feature popularSection). DEBE ir ANTES de /:id
// ─────────────────────────────────────────────────────────────

// Caché en memoria por negocio (TTL corto) para evitar agregaciones en cada carga del menú
const popularCache = new Map(); // businessId -> { expires, payload }
const POPULAR_TTL_MS = 3 * 60 * 1000;

function invalidatePopularCache(businessId) {
  if (businessId) popularCache.delete(String(businessId));
}
// Exponer para que otras rutas (config/admin/orders) puedan invalidar
router.invalidatePopularCache = invalidatePopularCache;

async function buildPopularPayload(businessId, popCfg) {
  const bid = new mongoose.Types.ObjectId(String(businessId));
  const mode = popCfg.mode || 'hybrid';
  const windowDays = Math.min(Math.max(parseInt(popCfg.windowDays, 10) || 30, 1), 365);
  const limit = Math.min(Math.max(parseInt(popCfg.limit, 10) || 10, 3), 24);
  const minOrders = Math.max(parseInt(popCfg.minOrders, 10) || 0, 0);
  const pinned = (popCfg.pinnedProductIds || []).map(String);
  const hidden = new Set((popCfg.hiddenProductIds || []).map(String));

  const now = Date.now();
  const since = new Date(now - windowDays * 86400000);
  const weekAgo = new Date(now - 7 * 86400000);

  // Agregación de ventas reales desde pedidos completados
  let salesAgg = [];
  if (mode !== 'manual') {
    salesAgg = await CompletedOrder.aggregate([
      { $match: { businessId: bid, completedAt: { $gte: since } } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $ne: null } } },
      { $group: {
        _id: '$items.productId',
        units: { $sum: '$items.quantity' },
        lines: { $sum: 1 },
        weeklyLines: { $sum: { $cond: [{ $gte: ['$completedAt', weekAgo] }, 1, 0] } }
      }},
      { $sort: { units: -1, lines: -1 } },
      { $limit: 60 }
    ]);
  }

  const statsById = new Map();
  salesAgg.forEach(s => statsById.set(String(s._id), s));

  // Orden de candidatos: fijados -> ranking de ventas -> (híbrido) destacados/favoritos
  const ordered = [];
  const seen = new Set();
  const pushId = (id) => {
    const key = String(id);
    if (!key || seen.has(key) || hidden.has(key)) return;
    seen.add(key);
    ordered.push(key);
  };

  pinned.forEach(pushId);

  salesAgg
    .filter(s => s.lines >= minOrders)
    .forEach(s => pushId(s._id));

  // Modo híbrido / manual: completar con destacados y favoritos por reseñas
  let favoriteIds = [];
  if (mode === 'hybrid' || mode === 'manual' || ordered.length < limit) {
    try {
      const cfg = await BusinessConfig.findById(bid).select('reviewStats.favoriteProductIds').lean();
      favoriteIds = (cfg?.reviewStats?.favoriteProductIds || []).map(String);
    } catch { /* noop */ }
  }

  if (mode !== 'auto') {
    const featured = await Product.find({ businessId: bid, isFeatured: true, active: true })
      .sort({ featuredOrder: 1, displayOrder: 1 }).select('_id').lean();
    featured.forEach(p => pushId(p._id));
    favoriteIds.forEach(pushId);
  } else {
    // En auto, solo rellenar si hay muy pocos resultados (UX): nada extra
  }

  const favoriteSet = new Set(favoriteIds);
  const finalIds = ordered.slice(0, limit);
  if (finalIds.length === 0) {
    return { enabled: true, title: popCfg.title || 'Los más pedidos', showBadges: !!popCfg.showBadges, showOrderCounts: !!popCfg.showOrderCounts, windowDays, products: [] };
  }

  // Cargar productos reales (activos) preservando el orden calculado
  const products = await Product.find({ _id: { $in: finalIds }, businessId: bid, active: true })
    .populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    })
    .lean();

  const productsById = new Map(products.map(p => [String(p._id), p]));
  const pinnedSet = new Set(pinned);

  // Ranking solo entre los que tienen ventas, para badges #1/#2/#3
  const salesRankIds = salesAgg.filter(s => s.lines >= minOrders).map(s => String(s._id));
  const rankById = new Map();
  salesRankIds.forEach((id, i) => rankById.set(id, i + 1));

  const result = [];
  finalIds.forEach((id) => {
    const p = productsById.get(id);
    if (!p) return; // producto inactivo o borrado
    const s = statsById.get(id);
    const rank = rankById.get(id) || null;
    result.push({
      ...p,
      popular: {
        rank,
        units: s?.units || 0,
        weeklyCount: s?.weeklyLines || 0,
        isTopSeller: !!(rank && rank <= 3 && (s?.units || 0) > 0),
        isFavorite: favoriteSet.has(id),
        isFeatured: !!p.isFeatured,
        isPinned: pinnedSet.has(id)
      }
    });
  });

  return {
    enabled: true,
    title: popCfg.title || 'Los más pedidos',
    showBadges: popCfg.showBadges !== false,
    showOrderCounts: popCfg.showOrderCounts !== false,
    windowDays,
    products: result
  };
}

router.get("/popular", publicProductLimiter, async (req, res) => {
  try {
    let { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }
    businessId = await resolveBusinessId(businessId);
    const cacheKey = String(businessId);

    // Servir desde caché si está fresco
    const cached = popularCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.payload);
    }

    const config = await BusinessConfig.findById(businessId).select('popularSection').lean();
    const popCfg = config?.popularSection || {};

    // Apagado por el negocio
    if (popCfg.enabled === false) {
      const payload = { enabled: false, products: [] };
      popularCache.set(cacheKey, { expires: Date.now() + POPULAR_TTL_MS, payload });
      return res.json(payload);
    }

    // Gating por plan de pago
    const { planConfig } = await getSubscriptionForBusiness(businessId);
    if (!isFeatureEnabledForPlan(planConfig, 'popularSection')) {
      const payload = { enabled: false, locked: true, products: [] };
      popularCache.set(cacheKey, { expires: Date.now() + POPULAR_TTL_MS, payload });
      return res.json(payload);
    }

    const payload = await buildPopularPayload(businessId, popCfg);
    popularCache.set(cacheKey, { expires: Date.now() + POPULAR_TTL_MS, payload });
    res.json(payload);
  } catch (error) {
    logger.error("Error getting popular products", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener los más pedidos", 500));
  }
});

// PUT /products/popular/config — admin: configurar la sección "Los más pedidos"
// DEBE ir antes de cualquier PUT /:id
router.put("/popular/config", tenantAuth, async (req, res) => {
  try {
    let { businessId, ...body } = req.body;
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }
    businessId = await resolveBusinessId(businessId);

    const cfg = await BusinessConfig.findById(businessId).select('popularSection').lean();
    const next = { ...(cfg?.popularSection || {}) };

    if (body.enabled !== undefined) next.enabled = !!body.enabled;
    if (typeof body.title === 'string') next.title = body.title.trim().slice(0, 40) || 'Los más pedidos';
    if (['auto', 'hybrid', 'manual'].includes(body.mode)) next.mode = body.mode;
    if (body.windowDays !== undefined) next.windowDays = Math.min(Math.max(parseInt(body.windowDays, 10) || 30, 1), 365);
    if (body.limit !== undefined) next.limit = Math.min(Math.max(parseInt(body.limit, 10) || 10, 3), 24);
    if (body.minOrders !== undefined) next.minOrders = Math.max(parseInt(body.minOrders, 10) || 0, 0);
    if (body.showBadges !== undefined) next.showBadges = !!body.showBadges;
    if (body.showOrderCounts !== undefined) next.showOrderCounts = !!body.showOrderCounts;

    const toIds = (arr) => Array.isArray(arr)
      ? arr.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(String(id)))
      : undefined;
    const pinned = toIds(body.pinnedProductIds); if (pinned) next.pinnedProductIds = pinned;
    const hidden = toIds(body.hiddenProductIds); if (hidden) next.hiddenProductIds = hidden;

    const updated = await BusinessConfig.findByIdAndUpdate(
      businessId,
      { $set: { popularSection: next } },
      { new: true }
    ).select('popularSection').lean();

    invalidatePopularCache(businessId);
    logger.info(`Updated popular section config for business ${businessId}`, null, req);
    res.json(updated?.popularSection || next);
  } catch (error) {
    logger.error("Error updating popular section config", error, req);
    res.status(500).json(formatHttpError(req, "Error al guardar la configuración de los más pedidos", 500));
  }
});

// GET /products/:id (si existe)
/* ══════════════════════════════════════════════════════════════════
   INVENTARIO

   El stock vivía dentro del formulario de cada producto, así que para saber
   qué se estaba agotando había que abrirlos uno por uno. Estas rutas existen
   para verlo y ajustarlo desde un solo lugar.
   ══════════════════════════════════════════════════════════════════ */

/**
 * GET /api/products/inventory — estado del inventario del negocio.
 *
 * Va ANTES de /:id: si no, Express leería "inventory" como un id de producto.
 */
router.get("/inventory", tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const productos = await Product.find({ businessId })
      .select('name image price cost stock trackStock lowStockAlert active category')
      .populate('category', 'name')
      .lean();

    const conControl = productos.filter(p => p.trackStock);
    const agotados = conControl.filter(p => (p.stock ?? 0) <= 0);
    const bajos = conControl.filter(p => {
      const s = p.stock ?? 0;
      return s > 0 && s <= (p.lowStockAlert || 5);
    });

    /* Orden por urgencia: primero lo agotado, luego lo que está por acabarse,
       después el resto. Es el orden en que hay que actuar. */
    const peso = (p) => {
      if (!p.trackStock) return 3;
      const s = p.stock ?? 0;
      if (s <= 0) return 0;
      if (s <= (p.lowStockAlert || 5)) return 1;
      return 2;
    };
    productos.sort((a, b) => peso(a) - peso(b) || (a.name || '').localeCompare(b.name || ''));

    res.json({
      productos,
      resumen: {
        total: productos.length,
        conControl: conControl.length,
        sinControl: productos.length - conControl.length,
        agotados: agotados.length,
        bajos: bajos.length,
        // Cuánto dinero hay parado en la bodega, a precio de venta
        /* Valor a COSTO cuando el producto lo tiene. Antes se calculaba con
           el precio al publico, que no es lo que el negocio tiene invertido:
           mostraba una cifra que parecia una valoracion y no lo era. */
        valorInventario: conControl.reduce((s, p) => s + ((p.cost ?? p.price) || 0) * Math.max(0, p.stock ?? 0), 0),
        conCosto: conControl.filter(p => p.cost != null).length,
      },
    });
  } catch (error) {
    logger.error('Error obteniendo inventario', error, req);
    res.status(500).json({ message: 'Error al obtener el inventario' });
  }
});

/**
 * PATCH /api/products/inventory/mode — nivel de inventario del negocio.
 *
 * off      sin control
 * basic    contador por producto, historial, costo y aviso de agotados
 * advanced además insumos y recetas: vender una hamburguesa descuenta pan,
 *          carne y queso en vez de "hamburguesas"
 */
router.patch("/inventory/mode", tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const { mode } = req.body;
    if (!['off', 'basic', 'advanced'].includes(mode)) {
      return res.status(400).json({ message: 'Nivel inválido. Debe ser off, basic o advanced' });
    }

    const negocio = await BusinessConfig.findByIdAndUpdate(
      businessId,
      { 'inventory.mode': mode },
      { new: true }
    ).select('inventory').lean();
    if (!negocio) return res.status(404).json({ message: 'Negocio no encontrado' });

    logger.info('Nivel de inventario cambiado', { businessId, mode });
    res.json({ mode: negocio.inventory?.mode || 'off' });
  } catch (error) {
    logger.error('Error cambiando el nivel de inventario', error, req);
    res.status(500).json({ message: 'Error al cambiar el nivel' });
  }
});

/**
 * GET /api/products/inventory/movements — historial de movimientos.
 *
 * Sin esto, cuando un conteo no cuadraba no había forma de saber por qué.
 * Query: productId (opcional, para el historial de uno solo), limit.
 */
router.get("/inventory/movements", tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: "businessId es requerido" });

    const StockMovement = require('../Models/StockMovement');
    const filtro = { businessId };
    if (req.query.productId) filtro.productId = req.query.productId;

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const movimientos = await StockMovement.find(filtro)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ movimientos, tipos: StockMovement.TIPOS });
  } catch (error) {
    logger.error('Error obteniendo movimientos de inventario', error, req);
    res.status(500).json({ message: 'Error al obtener el historial' });
  }
});

/**
 * PATCH /api/products/:id/stock — ajusta el inventario de un producto.
 *
 * Endpoint aparte del PUT general a propósito: guardar todo el producto para
 * cambiar una cantidad arriesga pisar campos que no se están editando.
 *
 * body: { stock?, trackStock?, lowStockAlert?, delta? }
 * `delta` suma o resta sobre lo que haya, para los botones de +/− sin pisar
 * lo que otra persona haya ajustado mientras tanto.
 */
router.patch("/:id/stock", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.businessId || req.body.businessId;
    const producto = await Product.findOne({ _id: id, ...(businessId ? { businessId } : {}) });
    if (!producto) return res.status(404).json({ message: 'Producto no encontrado' });

    const { stock, trackStock, lowStockAlert, delta, cost } = req.body;
    const stockAntes = producto.stock;

    if (trackStock !== undefined) {
      producto.trackStock = !!trackStock;
      // Al activar el control sin dar cantidad, se arranca en 0 y no en null:
      // null significa "ilimitado" y dejaría el control sin efecto.
      if (producto.trackStock && producto.stock == null) producto.stock = 0;
    }

    if (delta !== undefined) {
      const d = parseInt(delta, 10);
      if (!Number.isInteger(d)) return res.status(400).json({ message: 'delta debe ser un entero' });
      producto.stock = Math.max(0, (producto.stock ?? 0) + d);
    } else if (stock !== undefined) {
      if (stock === null) {
        producto.stock = null;   // ilimitado
      } else {
        const s = parseInt(stock, 10);
        if (!Number.isInteger(s) || s < 0) return res.status(400).json({ message: 'stock debe ser un entero de 0 o más' });
        producto.stock = s;
      }
    }

    if (cost !== undefined) {
      if (cost === null || cost === '') {
        producto.cost = null;
      } else {
        const c = Number(cost);
        if (!Number.isFinite(c) || c < 0) return res.status(400).json({ message: 'El costo debe ser un numero de 0 o mas' });
        producto.cost = c;
      }
    }

    if (lowStockAlert !== undefined) {
      const a = parseInt(lowStockAlert, 10);
      if (!Number.isInteger(a) || a < 0) return res.status(400).json({ message: 'El aviso debe ser un entero de 0 o más' });
      producto.lowStockAlert = a;
    }

    await producto.save();

    /* Todo ajuste manual queda en el historial. Es la diferencia entre "el
       conteo no cuadra y nadie sabe por qué" y poder reconstruir qué pasó. */
    if (producto.stock !== stockAntes) {
      const StockMovement = require('../Models/StockMovement');
      await StockMovement.create({
        businessId: producto.businessId,
        productId: producto._id,
        productName: producto.name,
        type: req.body.motivo === 'waste' ? 'waste'
          : req.body.motivo === 'purchase' ? 'purchase'
          : stockAntes === null ? 'initial' : 'adjust',
        quantity: (producto.stock ?? 0) - (stockAntes ?? 0),
        stockBefore: stockAntes,
        stockAfter: producto.stock,
        userId: req.user?.id || null,
        note: (req.body.nota || '').slice(0, 200),
      }).catch((e) => logger.warn('No se pudo registrar el movimiento', { error: e.message }));
    }

    logger.info('Inventario ajustado', { productId: id, stock: producto.stock, trackStock: producto.trackStock });

    res.json({
      _id: producto._id,
      name: producto.name,
      stock: producto.stock,
      cost: producto.cost,
      trackStock: producto.trackStock,
      lowStockAlert: producto.lowStockAlert,
    });
  } catch (error) {
    logger.error('Error ajustando inventario', error, req);
    res.status(500).json({ message: 'Error al ajustar el inventario' });
  }
});

router.get("/:id", publicProductLimiter, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      });
    res.json(product);
  } catch (error) {
    logger.error("Error al obtener producto", error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener producto', 500));
  }
});

// Validación de entrada para crear/actualizar producto
const validateProductInput = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json(
      formatHttpError(req, 'El cuerpo de la solicitud es inválido o está vacío', 400)
    );
  }
  const errors = [];
  let { name, price, businessId } = req.body;
  
  // Validar name
  if (!name) {
    errors.push({ field: 'name', message: 'name es requerido' });
  } else if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name debe ser un string no vacío' });
  }
  
  // Validar y convertir price (puede venir como string desde FormData)
  if (price === undefined || price === null) {
    errors.push({ field: 'price', message: 'price es requerido' });
  } else {
    // Convertir a número si viene como string (FormData)
    if (typeof price === 'string') {
      price = parseFloat(price);
      req.body.price = price; // Actualizar el valor en req.body
    }
    
    if (typeof price !== 'number' || isNaN(price) || price < 0) {
      errors.push({ field: 'price', message: 'price debe ser un número >= 0' });
    }
  }
  
  // Validar businessId (solo para POST, en PUT se valida en el endpoint)
  if (req.method === 'POST') {
    if (!businessId) {
      errors.push({ field: 'businessId', message: 'businessId es requerido' });
    } else if (typeof businessId !== 'string') {
      errors.push({ field: 'businessId', message: 'businessId debe ser un string' });
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

// POST a product
router.post("/", tenantAuth, validateProductInput, async (req, res) => {
  try {
    let productData = req.body;
    
    // Si los toppingGroups vienen como string (desde FormData), parsearlo
    if (typeof productData.toppingGroups === 'string') {
      productData.toppingGroups = JSON.parse(productData.toppingGroups);
    }
    
    // Procesar el orden de los toppings si viene en el request
    if (productData.toppingGroups && Array.isArray(productData.toppingGroups)) {
      productData.toppingGroupsOrder = productData.toppingGroups.map((toppingId, index) => ({
        toppingGroupId: toppingId,
        order: index
      }));
    }
    
    // Force businessId from authenticated user's token, fallback for superadmin
    productData.businessId = req.user.businessId || req.body.businessId;

    const currentCount = await Product.countDocuments({ businessId: productData.businessId });
    const limitStatus = await getPlanLimitStatus({
      businessId: productData.businessId,
      resourceKey: 'products',
      currentCount
    });

    if (limitStatus.limitReached) {
      return res.status(403).json(
        formatHttpError(req, limitStatus.message, 403, {
          code: 'PLAN_LIMIT_REACHED',
          resource: 'products',
          plan: limitStatus.commercialPlan,
          limit: limitStatus.limitValue,
          current: currentCount
        })
      );
    }
    
    const newProduct = new Product(productData);
    await newProduct.save();
    
    // Obtener el producto con sus relaciones
    const populatedProduct = await Product.findById(newProduct._id)
      .populate({
        path: 'toppingGroups',
        match: { active: true },
        select: 'name description isMultipleChoice isRequired options basePrice subGroups'
      });
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(newProduct.businessId?.toString(), "products_update", { type: "created", product: populatedProduct });
    
    // Audit log
    const bizCreate = await BusinessConfig.findById(newProduct.businessId).select('businessName').lean();
    audit({ action: 'create', resource: 'product', resourceId: newProduct._id, resourceName: newProduct.name, businessId: newProduct.businessId, businessName: bizCreate?.businessName, after: newProduct.toObject(), req });
    
    logger.info(`Created new product: ${newProduct.name} for business ${productData.businessId}`);
    res.json(populatedProduct);
  } catch (error) {
    logger.error("Error creating product", error, req);
    res.status(500).json(formatHttpError(req, "Error creating product", 500));
  }
});

// Test endpoint without middleware
router.put("/reorder-simple", tenantAuth, async (req, res) => {
  logger.debug("Simple test endpoint hit", { timestamp: new Date().toISOString() }, req);
  res.json({ success: true, message: "Simple endpoint working", timestamp: new Date().toISOString() });
});

// Reorder products (working endpoint)
router.put("/products-reorder", tenantAuth, validateProductsReorder, async (req, res) => {
  logger.debug("PRODUCTS-REORDER ENDPOINT CALLED", { timestamp: new Date().toISOString() }, req);
  
  try {
    const { businessId, products } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "businessId es requerido" });
    }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: "Formato inválido para products" });
    }
    
    logger.debug("Reordenando productos", { businessId, productsCount: products.length }, req);
    
    // Usar bulkWrite para actualizar todos los productos de una vez (más eficiente)
    // Compound filter ensures tenant isolation on each update
    const tenantBusinessId = req.user.businessId || req.body.businessId;
    const bulkOps = products.map(productData => ({
      updateOne: {
        filter: { _id: productData._id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) },
        update: { displayOrder: productData.order }
      }
    }));
    
    const result = await Product.bulkWrite(bulkOps);
    logger.debug("Bulk update result", { modifiedCount: result.modifiedCount }, req);
    
    // Emitir evento de actualización
    emitToBusiness(businessId, "products_update", { 
      type: "reordered", 
      businessId,
      message: "Orden de productos actualizado" 
    });
    
    res.json({ success: true, message: "Orden de productos actualizado correctamente" });
  } catch (error) {
    logger.error("Error al reordenar productos", error, req);
    res.status(500).json(formatHttpError(req, "Error al reordenar los productos", 500));
  }
});

// Reorder products
router.put("/reorder", tenantAuth, async (req, res) => {
  logger.debug("REORDER ENDPOINT CALLED", { timestamp: new Date().toISOString() }, req);
  
  try {
    res.json({ success: true, message: "Endpoint simplificado funcionando" });
  } catch (error) {
    logger.error("Error en endpoint simplificado", error, req);
    res.status(500).json(formatHttpError(req, "Error en endpoint simplificado", 500));
  }
});

// PUT reorder featured products
router.put("/reorder-featured", tenantAuth, validateReorderFeatured, async (req, res) => {
  try {
    logger.info('Reorder featured products endpoint called', { body: req.body });
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      logger.warn('Invalid orderedIds', { orderedIds, type: typeof orderedIds });
      return res.status(400).json(formatHttpError(req, "orderedIds debe ser un array no vacío", 400));
    }

    // Actualizar el featuredOrder de cada producto (compound filter for tenant isolation)
    const tenantBusinessId = req.user.businessId || req.body.businessId;
    const updatePromises = orderedIds.map((id, index) => 
      Product.findOneAndUpdate({ _id: id, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) }, { featuredOrder: index + 1 })
    );

    await Promise.all(updatePromises);

    logger.info(`Reordered ${orderedIds.length} featured products`);

    // Obtener businessId del primer producto para el socket
    const firstProduct = await Product.findById(orderedIds[0]);
    if (firstProduct) {
      emitToBusiness(firstProduct.businessId?.toString(), "products_reordered", {
        type: "featured_reordered",
        count: orderedIds.length
      });
    }

    res.json({
      success: true,
      message: `${orderedIds.length} productos destacados reordenados correctamente`
    });
  } catch (error) {
    logger.error("Error reordering featured products", error, req);
    res.status(500).json(formatHttpError(req, "Error al reordenar productos destacados", 500));
  }
});

// PUT toggle featured status (DEBE estar ANTES de /:id genérico)
router.put("/:id/toggle-featured", tenantAuth, validateToggleFeatured, async (req, res) => {




  try {
    const { id } = req.params;
    const { featuredOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatHttpError(req, "ID de producto inválido", 400));
    }


    const product = await Product.findOne({ _id: id, ...(req.user.businessId ? { businessId: req.user.businessId } : {}) });

    if (!product) {

      return res.status(404).json(formatHttpError(req, "Producto no encontrado", 404));
    }


    // Si está activando featured, verificar límite de 5
    if (!product.isFeatured) {

      const featuredCount = await Product.countDocuments({
        businessId: product.businessId,
        isFeatured: true,
        _id: { $ne: product._id }
      });


      if (featuredCount >= 5) {

        return res.status(400).json({
          success: false,
          message: 'No puedes tener más de 5 productos destacados. Remueve uno primero.',
          limit: 5,
          current: featuredCount
        });
      }
    }


    product.isFeatured = !product.isFeatured;
    
    // Si se está marcando como destacado y no tiene orden, asignar el siguiente
    if (product.isFeatured) {

      if (featuredOrder !== undefined) {
        product.featuredOrder = featuredOrder;
      } else if (!product.featuredOrder || product.featuredOrder === 0) {
        // Buscar el orden más alto actual
        const maxOrder = await Product.findOne({
          businessId: product.businessId,
          isFeatured: true,
          _id: { $ne: product._id }
        }).sort('-featuredOrder').select('featuredOrder');
        product.featuredOrder = maxOrder && maxOrder.featuredOrder ? maxOrder.featuredOrder + 1 : 1;

      }
    } else {
      // Si se está quitando de destacados, limpiar el orden
      product.featuredOrder = 0;

    }


    
    // Usar updateOne directamente para forzar la actualización de campos que no existen
    const updateResult = await Product.updateOne(
      { _id: id },
      { 
        $set: { 
          isFeatured: product.isFeatured, 
          featuredOrder: product.featuredOrder 
        } 
      }
    );
    

    
    // Recargar el producto para obtener los valores actualizados
    const updatedProduct = await Product.findById(id);



    
    // Actualizar el objeto product con los valores confirmados
    product.isFeatured = updatedProduct.isFeatured;
    product.featuredOrder = updatedProduct.featuredOrder;

    logger.info(`Product ${id} featured status toggled to ${product.isFeatured}`);

    // Emit update
    emitToBusiness(req, product.businessId, "product_featured_update", {
      type: "featured_toggled",
      productId: product._id,
      isFeatured: product.isFeatured
    });


    res.json({
      success: true,
      message: `Producto ${product.isFeatured ? 'marcado como destacado' : 'removido de destacados'}`,
      product: {
        _id: product._id,
        name: product.name,
        isFeatured: product.isFeatured,
        featuredOrder: product.featuredOrder
      }
    });

  } catch (error) {
    logger.error('Error en toggle featured:', error);
    // Stack trace logged internally by Sentry
    logger.error("Error toggling featured status", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar estado destacado", 500));
  }
});

// PUT a product
router.put("/:id", tenantAuth, validateUpdateProductParam, validateProductInput, async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category, image, toppingGroups, promo } = req.body;
    
    // Force businessId from token, fallback to body for superadmin
    const finalBusinessId = req.user.businessId || req.body.businessId;

    if (!finalBusinessId) {
      return res.status(400).json(formatHttpError(req, "businessId es requerido", 400));
    }
    
    // Procesar el orden de los toppings
    let toppingGroupsOrder = [];
    if (toppingGroups && Array.isArray(toppingGroups)) {
      toppingGroupsOrder = toppingGroups.map((toppingId, index) => ({
        toppingGroupId: toppingId,
        order: index
      }));
    }

    // Snapshot before update for audit
    const beforeUpdate = await Product.findOne({ _id: productId, businessId: finalBusinessId }).lean();

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, businessId: finalBusinessId },
      { 
        name, 
        description, 
        price, 
        category, 
        image,
        businessId: finalBusinessId,
        // Asegúrate de que toppingGroups se actualice correctamente
        toppingGroups: toppingGroups || [],
        toppingGroupsOrder: toppingGroupsOrder,
        // Solo actualizar promo si el cliente la envió (no borrarla en clientes viejos)
        ...(promo !== undefined ? { promo } : {})
      },
      { new: true }
    ).populate({
      path: 'toppingGroups',
      match: { active: true },
      select: 'name description isMultipleChoice isRequired options basePrice subGroups'
    });
    
    if (!updatedProduct) {
      return res.status(404).json(formatHttpError(req, "Producto no encontrado", 404));
    }

    logger.info('Producto actualizado', { productId: updatedProduct._id.toString() }, req);
    
    // Audit log
    if (beforeUpdate) {
      const bizUpdate = await BusinessConfig.findById(finalBusinessId).select('businessName').lean();
      audit({ action: 'update', resource: 'product', resourceId: productId, resourceName: updatedProduct.name, businessId: finalBusinessId, businessName: bizUpdate?.businessName, before: beforeUpdate, after: updatedProduct.toObject(), req });
    }
    
    res.json(updatedProduct);
  } catch (error) {
    logger.error('Error al actualizar producto', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar producto', 500));
  }
});

// DELETE a product
router.delete("/:id", tenantAuth, validateDeleteProduct, async (req, res) => {
  try {
    // Use businessId from token for tenant isolation, fallback for superadmin
    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    // Snapshot before delete for audit
    const beforeDelete = await Product.findOne({ _id: req.params.id, ...(tenantBizId ? { businessId: tenantBizId } : {}) }).lean();

    const deletedProduct = await Product.findOneAndDelete({ _id: req.params.id, ...(tenantBizId ? { businessId: tenantBizId } : {}) });
    
    // Emitir evento de actualización por WebSocket
    if (deletedProduct) {
      emitToBusiness(deletedProduct.businessId?.toString(), "products_update", { type: "deleted", productId: deletedProduct._id });
      // Audit log
      const bizDel = await BusinessConfig.findById(deletedProduct.businessId).select('businessName').lean();
      audit({ action: 'delete', resource: 'product', resourceId: deletedProduct._id, resourceName: deletedProduct.name, businessId: deletedProduct.businessId, businessName: bizDel?.businessName, before: beforeDelete, req });
    }
    
    res.json({ message: "Producto eliminado" });
  } catch (error) {
    logger.error("Error al eliminar producto", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar el producto", 500));
  }
});

// Toggle active status of a product
router.patch("/:id/toggle", tenantAuth, validateToggleProduct, async (req, res) => {
  try {
    const productId = req.params.id;
    
    logger.debug("Toggling product", { productId }, req);
    
    // Compound query for tenant isolation, fallback for superadmin
    const tenantBizIdToggle = req.user.businessId || req.body.businessId;
    const product = await Product.findOne({ _id: productId, ...(tenantBizIdToggle ? { businessId: tenantBizIdToggle } : {}) });
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    // Snapshot before toggle
    const beforeToggle = product.toObject();
    
    // Toggle del estado activo
    product.active = !product.active;
    await product.save();
    
    // Audit log
    const bizToggle = await BusinessConfig.findById(product.businessId).select('businessName').lean();
    audit({ action: 'toggle', resource: 'product', resourceId: product._id, resourceName: product.name, businessId: product.businessId, businessName: bizToggle?.businessName, before: beforeToggle, after: product.toObject(), req });
    
    logger.info(`Product toggled`, { productId: product._id.toString(), name: product.name, active: product.active }, req);
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(product.businessId?.toString(), "products_update", { 
      type: "toggled", 
      productId: product._id,
      active: product.active
    });
    
    res.json({ 
      success: true, 
      message: `Producto ${product.active ? 'activado' : 'desactivado'} correctamente`,
      product: {
        _id: product._id,
        name: product.name,
        active: product.active
      }
    });
  } catch (error) {
    logger.error("Error toggling product", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar el estado del producto", 500));
  }
});

module.exports = router;
