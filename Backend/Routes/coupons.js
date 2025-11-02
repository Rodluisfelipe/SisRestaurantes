const express = require('express');
const router = express.Router();
const Coupon = require('../Models/Coupon');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

// Middleware to validate and resolve business ID
const validateBusinessId = async (req, res, next) => {
  try {
    let businessId = req.query.businessId;
    if (!businessId) {
      businessId = req.body?.businessId;
      if (!businessId) {
        return res.status(400).json({ message: 'Business ID is required' });
      }
    }
    
    const result = await validateAndResolveBusinessId(businessId);
    
    if (!result.success) {
      return res.status(404).json({ message: result.error });
    }
    
    req.businessId = result.businessId;
    req.business = result.business;
    next();
  } catch (error) {
    logger.error('validateBusinessId error', error, req);
    res.status(500).json(formatHttpError(req, 'Error validating business ID', 500));
  }
};

// Get all coupons for a business
router.get('/', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search = '',
      status = 'all',
      discountType = 'all'
    } = req.query;

    // Build query
    const query = { businessId };
    
    // Add search filter
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add status filter
    if (status === 'active') {
      query.isActive = true;
      query.validFrom = { $lte: new Date() };
      query.validUntil = { $gte: new Date() };
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    }
    
    // Add discount type filter
    if (discountType !== 'all') {
      query.discountType = discountType;
    }

    // Build sort object
    const sortObj = {};
    if (sortBy === 'createdAt') {
      sortObj.createdAt = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'usageCount') {
      sortObj.usageCount = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'validUntil') {
      sortObj.validUntil = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Execute query with pagination
    const coupons = await Coupon.find(query)
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('applicableProducts', 'name')
      .populate('applicableCategories', 'name')
      .populate('excludedProducts', 'name')
      .populate('excludedCategories', 'name')
      .lean();

    // Get total count for pagination
    const total = await Coupon.countDocuments(query);

    // Calculate statistics
    const stats = await Coupon.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          activeCoupons: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $lte: ['$validFrom', new Date()] },
                    { $gte: ['$validUntil', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalUsage: { $sum: '$usageCount' },
          totalDiscountGiven: { $sum: '$totalDiscountGiven' },
          expiredCoupons: {
            $sum: {
              $cond: [{ $lt: ['$validUntil', new Date()] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      coupons,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      },
      stats: stats[0] || {
        totalCoupons: 0,
        activeCoupons: 0,
        totalUsage: 0,
        totalDiscountGiven: 0,
        expiredCoupons: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching coupons', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener los cupones', 500));
  }
});

// Get coupon by ID
router.get('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const coupon = await Coupon.findOne({ 
      _id: req.params.id, 
      businessId 
    })
    .populate('applicableProducts', 'name price')
    .populate('applicableCategories', 'name')
    .populate('excludedProducts', 'name')
    .populate('excludedCategories', 'name')
    .populate('applicableCustomers', 'name phone')
    .populate('customerUsage.customerId', 'name phone');

    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    res.json(coupon);
  } catch (error) {
    logger.error('Error fetching coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener el cupón', 500));
  }
});

// Create new coupon
router.post('/', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      usageLimit,
      usageLimitPerCustomer,
      applicableCustomers,
      validFrom,
      validUntil,
      applicableOrderTypes,
      isActive
    } = req.body;

    // Generate code if not provided
    let couponCode = code;
    if (!couponCode) {
      couponCode = await Coupon.generateUniqueCode(businessId);
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ 
      businessId, 
      code: couponCode.toUpperCase() 
    });
    
    if (existingCoupon) {
      return res.status(400).json({ message: 'El código del cupón ya existe' });
    }

    const coupon = new Coupon({
      businessId,
      code: couponCode.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount: minimumOrderAmount || 0,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      excludedProducts: excludedProducts || [],
      excludedCategories: excludedCategories || [],
      usageLimit,
      usageLimitPerCustomer: usageLimitPerCustomer || 1,
      applicableCustomers: applicableCustomers || [],
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: new Date(validUntil),
      applicableOrderTypes: applicableOrderTypes || ['inSite', 'takeaway', 'delivery'],
      isActive: isActive !== undefined ? isActive : true
    });

    await coupon.save();
    
    // Populate the response
    await coupon.populate([
      { path: 'applicableProducts', select: 'name' },
      { path: 'applicableCategories', select: 'name' },
      { path: 'excludedProducts', select: 'name' },
      { path: 'excludedCategories', select: 'name' }
    ]);

    logger.info('Coupon created', { id: coupon._id, code: coupon.code }, req);
    res.status(201).json(coupon);
  } catch (error) {
    logger.error('Error creating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear el cupón', 500));
  }
});

