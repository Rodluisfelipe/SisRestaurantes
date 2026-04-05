const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../Models/Order");
const CompletedOrder = require("../Models/CompletedOrder");
const Customer = require("../Models/Customer");
const BusinessConfig = require("../Models/BusinessConfig");
const { ObjectId } = require("mongoose").Types;
const socketService = require("../services/socketService");
const { validateAndResolveBusinessId, createBusinessFilter } = require("../utils/businessValidator");
const { isValidObjectId } = require("../utils/validators");
const logger = require("../utils/logger");
const { getSubscriptionForBusiness } = require('../utils/subscriptionHelper');
const LoyaltyProgram = require('../Models/LoyaltyProgram');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const { ORDER_STATUS } = require('../utils/constants');
const authMiddleware = require('../middleware/authMiddleware');
const { tenantAuth } = require('../middleware/tenantAuth');
const { validateCreateOrder } = require('../middleware/validate');
const {
  validateUpdateOrderStatus,
  validateSendToKitchen,
  validateDeleteOrder,
  validateDailyClosing,
  validateCleanupCompleted,
  validatePaymentProof,
  validateConfirmPayment,
  validateRejectPayment,
} = require('../middleware/validators/orderValidators');
const rateLimit = require('express-rate-limit');
const { startOfDayCOL, endOfDayCOL } = require('../utils/timezone');
const { validateOrderPrices } = require('../utils/orderPricing');
const { applyCoupon } = require('../utils/orderCoupon');
const Counter = require('../Models/Counter');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const sanitizeUpload = require('../middleware/sanitizeUpload');
const { stripHtml } = require('../utils/sanitize');

// Multer config for payment proof uploads — scoped by order ID for tenant isolation
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use order ID from URL params to scope uploads
    const orderId = req.params.id || 'unknown';
    const safeId = orderId.replace(/[^a-zA-Z0-9]/g, '');
    const dir = path.join(__dirname, '..', 'uploads', 'order-proofs', safeId);
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'proof-' + uniqueSuffix + ext);
  }
});
const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for mobile photos
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif'                 // iPhone
    ];
    if (allowedMimes.includes(file.mimetype.toLowerCase())) {
      return cb(null, true);
    }
    // Also check extension as fallback (some Android browsers don't set mimetype)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    if (allowedExts.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  }
});

// Rate limiter for public order creation (by IP)
const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 orders per IP per 15 minutes
  message: { message: 'Demasiados pedidos. Intente nuevamente en unos minutos.' }
});

// Rate limiter per phone+businessId — prevents rapid duplicate orders from same customer
const orderPhoneLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 1,
  keyGenerator: (req) => {
    const phone = req.body?.customerPhone || req.body?.phone || 'no-phone';
    const businessId = req.body?.businessId || 'no-biz';
    return `order:${businessId}:${phone}`;
  },
  message: { message: 'Pedido duplicado. Espere unos segundos antes de intentar de nuevo.', code: 'ORDER_RATE_LIMITED' },
  skipFailedRequests: true
});

// Rate limiter for public order tracking/history
const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Demasiadas consultas. Intente nuevamente más tarde.' }
});

// Generate a customer token for order tracking
const generateCustomerToken = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Helper function to get order number (shared with bookings) — ATOMIC
const generateOrderNumber = async (businessId) => {
  try {
    const counterId = `orderNumber:${businessId.toString()}`;
    
    // Check if counter exists; if not, seed it from existing data
    const existing = await Counter.findById(counterId);
    if (!existing) {
      const Booking = require('../Models/Booking');
      const [latestOrder, latestCompleted, latestBooking] = await Promise.all([
        Order.findOne({ businessId }).sort({ orderNumber: -1 }).limit(1).select('orderNumber').lean(),
        CompletedOrder.findOne({ businessId }).sort({ orderNumber: -1 }).limit(1).select('orderNumber').lean(),
        Booking.findOne({ businessId }).sort({ orderNumber: -1 }).limit(1).select('orderNumber').lean()
      ]);
      const activeNum = latestOrder ? parseInt(latestOrder.orderNumber, 10) || 0 : 0;
      const completedNum = latestCompleted ? parseInt(latestCompleted.orderNumber, 10) || 0 : 0;
      const bookingNum = latestBooking ? parseInt(latestBooking.orderNumber, 10) || 0 : 0;
      const highest = Math.max(activeNum, completedNum, bookingNum);
      
      // Seed counter — use $max to avoid overwriting if another request seeded first
      await Counter.findOneAndUpdate(
        { _id: counterId },
        { $max: { seq: highest } },
        { upsert: true }
      );
    }
    
    // Atomic increment — no race conditions possible
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    return counter.seq.toString();
  } catch (error) {
    // Fallback to timestamp-based order number
    logger.error('Error generating atomic order number, using fallback', error);
    return Date.now().toString();
  }
};

