const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Coupon = require('../Models/Coupon');
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const authMiddleware = require('../middleware/authMiddleware');
const { resolveBusinessId } = require('../utils/businessResolver');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { getPlanLimitStatus } = require('../utils/subscriptionHelper');

// Rate limiter for public coupon validation (prevent brute-force)
const couponValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, reason: 'Too many requests, try again later' }
});

// Todas las rutas de creación/gestión requieren SuperAdmin
router.use('/admin', protectSuperAdmin);

// GET /api/coupons/admin/list - Listar todos los cupones (SuperAdmin)
router.get('/admin/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, active = 'all' } = req.query;
    
    let query = {};
    if (active === 'true') query.isActive = true;
    else if (active === 'false') query.isActive = false;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const coupons = await Coupon.find(query)
      .populate('createdBy', 'username')
      .populate('usedBy.businessId', 'businessName slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Coupon.countDocuments(query);
    
    res.json({
      success: true,
      coupons: coupons.map(c => ({
        id: c._id,
        code: c.code,
        months: c.months,
        description: c.description,
        createdBy: c.createdBy?.username || 'N/A',
        usedCount: c.usedBy.length,
        maxUses: c.maxUses,
        isActive: c.isActive,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        usageDetails: c.usedBy.map(u => ({
          businessName: u.businessId?.businessName || 'N/A',
          usedAt: u.usedAt
        }))
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching coupons', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener cupones', 500));
  }
});

// POST /api/coupons/admin/create - Crear nuevo cupón (SuperAdmin)
router.post('/admin/create', async (req, res) => {
  try {
    const { months, description, maxUses, expiresAt } = req.body;
    
    if (!months || months < 1 || months > 12) {
      return res.status(400).json(formatHttpError(req, 'Los meses deben estar entre 1 y 12', 400));
    }
    
    // Generar código único
    const code = await Coupon.generateCode();
    
    const coupon = new Coupon({
      code,
      months: parseInt(months),
      description: description || `${months} ${months === 1 ? 'mes' : 'meses'} gratis`,
      createdBy: req.user.id,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true
    });
    
    await coupon.save();
    
    logger.info('Coupon created', { couponId: coupon._id, code: coupon.code, months: coupon.months }, req);
    
    res.status(201).json({
      success: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        months: coupon.months,
        description: coupon.description,
        maxUses: coupon.maxUses,
        expiresAt: coupon.expiresAt,
        shareUrl: `${process.env.FRONTEND_URL || 'https://www.menuby.tech'}/admin/subscriptions?coupon=${coupon.code}`
      }
    });
  } catch (error) {
    logger.error('Error creating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear cupón', 500));
  }
});

// PUT /api/coupons/admin/:id - Actualizar cupón (SuperAdmin)
router.put('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, maxUses, expiresAt, isActive } = req.body;
    
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }
    
    if (description !== undefined) coupon.description = description;
    if (maxUses !== undefined) coupon.maxUses = maxUses ? parseInt(maxUses) : null;
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) coupon.isActive = isActive;
    
    await coupon.save();
    
    res.json({
      success: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        months: coupon.months,
        description: coupon.description,
        maxUses: coupon.maxUses,
        expiresAt: coupon.expiresAt,
        isActive: coupon.isActive
      }
    });
  } catch (error) {
    logger.error('Error updating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar cupón', 500));
  }
});

