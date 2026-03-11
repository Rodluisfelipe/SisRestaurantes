const express = require('express');
const router = express.Router();
const Review = require('../Models/Review');
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const { isValidObjectId } = require('../utils/validators');
const { validateAndResolveBusinessId } = require('../utils/businessValidator');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const authMiddleware = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');

/**
 * Recalculate review stats for a business and update BusinessConfig
 */
async function recalculateReviewStats(businessId) {
  const mongoose = require('mongoose');
  const stats = await Review.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), isVisible: { $ne: false } } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        thumbsUpCount: { $sum: { $cond: [{ $eq: ['$thumbsUp', true] }, 1, 0] } },
        thumbsDownCount: { $sum: { $cond: [{ $eq: ['$thumbsUp', false] }, 1, 0] } },
        thumbsTotalCount: { $sum: { $cond: [{ $ne: ['$thumbsUp', null] }, 1, 0] } }
      }
    }
  ]);

  const data = stats[0] || { averageRating: 0, totalReviews: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };

  const reviewStats = {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalReviews: data.totalReviews,
    ratingBreakdown: {
      1: data.r1,
      2: data.r2,
      3: data.r3,
      4: data.r4,
      5: data.r5
    },
    thumbsFeedback: {
      thumbsUp: data.thumbsUpCount || 0,
      thumbsDown: data.thumbsDownCount || 0,
      total: data.thumbsTotalCount || 0
    }
  };

  await BusinessConfig.findByIdAndUpdate(businessId, { reviewStats });

  // Compute favorite product IDs (products in positive reviews: rating >= 4 OR thumbsUp)
  // A product needs at least 2 positive mentions to become "Favorito"
  try {
    const favAgg = await Review.aggregate([
      { $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        isVisible: { $ne: false },
        $or: [{ rating: { $gte: 4 } }, { thumbsUp: true }]
      }},
      { $unwind: '$productIds' },
      { $group: { _id: '$productIds', count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const favoriteProductIds = favAgg.map(f => f._id);
    await BusinessConfig.findByIdAndUpdate(businessId, { 'reviewStats.favoriteProductIds': favoriteProductIds });
    reviewStats.favoriteProductIds = favoriteProductIds;
  } catch (favErr) {
    logger.error('Error computing favorite products', favErr);
  }

  return reviewStats;
}

/**
 * POST /api/reviews
 * Create a new review
 * Body: { phone, businessId, orderId, customerName, rating, comment, orderType, orderTotal }
 */
router.post('/', async (req, res) => {
  try {
    const { phone, businessId, orderId, customerName, rating, comment, orderType, orderTotal, thumbsUp } = req.body;

    // Validate required fields
    if (!phone || !businessId || !orderId || !customerName || !rating) {
      return res.status(400).json(formatHttpError(req, 'phone, businessId, orderId, customerName y rating son requeridos', 400));
    }

    if (!isValidObjectId(businessId) || !isValidObjectId(orderId)) {
      return res.status(400).json(formatHttpError(req, 'businessId u orderId inválido', 400));
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json(formatHttpError(req, 'Rating debe ser un entero entre 1 y 5', 400));
    }

    // Check if review already exists for this order
    const existingReview = await Review.findOne({ orderId });
    if (existingReview) {
      return res.status(409).json(formatHttpError(req, 'Ya existe una reseña para este pedido', 409));
    }

    // Verify the order exists (in completed OR active orders) and belongs to the phone
    let orderDoc = await CompletedOrder.findOne({ _id: orderId, businessId });
    if (!orderDoc) {
      // Order might not have moved to CompletedOrder yet (race condition on completion)
      orderDoc = await Order.findOne({ _id: orderId, businessId });
    }
    if (!orderDoc) {
      return res.status(404).json(formatHttpError(req, 'Pedido no encontrado', 404));
    }
    if (orderDoc.phone !== phone && orderDoc.customerPhone !== phone) {
      logger.warn('Review phone mismatch', { 
        reqPhone: phone, 
        orderPhone: orderDoc.phone, 
        orderCustomerPhone: orderDoc.customerPhone,
        orderId,
        orderFields: Object.keys(orderDoc.toObject ? orderDoc.toObject() : orderDoc)
      });
      return res.status(403).json(formatHttpError(req, 'No tienes permiso para reseñar este pedido', 403));
    }

    // Find or create customer
    let customer = await Customer.findOne({ phone, businessId });
    if (!customer) {
      customer = await Customer.create({ businessId, phone, name: customerName });
    }

    // Extract productIds from order items for favorites analytics
    const productIds = [];
    if (orderDoc.items && Array.isArray(orderDoc.items)) {
      for (const item of orderDoc.items) {
        const pid = item.productId || item._id;
        if (pid && isValidObjectId(pid.toString())) {
          productIds.push(pid);
        }
      }
    }

    // Create the review
    const review = await Review.create({
      businessId,
      orderId,
      customerId: customer._id,
      phone,
      customerName: customerName.trim(),
      rating,
      thumbsUp: typeof thumbsUp === 'boolean' ? thumbsUp : null,
      comment: comment ? comment.trim() : '',
      orderType: orderType || orderDoc.orderType,
      orderTotal: orderTotal || orderDoc.total,
      productIds
    });

    // Recalculate stats
    const reviewStats = await recalculateReviewStats(businessId);

    // Emit socket event to admin dashboard
    socketService.emitToBusiness(businessId.toString(), 'new_review', {
      review,
      reviewStats
    });

    logger.info('Review created', { reviewId: review._id, businessId, rating }, req);

    res.status(201).json({
      success: true,
      message: '¡Gracias por tu reseña!',
      review,
      reviewStats
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json(formatHttpError(req, 'Ya existe una reseña para este pedido', 409));
    }
    logger.error('Error creating review', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear reseña', 500));
  }
});

/**
 * GET /api/reviews
 * List reviews for a business (public)
 * Query: businessId, page, limit, rating (optional filter)
 */
router.get('/', async (req, res) => {
  try {
    const { businessId, page = 1, limit = 10, rating } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    // Resolve slug to ObjectId
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json(formatHttpError(req, businessResult.error, 404));
    }
    const businessObjectId = businessResult.businessId;

    const filter = { businessId: businessObjectId, isVisible: { $ne: false } };
    if (rating) {
      filter.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('customerName rating comment reply repliedAt orderType thumbsUp createdAt')
        .lean(),
      Review.countDocuments(filter)
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching reviews', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener reseñas', 500));
  }
});

/**
 * GET /api/reviews/my
 * Get reviews by a specific customer (public)
 * Query: phone, businessId
 */
router.get('/my', async (req, res) => {
  try {
    const { phone, businessId } = req.query;

    if (!phone || !businessId) {
      return res.status(400).json(formatHttpError(req, 'phone y businessId son requeridos', 400));
    }

    // Resolve slug to ObjectId
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json(formatHttpError(req, businessResult.error, 404));
    }
    const businessObjectId = businessResult.businessId;

    const reviews = await Review.find({ phone, businessId: businessObjectId })
      .sort({ createdAt: -1 })
      .select('orderId rating comment reply repliedAt createdAt thumbsUp');

    res.json({ success: true, reviews });
  } catch (error) {
    logger.error('Error fetching customer reviews', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener tus reseñas', 500));
  }
});

/**
 * GET /api/reviews/pending
 * Check if a customer has completed orders without reviews
 * Returns the most recent un-reviewed completed order
 * Query: phone, businessId
 */
router.get('/pending', async (req, res) => {
  try {
    const { phone, businessId } = req.query;

    if (!phone || !businessId) {
      return res.status(400).json(formatHttpError(req, 'phone y businessId son requeridos', 400));
    }

    // Resolve businessId (could be slug or ObjectId)
    let businessObjectId = businessId;
    if (!isValidObjectId(businessId)) {
      const business = await BusinessConfig.findOne({ slug: businessId });
      if (!business) return res.json({ success: true, pendingOrder: null });
      businessObjectId = business._id;
    }

    // Only check the SINGLE most recent completed order (last 30 days)
    // Do NOT loop through older orders to avoid an infinite reminder cycle
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const lastOrder = await CompletedOrder.findOne({
      businessId: businessObjectId,
      phone,
      completedAt: { $gte: thirtyDaysAgo }
    }).sort({ completedAt: -1 }).lean();

    if (!lastOrder) {
      return res.json({ success: true, pendingOrder: null });
    }

    // Check if that specific order already has a review
    const alreadyReviewed = await Review.exists({ orderId: lastOrder._id });
    if (alreadyReviewed) {
      return res.json({ success: true, pendingOrder: null });
    }

    // Find the most expensive item to feature in the review card
    let topProduct = null;
    if (lastOrder.items && lastOrder.items.length > 0) {
      const sorted = [...lastOrder.items].sort((a, b) => (b.price || 0) - (a.price || 0));
      const top = sorted[0];
      topProduct = {
        name: top.name || top.productName || '',
        image: top.image || top.productImage || null,
        price: top.price || 0
      };
    }

    res.json({
      success: true,
      pendingOrder: {
        _id: lastOrder._id,
        orderNumber: lastOrder.orderNumber,
        customerName: lastOrder.customerName,
        totalAmount: lastOrder.totalAmount,
        orderType: lastOrder.orderType,
        completedAt: lastOrder.completedAt,
        itemCount: lastOrder.items ? lastOrder.items.length : 0,
        topProduct
      }
    });
  } catch (error) {
    logger.error('Error checking pending review', error, req);
    res.status(500).json(formatHttpError(req, 'Error al verificar reseñas pendientes', 500));
  }
});

/**
 * GET /api/reviews/check/:orderId
 * Check if a review exists for a specific order (public)
 */
router.get('/check/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!isValidObjectId(orderId)) {
      return res.status(400).json(formatHttpError(req, 'orderId inválido', 400));
    }

    const review = await Review.findOne({ orderId }).select('rating comment createdAt');
    res.json({
      success: true,
      hasReview: !!review,
      review: review || null
    });
  } catch (error) {
    logger.error('Error checking review', error, req);
    res.status(500).json(formatHttpError(req, 'Error al verificar reseña', 500));
  }
});