// Get all orders for a business (with optional filtering) — ADMIN ONLY
router.get("/", tenantAuth, async (req, res) => {
  try {
    const { businessId, status, orderType } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }
    
    // Use the centralized business validation
    const filter = await createBusinessFilter(businessId);
    
    // Add optional filters
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (orderType) filter.orderType = orderType;
    
    // Get orders sorted by creation date (newest first)
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    
    logger.info(`Retrieved ${orders.length} orders for business ${businessId}`);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Surrogate-Control', 'no-store');
    res.status(200).json(orders);
  } catch (error) {
    logger.error("Error fetching orders", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Create a new order (POS orders skip rate limiter)
router.post("/", (req, res, next) => {
  if (req.body.orderChannel === 'pos') return next();
  return createOrderLimiter(req, res, next);
}, (req, res, next) => {
  if (req.body.orderChannel === 'pos') return next();
  return orderPhoneLimiter(req, res, next);
}, validateCreateOrder, async (req, res) => {
  try {


    
    const { 
      businessId, 
      customerName, 
      orderType, 
      items, 
      totalAmount, 
      tableNumber, 
      phone, 
      address, 
      couponCode,
      // Datos de delivery zone
      deliveryFee,
      deliveryZoneName,
      deliveryZoneId,
      deliveryZoneInfo,
      deliveryCalculated,
      deliveryNeedsConfirmation,
      // In-app ordering fields
      orderChannel,
      paymentMethod,
      customerNotes,
      // POS payment details (for ticket reprinting)
      posPaymentInfo,
      // Customer email
      customerEmail
    } = req.body;
    





    
    // Convertir totalAmount a número si es string
    const numericTotalAmount = typeof totalAmount === 'string' ? parseFloat(totalAmount) : totalAmount;
    
    // Input validation
    if (!businessId || !customerName || !orderType || !items || numericTotalAmount === undefined || numericTotalAmount === null || isNaN(numericTotalAmount)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items must be a non-empty array" });
    }
    if (items.length > 100) {
      return res.status(400).json({ message: "Too many items in order (max 100)" });
    }
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || !item.quantity || item.price == null) {
        return res.status(400).json({ message: "Each item must have name (string), quantity and price" });
      }
    }

    // Validate orderType
    const validOrderTypes = ['inSite', 'takeaway', 'delivery'];
    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({ message: `orderType must be one of: ${validOrderTypes.join(', ')}` });
    }

    // Validate string lengths
    if (customerName.length > 100) {
      return res.status(400).json({ message: "customerName exceeds max length (100)" });
    }
    if (address && address.length > 500) {
      return res.status(400).json({ message: "address exceeds max length (500)" });
    }
    
    // Use centralized business validation
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;

    // === IDEMPOTENCY CHECK (POS offline sync) ===
    // If client sends an offlineId, reject if an order with that offlineId already exists
    if (req.body.offlineId) {
      const existingOffline = await Order.findOne({ 
        businessId: businessObjectId, 
        offlineId: req.body.offlineId 
      }).select('_id orderNumber').lean();
      if (existingOffline) {
        logger.info('Duplicate offline order rejected', { offlineId: req.body.offlineId, existingOrderNumber: existingOffline.orderNumber });
        return res.status(409).json({ 
          message: 'Este pedido ya fue sincronizado',
          code: 'DUPLICATE_OFFLINE_ORDER',
          existingOrderId: existingOffline._id,
          existingOrderNumber: existingOffline.orderNumber
        });
      }
    }

    // === SERVER-SIDE PRICE VALIDATION ===
    try {
      const priceResult = await validateOrderPrices(items, businessObjectId, numericTotalAmount);
      if (!priceResult.valid) {
        return res.status(priceResult.error.status).json({
          message: priceResult.error.message,
          code: priceResult.error.code
        });
      }
    } catch (priceErr) {
      // Non-blocking: if price check fails, log and continue (don't break orders)
      logger.warn('Price validation failed, continuing', { error: priceErr.message });
    }

    // Verificar estado de la suscripción antes de permitir crear órdenes
    const { subscription, status: subscriptionStatus, isSuspended, periodEnd: periodEndDate, graceUntil: graceUntilDate } = await getSubscriptionForBusiness(businessObjectId);
    
    if (subscription) {
      logger.info('Verificación de suscripción al crear orden', {
        businessId: businessObjectId,
        subscriptionId: subscription._id,
        periodEnd: periodEndDate,
        graceUntil: graceUntilDate,
        subscriptionStatus,
        isSuspended
      });
      
      if (isSuspended) {
        logger.warn('Intento de crear orden con suscripción suspendida', { 
          businessId: businessObjectId,
          periodEnd: periodEndDate,
          graceUntil: graceUntilDate
        });
        return res.status(403).json({ 
          message: 'El menú está desactivado. La suscripción ha expirado y el período de gracia ha finalizado. Por favor, contacta al restaurante para renovar la suscripción.',
          code: 'SUBSCRIPTION_SUSPENDED',
          subscriptionStatus: 'suspended'
        });
      }
    }
    
    // Generate order number
    const orderNumber = await generateOrderNumber(businessObjectId);
    
    // Find or create customer
    let customer = null;
    if (phone) {

      
      customer = await Customer.findOne({ phone, businessId: businessObjectId });
      
      if (customer) {

        // Update existing customer stats
        await customer.updateStats(numericTotalAmount);
      } else {

        // Create new customer
        customer = new Customer({
          businessId: businessObjectId,
          phone,
          name: customerName,
          totalOrders: 1,
          totalSpent: numericTotalAmount,
          lastOrderDate: new Date()
        });
        await customer.save();

      }
    }

    // Handle coupon validation and application
    let coupon = null;
    let discountAmount = 0;
    let finalAmount = numericTotalAmount;
    
    if (couponCode) {
      const couponResult = await applyCoupon(couponCode, businessObjectId, numericTotalAmount, orderType, items, customer);
      if (!couponResult.valid) {
        return res.status(couponResult.error.status).json({ message: couponResult.error.message });
      }
      coupon = couponResult.coupon;
      discountAmount = couponResult.discountAmount;
      finalAmount = couponResult.finalAmount;
    }

    // Determine initial status based on ordering channel
    const isInApp = orderChannel === 'inapp';
    const isPOS = orderChannel === 'pos';
    const initialStatus = isPOS ? ORDER_STATUS.CONFIRMED : isInApp ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING;
    const customerToken = isInApp ? generateCustomerToken() : null;

    // Create the order
    const newOrder = new Order({
      businessId: businessObjectId,
      orderNumber,
      customerName: stripHtml(customerName),
      orderType,
      items,
      totalAmount: numericTotalAmount,
      tableNumber: tableNumber || "",
      phone: phone || "",
      customerEmail: customerEmail || "",
      address: stripHtml(address || ""),
      customerId: customer ? customer._id : null,
      couponCode: coupon ? coupon.code : null,
      couponId: coupon ? coupon._id : null,
      discountAmount,
      finalAmount,
      // In-app ordering fields
      orderChannel: orderChannel || 'whatsapp',
      paymentMethod: paymentMethod || null,
      customerToken,
      customerNotes: stripHtml(customerNotes || ''),
      statusHistory: [{ status: initialStatus, timestamp: new Date(), note: 'Pedido creado' }],
      // Datos de zona de entrega
      deliveryFee: deliveryFee || null,
      deliveryZoneName: deliveryZoneName || null,
      deliveryZoneInfo: deliveryZoneInfo || null,
      deliveryCalculated: deliveryCalculated || false,
      deliveryNeedsConfirmation: deliveryNeedsConfirmation || false,
      deliveryZoneId: deliveryZoneId || null,
      // POS: persist payment info for ticket reprinting
      posPaymentInfo: isPOS && posPaymentInfo ? posPaymentInfo : undefined,
      // POS: offline sync idempotency key
      offlineId: req.body.offlineId || null,
      // Map delivery zone details to top-level fields
      deliveryCoordinates: deliveryZoneInfo?.coordinates || { lat: null, lon: null },
      deliveryDistance: deliveryZoneInfo?.distance || 0,
      estimatedDeliveryTime: deliveryZoneInfo?.estimatedTime || { min: 0, max: 0 },
      status: initialStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    logger.debug('Orden creada con datos de delivery', {
      deliveryFee,
      deliveryZoneName,
      deliveryCalculated,
      deliveryNeedsConfirmation
    });
    
    const savedOrder = await newOrder.save();

    // POS: Auto-register sale in open cash register (only for POS orders) — atomic $push
    if (orderChannel === 'pos') {
      try {
        const CashRegister = require('../Models/CashRegister');
        await CashRegister.findOneAndUpdate(
          { businessId: businessObjectId, status: 'open' },
          { $push: { movements: {
            type: 'sale',
            amount: finalAmount,
            paymentMethod: paymentMethod || 'cash',
            orderId: savedOrder._id,
            orderNumber: orderNumber,
            orderChannel: 'pos',
            description: `Venta POS #${orderNumber} - ${customerName}`,
            createdAt: new Date()
          }}}  
        );
      } catch (cashErr) {
        logger.warn('Failed to register sale in cash register', { error: cashErr.message, orderId: savedOrder._id });
      }
    }

    // Record coupon per-customer usage AFTER successful order save (global usage already recorded atomically)
    if (coupon && !coupon.__usageAlreadyRecorded) {
      try {
        await coupon.recordUsage(customer ? customer._id : null, discountAmount);
      } catch (couponErr) {
        logger.warn('Failed to record coupon usage (order was created)', { error: couponErr.message, orderId: savedOrder._id });
      }
    } else if (coupon && customer) {
      // Record per-customer usage only (global count already incremented atomically)
      try {
        const CouponModel = coupon.constructor;
        if (coupon.usageByCustomer) {
          await CouponModel.updateOne(
            { _id: coupon._id },
            { $inc: { [`usageByCustomer.${customer._id}`]: 1 } }
          );
        }
      } catch (couponErr) {
        logger.warn('Failed to record per-customer coupon usage', { error: couponErr.message });
      }
    }

    // NOTE: Loyalty points are awarded only when admin completes the order (PATCH /:id/status → completed)

    // Emit socket event
    socketService.emitToBusiness(businessObjectId.toString(), "order_created", savedOrder);
    
    // Enviar notificación push por nuevo pedido
    const { sendPushToBusinessId } = require('../services/pushService');
    try {
      const payload = {
        title: `🆕 Nuevo Pedido #${orderNumber}`,
        body: `Nuevo pedido de ${customerName} - ${numericTotalAmount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        clickUrl: `/admin/orders/${savedOrder._id}`,
        data: { orderId: savedOrder._id.toString(), orderNumber, status: ORDER_STATUS.PENDING }
      };
      await sendPushToBusinessId(businessObjectId.toString(), payload);
    } catch (pushError) {
      // No fallar la request si el push falla
      logger.warn('Failed to send push notification for new order', { error: pushError.message });
    }
    
    logger.info(`Created new order ${orderNumber} for business ${businessId} (channel: ${orderChannel || 'whatsapp'})`);
    
    // Mark viewer session as converted (fire and forget)
    try {
      const viewerTracker = require('../services/viewerTracker');
      viewerTracker.markConverted(businessObjectId.toString(), phone).catch(() => {});
    } catch (_) {}
    
    res.status(201).json({
      ...savedOrder.toObject(),
      customerToken: customerToken // Include token in response for client tracking
    });
  } catch (error) {
    logger.error("Error creating order", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get all completed orders for a business (historical view) — ADMIN ONLY
// Supports: ?businessId=&page=&limit=&from=&to=&orderType=&orderChannel=&paymentMethod=&search=
router.get("/completed", tenantAuth, async (req, res) => {
  try {
    const { businessId, page, limit: queryLimit, from, to, orderType, orderChannel, paymentMethod, search } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }
    
    // Use centralized business validation
    const businessResult = await validateAndResolveBusinessId(businessId);
    
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    // Build filter
    const filter = { businessId: businessObjectId };

    // Date range filter
    if (from || to) {
      filter.completedAt = {};
      if (from) filter.completedAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.completedAt.$lte = toDate;
      }
    }

    // Optional filters
    const allowedOrderTypes = ['inSite', 'takeaway', 'delivery'];
    if (orderType && allowedOrderTypes.includes(orderType)) {
      filter.orderType = orderType;
    }
    const allowedChannels = ['whatsapp', 'inapp', 'pos'];
    if (orderChannel && allowedChannels.includes(orderChannel)) {
      filter.orderChannel = orderChannel;
    }
    const allowedPayments = ['cash', 'efectivo', 'nequi', 'daviplata', 'transfer', 'transferencia', 'other'];
    if (paymentMethod && allowedPayments.includes(paymentMethod)) {
      filter.paymentMethod = paymentMethod;
    }

    // Text search (customer name or order number)
    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { customerName: { $regex: s, $options: 'i' } },
        { orderNumber: { $regex: s, $options: 'i' } },
      ];
    }

    // Pagination (optional — without params returns all for backward compat)
    const pageNum = parseInt(page) || 0;
    const limitNum = Math.min(parseInt(queryLimit) || 0, 1000);
    
    let query = CompletedOrder.find(filter).populate('deliveryPersonId', 'name').sort({ completedAt: -1 });
    
    if (limitNum > 0) {
      query = query.limit(limitNum).skip(pageNum > 0 ? (pageNum - 1) * limitNum : 0);
    } else {
      query = query.limit(500);
    }
    
    const [completedOrders, total] = await Promise.all([
      query.lean(),
      CompletedOrder.countDocuments(filter),
    ]);
    
    // Always return structured response
    if (limitNum > 0) {
      return res.json({
        orders: completedOrders,
        pagination: {
          current: pageNum || 1,
          total: Math.ceil(total / limitNum),
          limit: limitNum,
          totalOrders: total
        }
      });
    }
    
    logger.info(`Retrieved ${completedOrders.length} completed orders for business ${businessId}`);
    res.json(completedOrders);
  } catch (error) {
    logger.error("Error fetching completed orders", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Track order by ID + customerToken (public endpoint) - MUST be before /:id
router.get('/track/:id', publicOrderLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    // Accept token from header (preferred) or query string (legacy)
    const token = req.headers['x-customer-token'] || req.query.token;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.customerToken !== token) {
      return res.status(403).json({ message: 'Token inválido' });
    }

    // Return safe subset of order data for tracking
    const trackingData = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      orderChannel: order.orderChannel,
      customerName: order.customerName,
      items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      totalAmount: order.totalAmount,
      finalAmount: order.finalAmount,
      discountAmount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      paymentMethod: order.paymentMethod,
      paymentProof: order.paymentProof,
      statusHistory: order.statusHistory,
      messages: order.messages || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    res.json(trackingData);
  } catch (error) {
    logger.error('Error tracking order', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ─── ORDER CHAT MESSAGES ────────────────────────────────────────────────

// Customer sends a message (public, token-based auth)
router.post('/:id/messages/customer', publicOrderLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers['x-customer-token'] || req.body.customerToken;
    const { text } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid order ID' });
    if (!token) return res.status(401).json({ message: 'Token requerido' });
    if (!text || !text.trim() || text.trim().length > 500) return res.status(400).json({ message: 'Mensaje inválido (1-500 caracteres)' });

    const order = await Order.findById(id);
    if (!order || order.customerToken !== token) return res.status(403).json({ message: 'Token inválido' });
    if (['completed', 'delivered', 'cancelled'].includes(order.status)) return res.status(400).json({ message: 'No se pueden enviar mensajes a pedidos finalizados' });

    const message = { sender: 'customer', text: stripHtml(text.trim()), timestamp: new Date() };
    order.messages.push(message);
    order.updatedAt = new Date();
    await order.save();

    const saved = order.messages[order.messages.length - 1];
    socketService.emitToOrder(id, 'order_message', { orderId: id, message: saved });
    socketService.emitToBusiness(order.businessId.toString(), 'order_message', { orderId: id, message: saved });

    res.status(201).json(saved);
  } catch (error) {
    logger.error('Error sending customer message', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Business sends a message (admin auth)
router.post('/:id/messages/business', tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid order ID' });
    if (!text || !text.trim() || text.trim().length > 500) return res.status(400).json({ message: 'Mensaje inválido (1-500 caracteres)' });

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (['completed', 'delivered', 'cancelled'].includes(order.status)) return res.status(400).json({ message: 'No se pueden enviar mensajes a pedidos finalizados' });

    const message = { sender: 'business', text: stripHtml(text.trim()), timestamp: new Date() };
    order.messages.push(message);
    order.updatedAt = new Date();
    await order.save();

    const saved = order.messages[order.messages.length - 1];
    socketService.emitToOrder(id, 'order_message', { orderId: id, message: saved });
    socketService.emitToBusiness(order.businessId.toString(), 'order_message', { orderId: id, message: saved });

    res.status(201).json(saved);
  } catch (error) {
    logger.error('Error sending business message', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get my orders by phone + businessId (public endpoint) - MUST be before /:id
router.get('/my-orders', publicOrderLimiter, async (req, res) => {
  try {
    const { phone, businessId } = req.query;

    if (!phone || !businessId) {
      return res.status(400).json({ message: 'phone y businessId son requeridos' });
    }

    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }

    const businessObjectId = businessResult.businessId;

    // Get active orders (not completed/cancelled)
    const activeOrders = await Order.find({
      businessId: businessObjectId,
      phone: phone,
      status: { $nin: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED] }
    }).sort({ createdAt: -1 }).limit(10).lean();

    // Get recent completed orders
    const completedOrders = await CompletedOrder.find({
      businessId: businessObjectId,
      phone: phone
    }).sort({ completedAt: -1 }).limit(10).lean();

    res.json({
      active: activeOrders,
      completed: completedOrders
    });
  } catch (error) {
    logger.error('Error fetching my orders', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Get order by ID - ADMIN ONLY - MUST BE AFTER specific routes to avoid intercepting them
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    const order = await Order.findById(id).lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Tenant isolation: verify admin owns this order's business
    if (req.user.businessId && order.businessId.toString() !== req.user.businessId.toString() && !req.user.isSuperAdmin) {
      return res.status(403).json({ message: 'No tienes acceso a este pedido' });
    }
    
    res.json(order);
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Update order status (admin only)
router.patch("/:id/status", tenantAuth, validateUpdateOrderStatus, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    if (!status || !["pending", "pending_payment", "payment_uploaded", "payment_confirmed", "inProgress", "completed", "ready", "preparing", "confirmed", "cancelled", "delivered"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Valid state transitions — prevents impossible reversals
    const VALID_TRANSITIONS = {
      'pending': ['confirmed', 'preparing', 'inProgress', 'cancelled', 'pending_payment'],
      'pending_payment': ['payment_uploaded', 'payment_confirmed', 'cancelled'],
      'payment_uploaded': ['payment_confirmed', 'confirmed', 'preparing', 'cancelled'],
      'payment_confirmed': ['confirmed', 'preparing', 'inProgress', 'cancelled'],
      'confirmed': ['preparing', 'inProgress', 'ready', 'cancelled'],
      'preparing': ['ready', 'completed', 'delivered', 'cancelled'],
      'inProgress': ['ready', 'completed', 'delivered', 'cancelled'],
      'ready': ['completed', 'delivered', 'cancelled'],
      'completed': ['delivered'], // completed can only go to delivered
      'delivered': [], // terminal state
      'cancelled': [] // terminal state
    };
    
    // Fetch order first to check current status
    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const currentOrder = await Order.findOne(
      { _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) }
    ).select('status').lean();
    
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    const allowedNext = VALID_TRANSITIONS[currentOrder.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ 
        message: `No se puede cambiar de "${currentOrder.status}" a "${status}"`,
        code: 'INVALID_TRANSITION',
        currentStatus: currentOrder.status,
        allowedTransitions: allowedNext
      });
    }
    
    // Create update object
    const updateData = { 
      status,
      updatedAt: new Date(),
      $push: { statusHistory: { status, timestamp: new Date(), note: '' } }
    };
    
    // If status is changing to inProgress, set sentToKitchen to true
    if (status === "inProgress") {
      updateData.sentToKitchen = true;
    }
    
    // Update the order — compound query ensures tenant isolation
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) },
      updateData,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    // Emit to per-order tracking room for customer real-time updates
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });
    
    // Send push notification to customer about status change
    try {
      const { sendCustomerOrderStatusPush } = require('../services/pushService');
      const pushResult = await sendCustomerOrderStatusPush(updatedOrder, status);
      if (pushResult.sent > 0) {
        logger.info(`Customer push sent for order #${updatedOrder.orderNumber} -> ${status}`, pushResult);
      }
    } catch (pushErr) {
      logger.warn('Failed to send customer push for status change', { error: pushErr.message });
    }
    
    // If order is completed or delivered, move it to CompletedOrders collection
    if (status === "completed" || status === "delivered") {
      // Register MenuBy orders in cash register if one is open — atomic $push
      if (updatedOrder.orderChannel !== 'pos') {
        try {
          const CashRegister = require('../Models/CashRegister');
          await CashRegister.findOneAndUpdate(
            { businessId: updatedOrder.businessId, status: 'open' },
            { $push: { movements: {
              type: 'sale',
              amount: updatedOrder.finalAmount || updatedOrder.totalAmount,
              paymentMethod: updatedOrder.paymentMethod || 'cash',
              orderId: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber,
              orderChannel: 'menuby',
              description: `MenuBy #${updatedOrder.orderNumber} - ${updatedOrder.customerName}`,
              createdAt: new Date()
            }}}
          );
        } catch (cashErr) {
          logger.warn('Failed to register MenuBy sale in cash register', { error: cashErr.message, orderId: updatedOrder._id });
        }
      }

      try {
        // Convert Mongoose document to plain object
        const orderData = updatedOrder.toObject();
        
        // Delete payment proof file if exists
        if (orderData.paymentProof) {
          try {
            const proofFilePath = path.join(__dirname, '..', orderData.paymentProof);
            const fs = require('fs');
            if (fs.existsSync(proofFilePath)) {
              fs.unlinkSync(proofFilePath);
              logger.info(`Payment proof deleted: ${proofFilePath}`);
            }
          } catch (fileErr) {
            logger.warn('Could not delete payment proof file', { error: fileErr.message });
          }
        }
        
        // Create a new completed order (without proof path)
        const completedOrder = new CompletedOrder({
          ...orderData,
          paymentProof: null,
          completedAt: new Date(),
          status: "completed"
        });
        
        // Use transaction to atomically save completed order + delete active order
        const session = await mongoose.startSession();
        let moveSucceeded = false;
        try {
          await session.withTransaction(async () => {
            await completedOrder.save({ session });
            await Order.findByIdAndDelete(id, { session });
          });
          moveSucceeded = true;
        } catch (txErr) {
          logger.error('Transaction failed for order completion — order preserved in active', { error: txErr.message, orderId: id });
        } finally {
          session.endSession();
        }

        if (moveSucceeded) {
          // Notify clients that order was removed from active list
          setTimeout(() => {
            socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_deleted", { _id: id });
          }, 3000);
        }

        // ─── Loyalty: award points on completion ───
        if (updatedOrder.customerId) {
          try {
            const loyaltyProgram = await LoyaltyProgram.findOne({ businessId: updatedOrder.businessId, isActive: true }).lean();
            if (loyaltyProgram) {
              const amountForPoints = updatedOrder.finalAmount || updatedOrder.totalAmount;
              let pointsToAward = Math.floor(amountForPoints / loyaltyProgram.amountPerPoints) * loyaltyProgram.pointsPerAmount;

              // Apply tier multiplier
              if (loyaltyProgram.tiersEnabled && loyaltyProgram.tiers.length) {
                const existingLoyalty = await CustomerLoyalty.findOne({ businessId: updatedOrder.businessId, customerId: updatedOrder.customerId }).lean();
                if (existingLoyalty) {
                  const sorted = [...loyaltyProgram.tiers].sort((a, b) => b.minPoints - a.minPoints);
                  const tier = sorted.find(t => existingLoyalty.totalEarned >= t.minPoints);
                  if (tier && tier.multiplier > 1) {
                    pointsToAward = Math.floor(pointsToAward * tier.multiplier);
                  }
                }
              }

              if (pointsToAward > 0) {
                const expiresAt = loyaltyProgram.pointsExpiryDays > 0
                  ? new Date(Date.now() + loyaltyProgram.pointsExpiryDays * 86400000)
                  : undefined;

                let loyalty = await CustomerLoyalty.findOne({ businessId: updatedOrder.businessId, customerId: updatedOrder.customerId });
                const isFirstOrder = !loyalty;

                if (!loyalty) {
                  const customer = await Customer.findById(updatedOrder.customerId).lean();
                  loyalty = new CustomerLoyalty({
                    businessId: updatedOrder.businessId,
                    customerId: updatedOrder.customerId,
                    phone: customer ? customer.phone : ''
                  });
                }

                loyalty.earnPoints(pointsToAward, updatedOrder._id, `Pedido #${updatedOrder.orderNumber}`, expiresAt);

                // First order bonus
                if (isFirstOrder && loyaltyProgram.firstOrderBonus > 0) {
                  loyalty.earnPoints(loyaltyProgram.firstOrderBonus, updatedOrder._id, 'Bonus primer pedido', expiresAt);
                }

                // Compute tier
                if (loyaltyProgram.tiersEnabled && loyaltyProgram.tiers.length) {
                  loyalty.computeTier(loyaltyProgram.tiers);
                }

                await loyalty.save();
                logger.info(`Loyalty points awarded on completion: ${pointsToAward} pts for order #${updatedOrder.orderNumber}`);
              }
            }
          } catch (loyaltyErr) {
            logger.warn('Failed to award loyalty points on order completion', { error: loyaltyErr.message, orderId: updatedOrder._id });
          }
        }

        // Wait a bit to ensure clients receive the update before removing from active orders
        // (delete already handled inside transaction above)
      } catch (err) {
        logger.error('Error saving completed order', { error: err.message, orderId: id });
        // Continue with response even if saving to CompletedOrder fails
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error updating order status', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Send order to kitchen without changing status (admin only)
router.patch("/:id/send-to-kitchen", tenantAuth, validateSendToKitchen, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Update only the sentToKitchen field — compound query ensures tenant isolation
    const tenantBizIdKitchen = req.user.businessId || req.body.businessId || req.query.businessId;
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdKitchen ? { businessId: tenantBizIdKitchen } : {}) },
      { 
        sentToKitchen: true,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });
    
    res.json(updatedOrder);
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Delete an order (admin only)
router.delete("/:id", tenantAuth, validateDeleteOrder, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Compound query ensures tenant isolation
    const tenantBizIdDel = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOneAndDelete({ _id: id, ...(tenantBizIdDel ? { businessId: tenantBizIdDel } : {}) });
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(order.businessId.toString(), "order_deleted", { _id: id });
    
    res.json({ message: "Order deleted successfully" });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Generate daily sales report and close day (admin only)
router.post("/daily-closing", tenantAuth, validateDailyClosing, async (req, res) => {
  try {
    const { businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "Missing businessId" });
    }
    
    // Handle the businessId, which could be an ObjectId or a slug
    let businessObjectId;
    
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      businessObjectId = businessId;
    } else {
      // If it's a slug, find the corresponding business to get its ObjectId
      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Get today's date at midnight Colombia time (UTC-5)
    const today = startOfDayCOL();
    const tomorrow = endOfDayCOL();
    
    // Query completed orders for today that haven't been included in a report
    const completedOrders = await CompletedOrder.find({
      businessId: businessObjectId,
      completedAt: { $gte: today, $lt: tomorrow }
    }).populate('deliveryPersonId', 'name');
    
    if (completedOrders.length === 0) {
      return res.status(200).json({ 
        message: "No completed orders found for today", 
        orders: [], 
        stats: { 
          totalOrders: 0, 
          totalSales: 0, 
          totalAmount: 0,
          ordersByType: {
            inSite: { count: 0, total: 0 },
            takeaway: { count: 0, total: 0 },
            delivery: { count: 0, total: 0 }
          },
          topSellingItems: []
        }
      });
    }
    
    // Calculate report statistics
    const stats = {
      totalOrders: completedOrders.length,
      totalSales: 0,
      totalAmount: 0,
      ordersByType: {
        inSite: { count: 0, total: 0 },
        takeaway: { count: 0, total: 0 },
        delivery: { count: 0, total: 0 }
      },
      topSellingItems: {}
    };
    
    // Process orders
    completedOrders.forEach(order => {
      // Add to total sales
      stats.totalSales += order.totalAmount;
      stats.totalAmount += order.totalAmount;
      
      // Add to orders by type
      const type = order.orderType;
      stats.ordersByType[type].count += 1;
      stats.ordersByType[type].total += order.totalAmount;
      
      // Count items for top selling
      order.items.forEach(item => {
        const itemName = item.name;
        if (!stats.topSellingItems[itemName]) {
          stats.topSellingItems[itemName] = {
            count: 0,
            total: 0
          };
        }
        stats.topSellingItems[itemName].count += item.quantity;
        stats.topSellingItems[itemName].total += (item.price * item.quantity);
      });
    });
    
    // Convert top selling items to array and sort
    stats.topSellingItems = Object.entries(stats.topSellingItems)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 items
    
    // Mark orders as included in report
    await CompletedOrder.updateMany(
      { 
        _id: { $in: completedOrders.map(order => order._id) } 
      },
      { includedInReport: true }
    );
    
    res.json({
      message: "Daily closing report generated successfully",
      reportDate: today,
      orders: completedOrders,
      stats
    });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Cleanup completed orders after viewing report (admin only)
router.post("/cleanup-completed", tenantAuth, validateCleanupCompleted, async (req, res) => {
  try {
    const { businessId, orderIds } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "Missing businessId" });
    }
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "No order IDs provided for cleanup" });
    }
    
    // Handle the businessId, which could be an ObjectId or a slug
    let businessObjectId;
    
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      businessObjectId = businessId;
    } else {
      // If it's a slug, find the corresponding business to get its ObjectId
      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Delete the completed orders
    const result = await CompletedOrder.deleteMany({
      businessId: businessObjectId,
      _id: { $in: orderIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    
    return res.json({
      message: "Completed orders cleaned up successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ===== IN-APP ORDERING ENDPOINTS =====

// Upload payment proof (public - uses customerToken for auth)
router.post('/:id/payment-proof', (req, res, next) => {
  uploadProof.single('proof')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'La imagen es muy grande. Máximo 25MB.' });
      }
      if (err.message) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: 'Error al procesar la imagen. Intenta con otro archivo.' });
    }
    next();
  });
}, sanitizeUpload({ maxWidth: 1600, quality: 90 }), ...validatePaymentProof, async (req, res) => {
  try {
    const { id } = req.params;
    const { customerToken } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!customerToken) {
      return res.status(401).json({ message: 'Token de cliente requerido' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Imagen del comprobante requerida' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.customerToken !== customerToken) {
      return res.status(403).json({ message: 'Token inválido' });
    }

    if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_UPLOADED].includes(order.status)) {
      return res.status(400).json({ message: 'Este pedido no requiere comprobante de pago en este momento' });
    }

    // Save proof path — scoped by order ID
    const safeOrderId = id.replace(/[^a-zA-Z0-9]/g, '');
    const proofPath = `/uploads/order-proofs/${safeOrderId}/${req.file.filename}`;
    
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        paymentProof: proofPath,
        paymentProofUploadedAt: new Date(),
        status: ORDER_STATUS.PAYMENT_UPLOADED,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PAYMENT_UPLOADED, timestamp: new Date(), note: 'Comprobante de pago subido' } }
      },
      { new: true }
    );

    // Notify restaurant via socket
    socketService.emitToBusiness(order.businessId.toString(), 'payment_proof_uploaded', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      customerName: updatedOrder.customerName,
      paymentProof: proofPath,
      paymentMethod: updatedOrder.paymentMethod
    });

    // Push notification to restaurant
    try {
      const { sendPushToBusinessId } = require('../services/pushService');
      await sendPushToBusinessId(order.businessId.toString(), {
        title: `💳 Comprobante recibido - Pedido #${updatedOrder.orderNumber}`,
        body: `${updatedOrder.customerName} ha subido su comprobante de pago`,
        data: { orderId: updatedOrder._id.toString(), type: 'payment_proof' }
      });
    } catch (pushErr) {
      logger.warn('Failed to send push for payment proof', { error: pushErr.message });
    }

    logger.info(`Payment proof uploaded for order ${updatedOrder.orderNumber}`);
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    logger.error('Error uploading payment proof', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Confirm payment (admin only)
router.patch('/:id/confirm-payment', tenantAuth, validateConfirmPayment, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Compound query ensures tenant isolation
    const tenantBizIdPay = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizIdPay ? { businessId: tenantBizIdPay } : {}) });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.status !== ORDER_STATUS.PAYMENT_UPLOADED) {
      return res.status(400).json({ message: `No se puede confirmar pago en estado "${order.status}"` });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdPay ? { businessId: tenantBizIdPay } : {}) },
      {
        status: ORDER_STATUS.PAYMENT_CONFIRMED,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PAYMENT_CONFIRMED, timestamp: new Date(), note: note || 'Pago confirmado por el restaurante' } }
      },
      { new: true }
    );

    // Emit socket event for order update
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'order_updated', updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: ORDER_STATUS.PAYMENT_CONFIRMED, order: updatedOrder });

    // Also emit specific event for customer tracking
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'payment_confirmed', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      status: ORDER_STATUS.PAYMENT_CONFIRMED
    });

    logger.info(`Payment confirmed for order ${updatedOrder.orderNumber}`);

    // Push notification to customer
    try {
      const { sendCustomerOrderStatusPush } = require('../services/pushService');
      await sendCustomerOrderStatusPush(updatedOrder, ORDER_STATUS.PAYMENT_CONFIRMED);
    } catch (pushErr) {
      logger.warn('Failed to send customer push for payment confirmed', { error: pushErr.message });
    }

    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error confirming payment', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Reject payment (admin only)
