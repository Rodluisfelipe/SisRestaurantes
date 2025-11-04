const express = require('express');
const router = express.Router();
const Coupon = require('../Models/Coupon');
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const authMiddleware = require('../middleware/authMiddleware');
const { resolveBusinessId } = require('../utils/businessResolver');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

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
    res.status(500).json(formatHttpError(req, 'Error al crear cupón: ' + error.message, 500));
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
    res.status(500).json(formatHttpError(req, 'Error al canjear cupón: ' + error.message, 500));
  }
});

// GET /api/coupons/validate/:code - Validar cupón (sin autenticación para compartir)
router.get('/validate/:code', async (req, res) => {
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

module.exports = router;