// POST /api/coupons/redeem - Canjear cupón (Admin autenticado)
router.post('/redeem', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json(formatHttpError(req, 'Código de cupón requerido', 400));
    }
    
    // Resolver businessId
    let businessId = req.user.businessId;
    if (!businessId && req.user.id) {
      const Admin = require('../Models/Admin');
      const admin = await Admin.findById(req.user.id).select('businessId');
      if (admin && admin.businessId) {
        businessId = admin.businessId.toString();
      }
    }
    
    if (!businessId) {
      return res.status(403).json(formatHttpError(req, 'No se pudo determinar el negocio', 403));
    }
    
    // Buscar cupón
    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }
    
    // Verificar si puede ser usado
    const validation = coupon.canBeUsed(businessId);
    if (!validation.valid) {
      return res.status(400).json(formatHttpError(req, validation.reason, 400));
    }
    
    // Obtener suscripción actual del negocio
    let subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 });
    
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'No tienes una suscripción activa', 404));
    }
    
    // Calcular nueva fecha de fin basada en meses del cupón
    const now = new Date();
    let newEndDate = subscription.endDate > now ? subscription.endDate : now;
    
    // Agregar los meses del cupón
    newEndDate = new Date(newEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + coupon.months);
    
    // Actualizar suscripción
    subscription.endDate = newEndDate;
    subscription.gracePeriodEnd = new Date(newEndDate.getTime() + (24 * 60 * 60 * 1000)); // 1 día extra de gracia
    subscription.status = 'active';
    subscription.paymentStatus = 'paid';
    subscription.paymentMethod = 'COUPON';
    subscription.couponCode = coupon.code;
    subscription.couponId = coupon._id;
    subscription.price = 0; // Gratis por cupón
    
    await subscription.save();
    
    // Registrar uso del cupón
    coupon.usedBy.push({
      businessId: businessId,
      usedAt: now
    });
    await coupon.save();
    
    logger.info('Coupon redeemed', {
      couponId: coupon._id,
      code: coupon.code,
      businessId,
      months: coupon.months,
      newEndDate
    }, req);
    
    res.json({
      success: true,
      message: `¡Cupón canjeado exitosamente! Has recibido ${coupon.months} ${coupon.months === 1 ? 'mes' : 'meses'} gratis.`,
      subscription: {
        endDate: subscription.endDate,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus
      }
    });
  } catch (error) {
    logger.error('Error redeeming coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al canjear cupón', 500));
  }
});

// GET /api/coupons/validate/:code - Validar cupón de suscripción (sin autenticación para compartir)
router.get('/validate/:code', couponValidateLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res.json({
        valid: false,
        reason: 'Cupón no encontrado'
      });
    }
    
    const now = new Date();
    let validation = { valid: true };
    
    if (!coupon.isActive) {
      validation = { valid: false, reason: 'Cupón inactivo' };
    } else if (coupon.expiresAt && coupon.expiresAt < now) {
      validation = { valid: false, reason: 'Cupón expirado' };
    } else if (coupon.maxUses !== null && coupon.usedBy.length >= coupon.maxUses) {
      validation = { valid: false, reason: 'Cupón alcanzó el límite de usos' };
    }
    
    res.json({
      valid: validation.valid,
      reason: validation.reason || null,
      coupon: validation.valid ? {
        code: coupon.code,
        months: coupon.months,
        description: coupon.description,
        usedCount: coupon.usedBy.length,
        maxUses: coupon.maxUses
      } : null
    });
  } catch (error) {
    logger.error('Error validating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al validar cupón', 500));
  }
});


// ============================================================================
// CUPONES DE DESCUENTO PARA NEGOCIOS (Business Coupons)
// ============================================================================
const BusinessCoupon = require('../Models/BusinessCoupon');
const Order = require('../Models/Order');

// GET /api/coupons - Listar cupones de un negocio (Admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      businessId,
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      discountType = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    // Build filter
    const filter = { businessId };

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { code: regex },
        { name: regex },
        { description: regex },
      ];
    }

    const now = new Date();
    if (status === 'active') {
      filter.isActive = true;
      filter.validUntil = { $gte: now };
      filter.validFrom = { $lte: now };
    } else if (status === 'inactive') {
      filter.isActive = false;
    } else if (status === 'expired') {
      filter.validUntil = { $lt: now };
    }

    if (discountType !== 'all') {
      filter.discountType = discountType;
    }

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [coupons, total] = await Promise.all([
      BusinessCoupon.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      BusinessCoupon.countDocuments(filter),
    ]);

    // Stats for this business
    const allCoupons = await BusinessCoupon.find({ businessId }).lean();
    const stats = {
      totalCoupons: allCoupons.length,
      activeCoupons: allCoupons.filter(c =>
        c.isActive && new Date(c.validFrom) <= now && new Date(c.validUntil) >= now
      ).length,
      totalUsage: allCoupons.reduce((sum, c) => sum + (c.usageCount || 0), 0),
      totalDiscountGiven: allCoupons.reduce((sum, c) => sum + (c.totalDiscountGiven || 0), 0),
    };

    res.json({
      coupons: coupons.map(c => ({
        ...c,
        _id: c._id,
        id: c._id,
      })),
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching business coupons', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener cupones', 500));
  }
});

