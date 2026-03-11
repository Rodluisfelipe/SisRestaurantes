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

// ── Dashboard stats cache (60-second TTL per business) ──
const _statsCache = new Map();
const STATS_CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * GET /api/dashboard/stats
 * 
 * Unified dashboard metrics endpoint.
 * Returns KPIs, charts data, top products, and customer stats.
 * Protected by tenantAuth (admin only).
 */
router.get('/stats', tenantAuth, async (req, res) => {
  try {
    let businessId = req.user?.businessId || req.resolvedBusinessId;

    // Fallback: if token doesn't contain businessId, look it up from Admin doc
    if (!businessId && req.user?.id) {
      const Admin = require('../Models/Admin');
      const admin = await Admin.findById(req.user.id).select('businessId').lean();
      if (admin?.businessId) businessId = admin.businessId;
    }

    if (!businessId) {
      return res.status(400).json({ message: 'businessId requerido' });
    }

    // Check cache first (60s TTL)
    const cacheKey = businessId.toString();
    const cached = _statsCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return res.json(cached.data);
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
      recentActiveOrders,
      recentCompletedOrders,
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

      // 10. Last 5 active orders (recent activity)
      Order.find({ businessId: bid })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber customerName totalAmount status orderType items createdAt')
        .lean(),

      // 11. Last 5 completed orders (recent activity)
      CompletedOrder.find({ businessId: bid })
        .sort({ completedAt: -1 })
        .limit(5)
        .select('orderNumber customerName totalAmount status orderType items completedAt createdAt')
        .lean(),

      // 12. Business config (for isOpen, reviewStats)
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

    // Channel breakdown → object of counts
    const channels = {};
    channelBreakdown.forEach(c => {
      channels[c._id || 'unknown'] = c.count;
    });

    // Payment breakdown → object of counts
    const payments = {};
    paymentBreakdown.forEach(p => {
      payments[p._id || 'unknown'] = p.count;
    });

    // Order type breakdown → object of counts
    const orderTypes = {};
    orderTypeBreakdown.forEach(t => {
      orderTypes[t._id || 'unknown'] = t.count;
    });

    // Merge recent orders from both active and completed collections
    const allRecentOrders = [
      ...recentActiveOrders.map(o => ({ ...o, _sortDate: o.createdAt })),
      ...recentCompletedOrders.map(o => ({ ...o, _sortDate: o.completedAt || o.createdAt })),
    ]
      .sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate))
      .slice(0, 5);

    // Customer stats
    const custData = customerStats[0] || {};
    const custTotals = custData.totals?.[0] || { total: 0, totalRevenue: 0, avgOrders: 0 };

    // Review stats from business config
    const reviewStats = businessInfo?.reviewStats || { averageRating: 0, totalReviews: 0 };

    // ── Build response ──
    const responseData = {
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
      channels,                  // { whatsapp: 5, inapp: 3 }
      payments,                  // { cash: 4, nequi: 2, ... }
      orderTypes,                // { inSite: 3, delivery: 2, ... }

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
      recentOrders: allRecentOrders.map(o => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        totalAmount: o.totalAmount,
        status: o.status,
        orderType: o.orderType,
        itemCount: o.items?.length || 0,
        createdAt: o._sortDate || o.createdAt,
      })),
    };

    // Cache the result for 60 seconds
    _statsCache.set(cacheKey, { data: responseData, expires: Date.now() + STATS_CACHE_TTL });
    // Prevent unbounded growth
    if (_statsCache.size > 100) {
      const oldest = _statsCache.keys().next().value;
      _statsCache.delete(oldest);
    }

    res.json(responseData);

  } catch (error) {
    logger.error('Dashboard stats error', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del dashboard' });
  }
});

/**
 * GET /api/dashboard/viewers
 * 
 * Returns current live viewers for the business menu.
 * Protected by tenantAuth.
 */
router.get('/viewers', tenantAuth, async (req, res) => {
  try {
    const businessId = (req.query.businessId || req.user?.businessId || '').toString();
    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }
    
    const viewerTracker = require('../services/viewerTracker');
    const viewers = viewerTracker.getViewers(businessId);
    
    res.json({
      count: viewers.length,
      viewers
    });
  } catch (error) {
    logger.error('Dashboard viewers error', error);
    res.status(500).json({ message: 'Error al obtener visitantes en vivo' });
  }
});

/**
 * GET /api/dashboard/abandoned-carts
 * 
 * Returns today's abandoned carts (sessions with cartTotal > 0 that didn't convert).
 */
