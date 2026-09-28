/**
 * Pedidos — Listas del panel: pedidos activos, completados y los de un cliente.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const { ObjectId } = require("mongoose").Types;
const { validateAndResolveBusinessId, createBusinessFilter } = require("../../utils/businessValidator");
const { SALES } = require('../../utils/revenue');
const logger = require("../../utils/logger");
const { tenantAuth } = require('../../middleware/tenantAuth');
const { startOfDayCOL, endOfDayCOL } = require('../../utils/timezone');

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

    // Date range filter — interpretar from/to como DÍAS COMPLETOS en hora
    // Colombia (UTC-5), igual que /daily-closing. Antes se usaba new Date(from)
    // (medianoche UTC) + setHours (TZ del servidor = UTC en prod), lo que
    // desplazaba el rango ~5h y perdía/incluía los pedidos de la noche.
    if (from || to) {
      const dateOnly = (s) => String(s).slice(0, 10); // "YYYY-MM-DD", robusto ante ISO completos
      filter.completedAt = {};
      if (from) filter.completedAt.$gte = startOfDayCOL(new Date(dateOnly(from) + 'T12:00:00Z'));
      if (to) filter.completedAt.$lt = endOfDayCOL(new Date(dateOnly(to) + 'T12:00:00Z'));
    }

    // Optional filters
    const allowedOrderTypes = ['inSite', 'takeaway', 'delivery'];
    if (orderType && allowedOrderTypes.includes(orderType)) {
      filter.orderType = orderType;
    }
    const allowedChannels = ['whatsapp', 'inapp', 'pos', 'admin'];
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
    
    // Stats agregados sobre TODO el filtro (no solo la página actual), para que
    // las tarjetas Pedidos/Ventas/Promedio/Productos reflejen el rango completo.
    // Ventas usa finalAmount (con descuentos/envíos) igual que el Excel; cae a
    // totalAmount cuando finalAmount es null.
    const [completedOrders, statsAgg] = await Promise.all([
      query.lean(),
      CompletedOrder.aggregate([
        // aggregate NO castea strings a ObjectId (a diferencia de find), así que
        // el businessId (string de validateAndResolveBusinessId) debe convertirse.
        { $match: { ...filter, businessId: new ObjectId(businessObjectId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: SALES },
            totalProducts: {
              $sum: {
                $reduce: {
                  input: { $ifNull: ['$items', []] },
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] }
                }
              }
            }
          }
        }
      ]),
    ]);

    const agg = statsAgg[0] || { totalOrders: 0, totalRevenue: 0, totalProducts: 0 };
    const total = agg.totalOrders;
    const stats = {
      totalOrders: agg.totalOrders,
      totalRevenue: agg.totalRevenue,
      totalProducts: agg.totalProducts,
      avgTicket: agg.totalOrders > 0 ? agg.totalRevenue / agg.totalOrders : 0,
    };

    // Always return structured response
    if (limitNum > 0) {
      return res.json({
        orders: completedOrders,
        stats,
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
