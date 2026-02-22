const express = require('express');
const router = express.Router();
const Review = require('../Models/Review');
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const { isValidObjectId } = require('../utils/validators');
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
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), isVisible: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
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
    }
  };

  await BusinessConfig.findByIdAndUpdate(businessId, { reviewStats });
  return reviewStats;
}

/**
 * POST /api/reviews
 * Create a new review
 * Body: { phone, businessId, orderId, customerName, rating, comment, orderType, orderTotal }
 */
router.post('/', async (req, res) => {
  try {
    const { phone, businessId, orderId, customerName, rating, comment, orderType, orderTotal } = req.body;

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

    // Create the review
    const review = await Review.create({
      businessId,
      orderId,
      customerId: customer._id,
      phone,
      customerName: customerName.trim(),
      rating,
      comment: comment ? comment.trim() : '',
      orderType: orderType || orderDoc.orderType,
      orderTotal: orderTotal || orderDoc.total
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

    const filter = { businessId, isVisible: true };
    if (rating) {
      filter.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('customerName rating comment reply repliedAt orderType createdAt'),
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

    const reviews = await Review.find({ phone, businessId })
      .sort({ createdAt: -1 })
      .select('orderId rating comment reply repliedAt createdAt');

    res.json({ success: true, reviews });
  } catch (error) {
    logger.error('Error fetching customer reviews', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener tus reseñas', 500));
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

    const review = await Review.findByIdAndUpdate(
      id,
      { reply: reply.trim(), repliedAt: new Date() },
      { new: true }
    );

    if (!review) {
      return res.status(404).json(formatHttpError(req, 'Reseña no encontrada', 404));
    }

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

    const review = await Review.findByIdAndUpdate(
      id,
      { isVisible: Boolean(isVisible) },
      { new: true }
    );

    if (!review) {
      return res.status(404).json(formatHttpError(req, 'Reseña no encontrada', 404));
    }

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
    const { businessId, page = 1, limit = 15, rating, search } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    const filter = { businessId };
    if (rating) {
      filter.rating = parseInt(rating);
    }
    if (search && search.trim()) {
      filter.$or = [
        { customerName: { $regex: search.trim(), $options: 'i' } },
        { comment: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('customerName phone rating comment reply repliedAt orderType orderTotal isVisible createdAt'),
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
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json(formatHttpError(req, 'businessId es requerido', 400));
    }

    const config = await BusinessConfig.findById(businessId).select('reviewStats');
    const recentReviews = await Review.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('customerName rating comment reply repliedAt createdAt isVisible');

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

module.exports = router;
