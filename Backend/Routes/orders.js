const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../Models/Order");
const CompletedOrder = require("../Models/CompletedOrder");
const Customer = require("../Models/Customer");
const Coupon = require("../Models/Coupon");
const { ObjectId } = require("mongoose").Types;
const socketService = require("../services/socketService");
const { validateAndResolveBusinessId, createBusinessFilter } = require("../utils/businessValidator");
const { isValidObjectId } = require("../utils/validators");
const logger = require("../utils/logger");
const { getSubscriptionForBusiness } = require('../utils/subscriptionHelper');
const authMiddleware = require('../middleware/authMiddleware');

// Helper function to get order number
const generateOrderNumber = async (businessId) => {
  try {
    // Find the highest order number for this business and increment
    const latestOrder = await Order.findOne({ businessId })
      .sort({ createdAt: -1 })
      .limit(1);
    
    if (!latestOrder) {
      return "1"; // Start from 1
    }
    
    // Extract the number and increment
    const lastNumber = parseInt(latestOrder.orderNumber, 10);
    return (lastNumber + 1).toString();
  } catch (error) {

    // Fallback to timestamp-based order number
    return Date.now().toString();
  }
};

// Get all orders for a business (with optional filtering)
router.get("/", async (req, res) => {
  try {
    const { businessId, status, orderType } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }
    
    // Use the centralized business validation
    const filter = await createBusinessFilter(businessId);
    
    // Add optional filters
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    
    // Get orders sorted by creation date (newest first)
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    
    logger.info(`Retrieved ${orders.length} orders for business ${businessId}`);
    res.json(orders);
  } catch (error) {
    logger.error("Error fetching orders", error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new order
router.post("/", async (req, res) => {
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
      deliveryZoneInfo,
      deliveryCalculated,
      deliveryNeedsConfirmation
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
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || !item.quantity || !item.price) {
        return res.status(400).json({ message: "Each item must have name (string), quantity and price" });
      }
    }

    // Validate orderType
    const validOrderTypes = ['dine-in', 'takeout', 'delivery', 'table'];
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
      coupon = await Coupon.findOne({ 
        businessId: businessObjectId, 
        code: couponCode.toUpperCase() 
      });
      
      if (coupon) {
        const orderData = {
          totalAmount: numericTotalAmount,
          orderType,
          items
        };
        
        const validation = coupon.validateForOrder(orderData, customer ? customer._id : null);
        
        if (validation.valid) {
          discountAmount = coupon.calculateDiscount(numericTotalAmount);
          finalAmount = numericTotalAmount - discountAmount;
          
          // Record coupon usage
          await coupon.recordUsage(customer ? customer._id : null, discountAmount);
        } else {
          return res.status(400).json({ 
            message: `Cupón inválido: ${validation.error}` 
          });
        }
      } else {
        return res.status(404).json({ 
          message: 'Cupón no encontrado' 
        });
      }
    }

    // Create the order
    const newOrder = new Order({
      businessId: businessObjectId,
      orderNumber,
      customerName,
      orderType,
      items,
      totalAmount: numericTotalAmount,
      tableNumber: tableNumber || "",
      phone: phone || "",
      address: address || "",
      customerId: customer ? customer._id : null,
      couponCode: coupon ? coupon.code : null,
      couponId: coupon ? coupon._id : null,
      discountAmount,
      finalAmount,
      // Datos de zona de entrega
      deliveryFee: deliveryFee || null,
      deliveryZoneName: deliveryZoneName || null,
      deliveryZoneInfo: deliveryZoneInfo || null,
      deliveryCalculated: deliveryCalculated || false,
      deliveryNeedsConfirmation: deliveryNeedsConfirmation || false,
      status: "pending",
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
    
    // Emit socket event
    socketService.emitToBusiness(businessObjectId.toString(), "order_created", savedOrder);
    
    // Enviar notificación push por nuevo pedido
    const { sendPushToBusinessId } = require('../services/pushService');
    try {
      const payload = {
        title: `🆕 Nuevo Pedido #${orderNumber}`,
        body: `Nuevo pedido de ${customerName} - ${numericTotalAmount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        clickUrl: `/admin/orders/${savedOrder._id}`,
        data: { orderId: savedOrder._id.toString(), orderNumber, status: 'pending' }
      };
      await sendPushToBusinessId(businessObjectId.toString(), payload);
    } catch (pushError) {
      // No fallar la request si el push falla
      logger.warn('Failed to send push notification for new order', { error: pushError.message });
    }
    
    logger.info(`Created new order ${orderNumber} for business ${businessId}`);
    res.status(201).json(savedOrder);
  } catch (error) {
    logger.error("Error creating order", error);
    res.status(500).json({ message: error.message });
  }
});

// Get all completed orders for a business (historical view)
router.get("/completed", async (req, res) => {
  try {
    const { businessId, page, limit: queryLimit } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }
    
    // Use centralized business validation
    const businessResult = await validateAndResolveBusinessId(businessId);
    
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;
    
    // Pagination (optional — without params returns all for backward compat)
    const pageNum = parseInt(page) || 0;
    const limitNum = parseInt(queryLimit) || 0;
    
    let query = CompletedOrder.find({
      businessId: businessObjectId
    }).sort({ completedAt: -1 });
    
    if (limitNum > 0) {
      query = query.limit(limitNum).skip(pageNum > 0 ? (pageNum - 1) * limitNum : 0);
    }
    
    const completedOrders = await query;
    
    // If paginated, include total count
    if (limitNum > 0) {
      const total = await CompletedOrder.countDocuments({ businessId: businessObjectId });
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
    res.status(500).json({ message: error.message });
  }
});

// Get order by ID - MUST BE AFTER specific routes to avoid intercepting them
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    res.json(order);
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
});

// Update order status (admin only)
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    if (!status || !["pending", "inProgress", "completed", "ready"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    
    // Create update object
    const updateData = { 
      status,
      updatedAt: new Date()
    };
    
    // If status is changing to inProgress, set sentToKitchen to true
    if (status === "inProgress") {
      updateData.sentToKitchen = true;
    }
    
    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    
    // If order is completed, move it to CompletedOrders collection
    if (status === "completed") {
      try {
        // Convert Mongoose document to plain object
        const orderData = updatedOrder.toObject();
        
        // Create a new completed order
        const completedOrder = new CompletedOrder({
          ...orderData,
          completedAt: new Date(),
          status: "completed"
        });
        
        // Save completed order
        await completedOrder.save();
        
        // Wait a bit to ensure clients receive the update before removing from active orders
        setTimeout(async () => {
          try {
            // Remove from active orders
            await Order.findByIdAndDelete(id);
            socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_deleted", { _id: id });
          } catch (err) {

          }
        }, 5000); // 5 seconds delay
      } catch (err) {

        // Continue with response even if saving to CompletedOrder fails
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
});

// Send order to kitchen without changing status (admin only)
router.patch("/:id/send-to-kitchen", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Update only the sentToKitchen field
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
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
    
    res.json(updatedOrder);
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
});

// Delete an order (admin only)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Find order first to get businessId for socket event
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    await Order.findByIdAndDelete(id);
    
    // Emit socket event
    socketService.emitToBusiness(order.businessId.toString(), "order_deleted", { _id: id });
    
    res.json({ message: "Order deleted successfully" });
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
});

// Generate daily sales report and close day (admin only)
router.post("/daily-closing", authMiddleware, async (req, res) => {
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
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow's date at midnight
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Query completed orders for today that haven't been included in a report
    const completedOrders = await CompletedOrder.find({
      businessId: businessObjectId,
      completedAt: { $gte: today, $lt: tomorrow }
    });
    
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

    res.status(500).json({ message: error.message });
  }
});

// Cleanup completed orders after viewing report (admin only)
router.post("/cleanup-completed", authMiddleware, async (req, res) => {
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

    res.status(500).json({ message: error.message });
  }
});

// GET /orders/customer/:phone - Obtener pedidos de un cliente por teléfono
router.get('/customer/:phone', async (req, res) => {
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
    }).sort({ createdAt: -1 });
    
    logger.info(`Retrieved ${orders.length} orders for customer ${phone} in business ${businessObjectId}`);
    res.json(orders);
  } catch (error) {
    logger.error("Error fetching customer orders", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 