// POST /api/coupons - Crear cupón de descuento (Admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      businessId,
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      usageLimit,
      usageLimitPerCustomer,
      validFrom,
      validUntil,
      applicableOrderTypes,
      isActive,
    } = req.body;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }
    if (!code || !name) {
      return res.status(400).json(formatHttpError(req, 'Código y nombre son requeridos', 400));
    }
    if (!discountType || !['percentage', 'fixed', 'free_delivery'].includes(discountType)) {
      return res.status(400).json(formatHttpError(req, 'Tipo de descuento inválido', 400));
    }
    if (discountType !== 'free_delivery' && (!discountValue || discountValue <= 0)) {
      return res.status(400).json(formatHttpError(req, 'Valor de descuento debe ser mayor a 0', 400));
    }
    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json(formatHttpError(req, 'El porcentaje no puede ser mayor a 100', 400));
    }

    const currentCount = await BusinessCoupon.countDocuments({
      businessId,
      isActive: true
    });
    const limitStatus = await getPlanLimitStatus({
      businessId,
      resourceKey: 'coupons',
      currentCount
    });

    if (limitStatus.limitReached) {
      return res.status(403).json(
        formatHttpError(req, limitStatus.message, 403, {
          code: 'PLAN_LIMIT_REACHED',
          resource: 'coupons',
          plan: limitStatus.commercialPlan,
          limit: limitStatus.limitValue,
          current: currentCount
        })
      );
    }

    // Verificar código duplicado dentro del negocio
    const existing = await BusinessCoupon.findOne({
      businessId,
      code: code.toUpperCase().trim(),
    });
    if (existing) {
      return res.status(400).json(formatHttpError(req, 'Ya existe un cupón con este código en tu negocio', 400));
    }

    const coupon = new BusinessCoupon({
      businessId,
      code: code.toUpperCase().trim(),
      name: name.trim(),
      description: (description || '').trim(),
      discountType,
      discountValue: discountType === 'free_delivery' ? 0 : parseFloat(discountValue),
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      minimumOrderAmount: minimumOrderAmount ? parseFloat(minimumOrderAmount) : 0,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      usageLimitPerCustomer: usageLimitPerCustomer ? parseInt(usageLimitPerCustomer) : 1,
      validFrom: new Date(validFrom || Date.now()),
      validUntil: new Date(validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      applicableOrderTypes: applicableOrderTypes || ['inSite', 'takeaway', 'delivery'],
      isActive: isActive !== undefined ? isActive : true,
    });

    await coupon.save();

    logger.info('Business coupon created', {
      couponId: coupon._id,
      businessId,
      code: coupon.code,
      discountType,
    }, req);

    res.status(201).json({
      success: true,
      coupon,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json(formatHttpError(req, 'Ya existe un cupón con este código', 400));
    }
    logger.error('Error creating business coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear cupón', 500));
  }
});

// POST /api/coupons/generate-code - Generar código único (Admin)
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    const { businessId, length = 8 } = req.body;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    const code = await BusinessCoupon.generateCode(businessId, parseInt(length));

    res.json({ code });
  } catch (error) {
    logger.error('Error generating coupon code', error, req);
    res.status(500).json(formatHttpError(req, 'Error al generar código', 500));
  }
});