router.patch('/:id/reject-payment', tenantAuth, validateRejectPayment, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Compound query ensures tenant isolation
    const tenantBizIdRej = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizIdRej ? { businessId: tenantBizIdRej } : {}) });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.status !== ORDER_STATUS.PAYMENT_UPLOADED) {
      return res.status(400).json({ message: `No se puede rechazar pago en estado "${order.status}"` });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdRej ? { businessId: tenantBizIdRej } : {}) },
      {
        status: ORDER_STATUS.PENDING_PAYMENT,
        paymentProof: null,
        paymentProofUploadedAt: null,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PENDING_PAYMENT, timestamp: new Date(), note: reason || 'Comprobante rechazado - sube uno nuevo' } }
      },
      { new: true }
    );

    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'order_updated', updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'payment_rejected', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      reason: reason || 'Comprobante rechazado'
    });

    logger.info(`Payment rejected for order ${updatedOrder.orderNumber}: ${reason}`);

    // Push notification to customer about rejection
    try {
      const { sendPushToCustomer } = require('../services/pushService');
      if (updatedOrder.customerToken) {
        await sendPushToCustomer(updatedOrder.customerToken, {
          title: `⚠️ Pedido #${updatedOrder.orderNumber} - Comprobante rechazado`,
          body: reason || 'Tu comprobante fue rechazado. Por favor sube uno nuevo.',
          clickUrl: '/',
          data: { orderId: updatedOrder._id.toString(), orderNumber: updatedOrder.orderNumber, status: ORDER_STATUS.PENDING_PAYMENT }
        });
      }
    } catch (pushErr) {
      logger.warn('Failed to send customer push for payment rejected', { error: pushErr.message });
    }

    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error rejecting payment', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /orders/customer/:phone - Obtener pedidos de un cliente por teléfono — ADMIN ONLY
router.get('/customer/:phone', tenantAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    
    // Use centralized business validation
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    // Find orders for this customer in this business
    const orders = await Order.find({
      businessId: businessObjectId,
      phone: phone
    }).sort({ createdAt: -1 }).limit(100).lean();
    
    logger.info(`Retrieved ${orders.length} orders for customer ${phone} in business ${businessObjectId}`);
    res.json(orders);
  } catch (error) {
    logger.error("Error fetching customer orders", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
module.exports.generateOrderNumber = generateOrderNumber;