/**
 * PUT /api/reviews/:id/reply
 * Admin reply to a review (admin only)
 * Body: { reply }
 */
router.put('/:id/reply', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'ID de reseña inválido', 400));
    }

    if (!reply || reply.trim().length === 0) {
      return res.status(400).json(formatHttpError(req, 'La respuesta es requerida', 400));
    }

    if (reply.trim().length > 300) {
      return res.status(400).json(formatHttpError(req, 'La respuesta no puede exceder 300 caracteres', 400));
    }

    // Fetch first, then check tenant, then update (prevents TOCTOU)
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json(formatHttpError(req, 'Reseña no encontrada', 404));
    }

    // Tenant isolation: verify admin owns this review's business BEFORE writing
    if (req.user.businessId && review.businessId && review.businessId.toString() !== req.user.businessId.toString() && !req.user.isSuperAdmin) {
      return res.status(403).json(formatHttpError(req, 'No tienes acceso a esta reseña', 403));
    }

    review.reply = reply.trim();
    review.repliedAt = new Date();
    await review.save();

    logger.info('Admin replied to review', { reviewId: id }, req);

    res.json({
      success: true,
      message: 'Respuesta enviada',
      review
    });
  } catch (error) {
    logger.error('Error replying to review', error, req);
    res.status(500).json(formatHttpError(req, 'Error al responder reseña', 500));
  }
});