router.get('/abandoned-carts', tenantAuth, async (req, res) => {
  try {
    const businessId = req.query.businessId || req.user?.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const ViewerSession = require('../Models/ViewerSession');
    const bid = new mongoose.Types.ObjectId(businessId);
    const todayStart = startOfDayCOL(new Date());

    const abandoned = await ViewerSession.find({
      businessId: bid,
      enteredAt: { $gte: todayStart },
      converted: false,
      cartTotal: { $gt: 0 }
    })
    .sort({ enteredAt: -1 })
    .limit(100)
    .lean();

    // Deduplicar por teléfono: quedarse solo con la sesión más reciente de cada phone
    const seen = new Set();
    const unique = [];
    for (const a of abandoned) {
      const key = a.phone || `anon_${a._id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }

    const totalLost = unique.reduce((s, a) => s + (a.cartTotal || 0), 0);

    res.json({
      count: unique.length,
      totalLost,
      carts: unique.slice(0, 50).map(a => ({
        customerName: a.customerName,
        phone: a.phone,
        cartProducts: a.cartProducts,
        cartTotal: a.cartTotal,
        duration: a.duration,
        source: a.source,
        device: a.device,
        leftAt: a.leftAt,
        lastCategory: a.lastCategory
      }))
    });
  } catch (error) {
    logger.error('Dashboard abandoned-carts error', error);
    res.status(500).json({ message: 'Error al obtener carritos abandonados' });
  }
});

/**
 * GET /api/dashboard/viewer-stats
 * 
 * Returns historical viewer analytics: conversion rate, traffic sources, hourly breakdown.
 * Query param: period=today|week|month (default: today)
 */
router.get('/viewer-stats', tenantAuth, async (req, res) => {
  try {
    const businessId = req.query.businessId || req.user?.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const ViewerSession = require('../Models/ViewerSession');
    const bid = new mongoose.Types.ObjectId(businessId);
    const period = req.query.period || 'today';

    const now = new Date();
    let dateFrom;
    if (period === 'week') {
      dateFrom = new Date(startOfDayCOL(now).getTime() - 6 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFrom = new Date(startOfDayCOL(now).getTime() - 29 * 24 * 60 * 60 * 1000);
    } else {
      dateFrom = startOfDayCOL(now);
    }

    const [
      totalSessions,
      convertedSessions,
      sourceBreakdown,
      hourlyBreakdown,
      avgDuration
    ] = await Promise.all([
      // Total sessions
      ViewerSession.countDocuments({ businessId: bid, enteredAt: { $gte: dateFrom } }),
      // Converted
      ViewerSession.countDocuments({ businessId: bid, enteredAt: { $gte: dateFrom }, converted: true }),
      // Source breakdown
      ViewerSession.aggregate([
        { $match: { businessId: bid, enteredAt: { $gte: dateFrom } } },
        { $group: { _id: '$source', count: { $sum: 1 }, converted: { $sum: { $cond: ['$converted', 1, 0] } } } },
        { $sort: { count: -1 } }
      ]),
      // Hourly breakdown (using Colombia offset -5h)
      ViewerSession.aggregate([
        { $match: { businessId: bid, enteredAt: { $gte: dateFrom } } },
        { $project: { hour: { $hour: { date: '$enteredAt', timezone: 'America/Bogota' } } } },
        { $group: { _id: '$hour', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      // Avg duration
      ViewerSession.aggregate([
        { $match: { businessId: bid, enteredAt: { $gte: dateFrom }, duration: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$duration' }, avgConverted: {
          $avg: { $cond: [{ $eq: ['$converted', true] }, '$duration', null] }
        }, avgNotConverted: {
          $avg: { $cond: [{ $eq: ['$converted', false] }, '$duration', null] }
        } } }
      ])
    ]);

    const conversionRate = totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 100) : 0;
    const durationData = avgDuration[0] || { avg: 0, avgConverted: 0, avgNotConverted: 0 };

    res.json({
      period,
      totalSessions,
      convertedSessions,
      conversionRate,
      sources: sourceBreakdown.map(s => ({
        source: s._id || 'direct',
        count: s.count,
        converted: s.converted
      })),
      hourly: hourlyBreakdown.map(h => ({
        hour: h._id,
        count: h.count
      })),
      avgDuration: {
        all: Math.round(durationData.avg || 0),
        converted: Math.round(durationData.avgConverted || 0),
        notConverted: Math.round(durationData.avgNotConverted || 0)
      }
    });
  } catch (error) {
    logger.error('Dashboard viewer-stats error', error);
    res.status(500).json({ message: 'Error al obtener estadísticas de visitantes' });
  }
});

module.exports = router;