// Update coupon
router.put('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const updateData = { ...req.body };
    
    // Remove businessId from updateData to avoid conflicts
    delete updateData.businessId;
    
    // Convert dates
    if (updateData.validFrom) {
      updateData.validFrom = new Date(updateData.validFrom);
    }
    if (updateData.validUntil) {
      updateData.validUntil = new Date(updateData.validUntil);
    }
    
    // Convert code to uppercase
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    const coupon = await Coupon.findOneAndUpdate(
      { _id: req.params.id, businessId },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('applicableProducts', 'name')
    .populate('applicableCategories', 'name')
    .populate('excludedProducts', 'name')
    .populate('excludedCategories', 'name');

    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    logger.info('Coupon updated', { id: coupon._id }, req);
    res.json(coupon);
  } catch (error) {
    logger.error('Error updating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar el cupón', 500));
  }
});

// Delete coupon
router.delete('/:id', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const coupon = await Coupon.findOneAndDelete({ 
      _id: req.params.id, 
      businessId 
    });

    if (!coupon) {
      return res.status(404).json({ message: 'Cupón no encontrado' });
    }

    logger.info('Coupon deleted', { id: req.params.id }, req);
    res.json({ message: 'Cupón eliminado exitosamente' });
  } catch (error) {
    logger.error('Error deleting coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar el cupón', 500));
  }
});

// Validate coupon for order
router.post('/validate', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { code, orderData, customerId } = req.body;

    if (!code || !orderData) {
      return res.status(400).json(formatHttpError(req, 'Código y datos del pedido son requeridos', 400));
    }

    const coupon = await Coupon.findOne({ 
      businessId, 
      code: code.toUpperCase() 
    });

    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    // Validate coupon
    const validation = coupon.validateForOrder(orderData, customerId);
    
    if (!validation.valid) {
      return res.status(400).json(formatHttpError(req, validation.error, 400, { valid: false }));
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderData.totalAmount);
    
    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount
      },
      discountAmount,
      finalAmount: orderData.totalAmount - discountAmount
    });
  } catch (error) {
    logger.error('Error validating coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al validar el cupón', 500));
  }
});

// Apply coupon to order
router.post('/apply', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { code, orderData, customerId } = req.body;

    if (!code || !orderData) {
      return res.status(400).json(formatHttpError(req, 'Código y datos del pedido son requeridos', 400));
    }

    const coupon = await Coupon.findOne({ 
      businessId, 
      code: code.toUpperCase() 
    });

    if (!coupon) {
      return res.status(404).json(formatHttpError(req, 'Cupón no encontrado', 404));
    }

    // Validate coupon
    const validation = coupon.validateForOrder(orderData, customerId);
    
    if (!validation.valid) {
      return res.status(400).json(formatHttpError(req, validation.error, 400, { valid: false }));
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderData.totalAmount);
    
    // Record usage
    await coupon.recordUsage(customerId, discountAmount);
    
    logger.info('Coupon applied', { code: coupon.code, discountAmount }, req);
    res.json({
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discountAmount,
      finalAmount: orderData.totalAmount - discountAmount
    });
  } catch (error) {
    logger.error('Error applying coupon', error, req);
    res.status(500).json(formatHttpError(req, 'Error al aplicar el cupón', 500));
  }
});

// Get coupon statistics
router.get('/stats/overview', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;

    const stats = await Coupon.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          activeCoupons: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$isActive', true] },
                    { $lte: ['$validFrom', new Date()] },
                    { $gte: ['$validUntil', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalUsage: { $sum: '$usageCount' },
          totalDiscountGiven: { $sum: '$totalDiscountGiven' },
          expiredCoupons: {
            $sum: {
              $cond: [{ $lt: ['$validUntil', new Date()] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get most used coupons
    const mostUsedCoupons = await Coupon.find({ businessId })
      .sort({ usageCount: -1 })
      .limit(5)
      .select('code name usageCount totalDiscountGiven')
      .lean();

    // Get recent coupons
    const recentCoupons = await Coupon.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('code name discountType discountValue createdAt')
      .lean();

    res.json({
      ...stats[0],
      mostUsedCoupons,
      recentCoupons
    });
  } catch (error) {
    logger.error('Error fetching coupon stats', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener estadísticas', 500));
  }
});

// Generate unique coupon code
router.post('/generate-code', validateBusinessId, async (req, res) => {
  try {
    const { businessId } = req;
    const { length = 8 } = req.body;
    
    const code = await Coupon.generateUniqueCode(businessId, length);
    
    res.json({ code });
  } catch (error) {
    logger.error('Error generating coupon code', error, req);
    res.status(500).json(formatHttpError(req, 'Error al generar código', 500));
  }
});

module.exports = router;