/**
 * PUT /api/reviews/:id/visibility
 * Toggle review visibility (admin only)
 * Body: { isVisible }
 */
router.put('/:id/visibility', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'ID de reseña inválido', 400));
    }

    // Fetch first, then check tenant, then update (prevents TOCTOU)
    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json(formatHttpError(req, 'Reseña no encontrada', 404));
    }

    // Tenant isolation: verify admin owns this review's business BEFORE writing
    if (req.user.businessId && review.businessId && review.businessId.toString() !== req.user.businessId.toString() && !req.user.isSuperAdmin) {
      return res.status(403).json(formatHttpError(req, 'No tienes acceso a esta reseña', 403));
    }

    review.isVisible = Boolean(isVisible);
    await review.save();

    // Recalculate stats since visibility changed
    await recalculateReviewStats(review.businessId);

    logger.info('Review visibility toggled', { reviewId: id, isVisible }, req);

    res.json({
      success: true,
      message: isVisible ? 'Reseña visible' : 'Reseña oculta',
      review
    });
  } catch (error) {
    logger.error('Error toggling review visibility', error, req);
    res.status(500).json(formatHttpError(req, 'Error al cambiar visibilidad', 500));
  }
});

/**
 * GET /api/reviews/admin
 * List ALL reviews for a business (admin only — includes hidden)
 * Query: businessId, page, limit, rating (optional), search (optional)
 */
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 15, rating, search } = req.query;

    // Use businessId from JWT token; for superadmins fall back to query param
    let businessId = req.user.businessId;
    if (!businessId && req.query.businessId) {
      const bResult = await validateAndResolveBusinessId(req.query.businessId);
      if (bResult.success) businessId = bResult.businessId;
    }
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId no disponible', 400));
    }

    const filter = { businessId };
    if (rating) {
      filter.rating = parseInt(rating);
    }
    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { customerName: { $regex: escapedSearch, $options: 'i' } },
        { comment: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('customerName rating comment reply repliedAt orderType thumbsUp createdAt')
        .lean(),
      Review.countDocuments(filter)
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching admin reviews', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener reseñas', 500));
  }
});

/**
 * GET /api/reviews/stats
 * Get review stats for admin dashboard (admin only)
 * Query: businessId
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Use businessId from JWT token; for superadmins fall back to query param
    let businessId = req.user.businessId;
    if (!businessId && req.query.businessId) {
      const bResult = await validateAndResolveBusinessId(req.query.businessId);
      if (bResult.success) businessId = bResult.businessId;
    }
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId no disponible', 400));
    }

    const config = await BusinessConfig.findById(businessId).select('reviewStats').lean();
    const recentReviews = await Review.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('customerName rating comment reply repliedAt createdAt isVisible')
      .lean();

    res.json({
      success: true,
      stats: config?.reviewStats || { averageRating: 0, totalReviews: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      recentReviews
    });
  } catch (error) {
    logger.error('Error fetching review stats', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener estadísticas', 500));
  }
});

/**
 * POST /api/reviews/recalculate
 * Force recalculate review stats for a business (admin only)
 */
router.post('/recalculate', authMiddleware, async (req, res) => {
  try {
    let businessId = req.user.businessId;
    if (!businessId && req.query.businessId) {
      const bResult = await validateAndResolveBusinessId(req.query.businessId);
      if (bResult.success) businessId = bResult.businessId;
    }
    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId no disponible', 400));
    }
    const reviewStats = await recalculateReviewStats(businessId);
    logger.info('Review stats recalculated manually', { businessId }, req);
    res.json({ success: true, reviewStats });
  } catch (error) {
    logger.error('Error recalculating review stats', error, req);
    res.status(500).json(formatHttpError(req, 'Error al recalcular estadísticas', 500));
  }
});

module.exports = router;
