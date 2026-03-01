const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const Customer = require('../Models/Customer');
const Product = require('../Models/Product');
const BusinessConfig = require('../Models/BusinessConfig');
const { tenantAuth } = require('../middleware/tenantAuth');
const { startOfDayCOL, endOfDayCOL } = require('../utils/timezone');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/stats
 * 
 * Unified dashboard metrics endpoint.
 * Returns KPIs, charts data, top products, and customer stats.
 * Protected by tenantAuth (admin only).
 */
router.get('/stats', tenantAuth, async (req, res) => {
  try {
    const businessId = req.user?.businessId || req.resolvedBusinessId;
    if (!businessId) {
      return res.status(400).json({ message: 'businessId requerido' });
    }

    const bid = new mongoose.Types.ObjectId(businessId);

    // ── Time boundaries (Colombia timezone) ──
    const now = new Date();
    const todayStart = startOfDayCOL(now);
    const todayEnd = endOfDayCOL(now);

    // Yesterday
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStart = startOfDayCOL(yesterdayDate);
    const yesterdayEnd = endOfDayCOL(yesterdayDate);

    // Last 7 days (including today)
    const weekAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Last 30 days
    const monthAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);

    // ── Run all aggregations in parallel ──
    const [
      todayCompleted,
      yesterdayCompleted,
      todayPending,
      weeklyByDay,
      topProducts,
      channelBreakdown,
      paymentBreakdown,
      orderTypeBreakdown,
      customerStats,
      recentOrders,
      businessInfo,
    ] = await Promise.all([

      // 1. Today's completed orders stats
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: todayStart, $lt: todayEnd } } },
        { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgTicket: { $avg: '$totalAmount' },
          minOrder: { $min: '$totalAmount' },
          maxOrder: { $max: '$totalAmount' },
        }},
      ]),

      // 2. Yesterday's completed orders stats (for comparison)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: yesterdayStart, $lt: yesterdayEnd } } },
        { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
        }},
      ]),

      // 3. Current pending/active orders count
      Order.aggregate([
        { $match: { businessId: bid, status: { $in: ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'ready', 'inProgress'] } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
        }},
      ]),

      // 4. Daily breakdown for last 7 days (chart data)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: weekAgo, $lt: todayEnd } } },
        { $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedAt',
              timezone: 'America/Bogota',
            },
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        }},
        { $sort: { _id: 1 } },
      ]),

      // 5. Top 5 selling products (last 30 days)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: monthAgo, $lt: todayEnd } } },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        }},
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: '$_id', quantity: 1, revenue: 1 } },
      ]),

      // 6. Order channel breakdown (last 30 days)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: monthAgo, $lt: todayEnd } } },
        { $group: {
          _id: '$orderChannel',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        }},
      ]),

      // 7. Payment method breakdown (last 30 days)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: monthAgo, $lt: todayEnd } } },
        { $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        }},
      ]),

      // 8. Order type breakdown (last 30 days)
      CompletedOrder.aggregate([
        { $match: { businessId: bid, completedAt: { $gte: monthAgo, $lt: todayEnd } } },
        { $group: {
          _id: '$orderType',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        }},
      ]),

      // 9. Customer stats
      Customer.aggregate([
        { $match: { businessId: bid } },
        { $facet: {
          totals: [
            { $group: {
              _id: null,
              total: { $sum: 1 },
              totalRevenue: { $sum: '$totalSpent' },
              avgOrders: { $avg: '$totalOrders' },
            }},
          ],
          newToday: [
            { $match: { createdAt: { $gte: todayStart, $lt: todayEnd } } },
            { $count: 'count' },
          ],
          newThisWeek: [
            { $match: { createdAt: { $gte: weekAgo, $lt: todayEnd } } },
            { $count: 'count' },
          ],
          vip: [
            { $match: { status: 'vip' } },
            { $count: 'count' },
          ],
          returning: [
            { $match: { totalOrders: { $gte: 2 } } },
            { $count: 'count' },
          ],
        }},
      ]),

      // 10. Last 5 orders (recent activity)
      Order.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber customerName totalAmount status orderType createdAt')
        .lean(),

      // 11. Business config (for isOpen, reviewStats)
      BusinessConfig.findById(bid)
        .select('isOpen reviewStats orderingMode')
        .lean(),
    ]);

    // ── Process results ──

    // Today
    const today = todayCompleted[0] || { totalOrders: 0, totalRevenue: 0, avgTicket: 0, minOrder: 0, maxOrder: 0 };
    const yesterday = yesterdayCompleted[0] || { totalOrders: 0, totalRevenue: 0 };

    // Comparison deltas
    const ordersDelta = yesterday.totalOrders > 0
      ? Math.round(((today.totalOrders - yesterday.totalOrders) / yesterday.totalOrders) * 100)
      : today.totalOrders > 0 ? 100 : 0;
    const revenueDelta = yesterday.totalRevenue > 0
      ? Math.round(((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100)
      : today.totalRevenue > 0 ? 100 : 0;

    // Pending orders by status
    const pendingMap = {};
    todayPending.forEach(p => { pendingMap[p._id] = p.count; });
    const totalPending = todayPending.reduce((sum, p) => sum + p.count, 0);

    // Fill missing days in weekly chart
    const weeklyChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      // Format as YYYY-MM-DD in Colombia timezone
      const colDate = new Date(d.getTime() - 5 * 60 * 60 * 1000);
      const dateStr = colDate.toISOString().split('T')[0];
      const found = weeklyByDay.find(w => w._id === dateStr);
      weeklyChart.push({
        date: dateStr,
        orders: found?.orders || 0,
        revenue: found?.revenue || 0,
      });
    }

    // Channel breakdown → object
    const channels = {};
    channelBreakdown.forEach(c => {
      channels[c._id || 'unknown'] = { count: c.count, revenue: c.revenue };
    });

    // Payment breakdown → object
    const payments = {};
    paymentBreakdown.forEach(p => {
      payments[p._id || 'unknown'] = { count: p.count, revenue: p.revenue };
    });

    // Order type breakdown → object
    const orderTypes = {};
    orderTypeBreakdown.forEach(t => {
      orderTypes[t._id || 'unknown'] = { count: t.count, revenue: t.revenue };
    });

    // Customer stats
    const custData = customerStats[0] || {};
    const custTotals = custData.totals?.[0] || { total: 0, totalRevenue: 0, avgOrders: 0 };

    // Review stats from business config
    const reviewStats = businessInfo?.reviewStats || { averageRating: 0, totalReviews: 0 };

    // ── Build response ──
    res.json({
      // KPIs
      today: {
        orders: today.totalOrders,
        revenue: Math.round(today.totalRevenue),
        avgTicket: Math.round(today.avgTicket || 0),
        minOrder: Math.round(today.minOrder || 0),
        maxOrder: Math.round(today.maxOrder || 0),
      },
      comparison: {
        orders: ordersDelta,     // e.g. +25 means 25% more than yesterday
        revenue: revenueDelta,
      },
      pending: {
        total: totalPending,
        byStatus: pendingMap,    // { pending: 3, preparing: 2, ... }
      },

      // Charts
      weeklyChart,               // [{ date, orders, revenue }, ...]
      topProducts,               // [{ name, quantity, revenue }, ...]

      // Breakdowns (last 30 days)
      channels,                  // { whatsapp: { count, revenue }, inapp: { count, revenue } }
      payments,                  // { cash: { count, revenue }, nequi: {...}, ... }
      orderTypes,                // { inSite: { count, revenue }, delivery: {...}, ... }

      // Customers
      customers: {
        total: custTotals.total,
        newToday: custData.newToday?.[0]?.count || 0,
        newThisWeek: custData.newThisWeek?.[0]?.count || 0,
        vip: custData.vip?.[0]?.count || 0,
        returning: custData.returning?.[0]?.count || 0,
        avgOrders: Math.round((custTotals.avgOrders || 0) * 10) / 10,
      },

      // Reviews
      reviews: {
        average: Math.round((reviewStats.averageRating || 0) * 10) / 10,
        total: reviewStats.totalReviews || 0,
      },

      // Status
      business: {
        isOpen: businessInfo?.isOpen ?? true,
        orderingMode: businessInfo?.orderingMode || 'whatsapp',
      },

      // Recent activity
      recentOrders: recentOrders.map(o => ({
        orderNumber: o.orderNumber,
        customer: o.customerName,
        amount: o.totalAmount,
        status: o.status,
        type: o.orderType,
        time: o.createdAt,
      })),
    });

  } catch (error) {
    logger.error('Dashboard stats error', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
  }
});

module.exports = router;