// POST /api/coupons/validate - Validar cupón para un pedido (público / cliente)
router.post('/validate', couponValidateLimiter, async (req, res) => {
  try {
    const { businessId, code, orderData, customerId } = req.body;

    if (!businessId || !code) {
      return res.status(400).json({
        valid: false,
        message: 'businessId y código son requeridos',
      });
    }

    // Resolver businessId: puede venir como ObjectId o como slug
    let resolvedBusinessId = businessId;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(businessId);

    if (isObjectId) {
      // Si es un ObjectId, buscar el slug en BusinessConfig
      const config = await BusinessConfig.findById(businessId).select('slug').lean();
      if (config?.slug) {
        resolvedBusinessId = config.slug;
      }
    }

    // Intentar buscar con el ID resuelto, y si falla, con el original
    let coupon = await BusinessCoupon.findOne({
      businessId: resolvedBusinessId,
      code: code.toUpperCase().trim(),
    });

    // Fallback: si no se encontró y resolvedBusinessId !== businessId, intentar con el original
    if (!coupon && resolvedBusinessId !== businessId) {
      coupon = await BusinessCoupon.findOne({
        businessId,
        code: code.toUpperCase().trim(),
      });
    }

    if (!coupon) {
      return res.json({
        valid: false,
        message: 'Cupón no encontrado',
      });
    }

    // Validar si puede usarse para este pedido
    const validation = coupon.validateForOrder(orderData || {}, customerId);
    if (!validation.valid) {
      return res.json({
        valid: false,
        message: validation.message,
      });
    }

    // Calcular descuento
    const orderTotal = orderData?.totalAmount || orderData?.subtotal || 0;
    const discountAmount = coupon.calculateDiscount(orderTotal);
    const finalAmount = Math.max(0, orderTotal - discountAmount);

    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description,
        freeDelivery: coupon.discountType === 'free_delivery',
      },
      discountAmount,
      finalAmount,
      message: coupon.discountType === 'free_delivery'
        ? '¡Envío gratis aplicado!'
        : `Descuento de $${discountAmount.toLocaleString('es-CO')} aplicado`,
    });
  } catch (error) {
    logger.error('Error validating business coupon', error, req);
    res.status(500).json({
      valid: false,
      message: 'Error al validar cupón',
    });
  }
});

// PUT /api/coupons/:id - Actualizar cupón de descuento (Admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      businessId,
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      usageLimit,
      usageLimitPerCustomer,
      validFrom,
      validUntil,
      applicableOrderTypes,
      isActive,
    } = req.body;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    const coupon = await BusinessCoupon.findOne({ _id: id, businessId });
    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    // Si cambian el código, verificar que no esté duplicado
    if (code && code.toUpperCase().trim() !== coupon.code) {
      const existing = await BusinessCoupon.findOne({
        businessId,
        code: code.toUpperCase().trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json(formatHttpError(req, 'Ya existe otro cupón con ese código', 400));
      }
      coupon.code = code.toUpperCase().trim();
    }

    if (name !== undefined) coupon.name = name.trim();
    if (description !== undefined) coupon.description = (description || '').trim();
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = parseFloat(discountValue);
    if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;
    if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = minimumOrderAmount ? parseFloat(minimumOrderAmount) : 0;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (usageLimitPerCustomer !== undefined) coupon.usageLimitPerCustomer = usageLimitPerCustomer ? parseInt(usageLimitPerCustomer) : 1;
    if (validFrom !== undefined) coupon.validFrom = new Date(validFrom);
    if (validUntil !== undefined) coupon.validUntil = new Date(validUntil);
    if (applicableOrderTypes !== undefined) coupon.applicableOrderTypes = applicableOrderTypes;
    if (isActive !== undefined) coupon.isActive = isActive;

    await coupon.save();

    logger.info('Business coupon updated', { couponId: id, businessId }, req);

    res.json({
      success: true,
      coupon,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json(formatHttpError(req, 'Ya existe un cupón con este código', 400));
    }
    logger.error('Error updating business coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar cupón', 500));
  }
});

// DELETE /api/coupons/:id - Eliminar cupón de descuento (Admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    const coupon = await BusinessCoupon.findOneAndDelete({ _id: id, businessId });
    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    logger.info('Business coupon deleted', { couponId: id, businessId, code: coupon.code }, req);

    res.json({
      success: true,
      message: 'Cupón eliminado exitosamente',
    });
  } catch (error) {
    logger.error('Error deleting business coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar cupón', 500));
  }
});

module.exports = router;
