const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliverySession = require('../Models/DeliverySession');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const { tenantAuth } = require('../middleware/tenantAuth');
const { resolveBusinessId } = require('../utils/businessResolver');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

// Helper: generate 4-digit confirmation code
function generateConfirmationCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper: generate UUID token for QR
function generateDeliveryToken() {
  return crypto.randomUUID();
}

// Helper: resolve slug to businessId
async function resolveSlug(slug) {
  const business = await BusinessConfig.findOne({ slug }).select('_id').lean();
  if (!business) throw new Error('Negocio no encontrado');
  return business._id;
}

// ============================================
// DELIVERY PERSONS (Profiles) — CRUD
// ============================================

// GET /api/delivery-admin/restaurants/:slug/delivery-persons
router.get('/restaurants/:slug/delivery-persons', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const persons = await DeliveryPerson.find({ businessId }).sort({ createdAt: -1 }).lean();
    // Never expose hashed code
    const safe = persons.map(p => ({ ...p, code: undefined }));
    res.json(safe);
  } catch (error) {
    logger.error('Error fetching delivery persons', error);
    res.status(500).json({ message: 'Error al obtener domiciliarios' });
  }
});

// POST /api/delivery-admin/restaurants/:slug/delivery-persons
router.post('/restaurants/:slug/delivery-persons', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const { name, code } = req.body;

    if (!name || !code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      return res.status(400).json({ message: 'Nombre requerido y código debe ser exactamente 4 dígitos numéricos' });
    }

    // Check for duplicate code (by hashing and comparing)
    const existing = await DeliveryPerson.findByCode(businessId, code);
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un domiciliario con ese código' });
    }

    const person = new DeliveryPerson({ businessId, name: name.trim(), code });
    await person.save();

    res.status(201).json({ _id: person._id, name: person.name, active: person.active, status: person.status, createdAt: person.createdAt });
  } catch (error) {
    logger.error('Error creating delivery person', error);
    res.status(500).json({ message: 'Error al crear domiciliario' });
  }
});

// PATCH /api/delivery-admin/restaurants/:slug/delivery-persons/:dpId
router.patch('/restaurants/:slug/delivery-persons/:dpId', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const person = await DeliveryPerson.findOne({ _id: req.params.dpId, businessId });
    if (!person) return res.status(404).json({ message: 'Domiciliario no encontrado' });

    if (req.body.name !== undefined) person.name = req.body.name.trim();
    if (req.body.active !== undefined) person.active = req.body.active;
    if (req.body.code && /^\d{4}$/.test(req.body.code)) {
      person.code = req.body.code; // Will be hashed by pre-save hook
    }

    await person.save();
    res.json({ _id: person._id, name: person.name, active: person.active, status: person.status });
  } catch (error) {
    logger.error('Error updating delivery person', error);
    res.status(500).json({ message: 'Error al actualizar domiciliario' });
  }
});

// ============================================
// DAILY SESSION (Mode 2 — Fixed domi)
// ============================================

// POST /api/delivery-admin/restaurants/:slug/delivery-session/generate
router.post('/restaurants/:slug/delivery-session/generate', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { code } = req.body;

    if (!code || code.trim().length < 3 || code.trim().length > 10) {
      return res.status(400).json({ message: 'Código diario debe tener entre 3 y 10 caracteres' });
    }

    // Upsert: create or update for today
    const session = await DeliverySession.findOneAndUpdate(
      { businessId, validDate: today },
      { dailyCode: code.trim().toUpperCase(), active: true },
      { upsert: true, new: true }
    );

    res.json(session);
  } catch (error) {
    logger.error('Error generating daily session', error);
    res.status(500).json({ message: 'Error al generar sesión diaria' });
  }
});

// GET /api/delivery-admin/restaurants/:slug/delivery-session/today
router.get('/restaurants/:slug/delivery-session/today', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const today = new Date().toISOString().slice(0, 10);
    const session = await DeliverySession.findOne({ businessId, validDate: today, active: true }).lean();
    if (!session) return res.status(404).json(null);
    res.json(session);
  } catch (error) {
    logger.error('Error fetching daily session', error);
    res.status(500).json({ message: 'Error al obtener sesión diaria' });
  }
});

// ============================================
// ASSIGN DELIVERY — dashboard actions
// ============================================

// POST /api/delivery-admin/restaurants/:slug/orders/:id/assign-qr (Mode 1)
router.post('/restaurants/:slug/orders/:id/assign-qr', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (order.orderType !== 'delivery') return res.status(400).json({ message: 'Solo pedidos de delivery' });

    // Reuse existing token/code if already assigned
    const token = order.deliveryToken || generateDeliveryToken();
    const code = order.confirmationCode || generateConfirmationCode();

    if (!order.deliveryToken) {
      order.deliveryMode = 'qr';
      order.deliveryToken = token;
      order.deliveryTokenExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      order.confirmationCode = code;
      order.confirmationAttempts = 0;
      order.deliveryAssignedAt = new Date();
      order.status = 'inProgress';
      order.statusHistory.push({ status: 'inProgress', timestamp: new Date(), note: 'Domiciliario asignado (QR)' });
      await order.save();
    }

    // Notify dashboard
    socketService.emitToBusiness(businessId, 'orderUpdated', order.toObject());

    // Notify domi delivery room
    socketService.emitToDeliveryRoom(req.params.slug, 'delivery:assigned', {
      orderId: order._id,
      address: order.address,
      customer: { name: order.customerName, phone: order.phone },
      items: order.items,
      total: order.finalAmount || order.totalAmount
    });

    // Build QR URL
    const business = await BusinessConfig.findById(businessId).select('slug').lean();
    const qrUrl = `https://menuby.tech/${business.slug}/delivery/${token}`;

    res.json({
      confirmationCode: code,
      deliveryToken: token,
      qrUrl,
      phone: order.phone,
      customerName: order.customerName
    });
  } catch (error) {
    logger.error('Error assigning QR delivery', error);
    res.status(500).json({ message: 'Error al asignar domicilio QR' });
  }
});

// POST /api/delivery-admin/restaurants/:slug/orders/:id/assign-delivery-person (Mode 2 & 3)
router.post('/restaurants/:slug/orders/:id/assign-delivery-person', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (order.orderType !== 'delivery') return res.status(400).json({ message: 'Solo pedidos de delivery' });

    const { deliveryPersonId, mode } = req.body; // mode: 'fixed' or 'profile'
    const code = order.confirmationCode || generateConfirmationCode();
    const isNewAssignment = !order.confirmationCode;

    if (isNewAssignment) {
      order.deliveryMode = mode === 'fixed' ? 'fixed' : 'profile';
      order.confirmationCode = code;
      order.confirmationAttempts = 0;
      order.deliveryAssignedAt = new Date();
      order.status = 'inProgress';
      order.statusHistory.push({ status: 'inProgress', timestamp: new Date(), note: `Domiciliario asignado (${order.deliveryMode})` });
    }

    if (deliveryPersonId) {
      order.deliveryPersonId = deliveryPersonId;
      // Update domi status
      await DeliveryPerson.findByIdAndUpdate(deliveryPersonId, { status: 'on_delivery' });
    }

    await order.save();

    // Get business slug for tracking URL
    const business = await BusinessConfig.findById(businessId).select('slug').lean();
    const trackUrl = `https://menuby.tech/${business.slug}/track/${order._id}`;

    // Emit to dashboard
    socketService.emitToBusiness(businessId, 'orderUpdated', order.toObject());

    // Emit to domi delivery room (domis join restaurant:${slug}:delivery)
    const assignedData = {
      orderId: order._id,
      deliveryPersonId: deliveryPersonId || null,
      address: order.address,
      customer: { name: order.customerName, phone: order.phone },
      items: order.items,
      total: order.finalAmount || order.totalAmount
    };
    socketService.emitToDeliveryRoom(business.slug, 'delivery:assigned', assignedData);

    res.json({
      confirmationCode: code,
      phone: order.phone,
      customerName: order.customerName,
      trackUrl
    });
  } catch (error) {
    logger.error('Error assigning delivery person', error);
    res.status(500).json({ message: 'Error al asignar domiciliario' });
  }
});

// ============================================
// DELIVERY STATS
// ============================================

// GET /api/delivery-admin/restaurants/:slug/delivery-stats
router.get('/restaurants/:slug/delivery-stats', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const bId = typeof businessId === 'string' ? new (require('mongoose').Types.ObjectId)(businessId) : businessId;

    // Active delivery orders (inProgress in Order collection)
    const activeOrders = await Order.countDocuments({
      businessId,
      orderType: 'delivery',
      deliveryMode: { $ne: null },
      status: { $in: ['inProgress'] }
    });

    // Today's deliveries — count from BOTH collections (delivered in Order + completed in CompletedOrder)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayFilter = { businessId, orderType: 'delivery', deliveredAt: { $gte: todayStart, $lte: todayEnd } };
    const [todayActive, todayCompleted] = await Promise.all([
      Order.countDocuments({ ...todayFilter, status: 'delivered' }),
      CompletedOrder.countDocuments(todayFilter)
    ]);
    const todayTotal = todayActive + todayCompleted;

    // Total deliveries all time — both collections
    const allTimeFilter = { businessId, orderType: 'delivery', deliveredAt: { $ne: null } };
    const [totalActive, totalCompleted] = await Promise.all([
      Order.countDocuments({ ...allTimeFilter, status: 'delivered' }),
      CompletedOrder.countDocuments(allTimeFilter)
    ]);
    const totalDeliveries = totalActive + totalCompleted;

    // Average delivery time (from assigned to delivered) — both collections
    const avgMatch = { businessId: bId, deliveryAssignedAt: { $ne: null }, deliveredAt: { $ne: null } };
    const avgProject = { deliveryMinutes: { $divide: [{ $subtract: ['$deliveredAt', '$deliveryAssignedAt'] }, 60000] } };
    const avgGroup = { _id: null, avgMinutes: { $avg: '$deliveryMinutes' }, count: { $sum: 1 } };

    const [avgActive, avgCompleted2] = await Promise.all([
      Order.aggregate([{ $match: { ...avgMatch, status: 'delivered' } }, { $project: avgProject }, { $group: avgGroup }]),
      CompletedOrder.aggregate([{ $match: avgMatch }, { $project: avgProject }, { $group: avgGroup }])
    ]);

    const a1 = avgActive[0] || { avgMinutes: 0, count: 0 };
    const a2 = avgCompleted2[0] || { avgMinutes: 0, count: 0 };
    const combinedCount = a1.count + a2.count;
    const avgMinutes = combinedCount > 0
      ? Math.round(((a1.avgMinutes || 0) * a1.count + (a2.avgMinutes || 0) * a2.count) / combinedCount)
      : 0;

    // Chart data: deliveries per day (last 7 days) — both collections
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayFilter = { businessId, orderType: 'delivery', deliveredAt: { $gte: dayStart, $lte: dayEnd } };
      const [cActive, cCompleted] = await Promise.all([
        Order.countDocuments({ ...dayFilter, status: 'delivered' }),
        CompletedOrder.countDocuments(dayFilter)
      ]);

      chartData.push({
        date: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
        count: cActive + cCompleted
      });
    }

    res.json({ activeOrders, todayDeliveries: todayTotal, totalDeliveries, avgMinutes, chartData });
  } catch (error) {
    logger.error('Error fetching delivery stats', error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// GET /api/delivery-admin/restaurants/:slug/delivery-persons/:dpId/stats
router.get('/restaurants/:slug/delivery-persons/:dpId/stats', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const { dpId } = req.params;
    const { from, to } = req.query;

    const match = {
      businessId: typeof businessId === 'string' ? new (require('mongoose').Types.ObjectId)(businessId) : businessId,
      deliveryPersonId: new (require('mongoose').Types.ObjectId)(dpId),
      deliveredAt: { $ne: null }
    };

    if (from || to) {
      match.deliveredAt = {};
      if (from) match.deliveredAt.$gte = new Date(from);
      if (to) match.deliveredAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    // Query both Order (delivered) and CompletedOrder
    const activeMatch = { ...match, status: 'delivered' };
    const groupStage = {
      _id: null,
      totalDeliveries: { $sum: 1 },
      avgMinutes: {
        $avg: {
          $cond: [
            { $and: [{ $ne: ['$deliveryAssignedAt', null] }, { $ne: ['$deliveredAt', null] }] },
            { $divide: [{ $subtract: ['$deliveredAt', '$deliveryAssignedAt'] }, 60000] },
            null
          ]
        }
      },
      avgAttempts: { $avg: '$confirmationAttempts' }
    };

    const [pipeActive, pipeCompleted] = await Promise.all([
      Order.aggregate([{ $match: activeMatch }, { $group: groupStage }]),
      CompletedOrder.aggregate([{ $match: match }, { $group: groupStage }])
    ]);

    const s1 = pipeActive[0] || { totalDeliveries: 0, avgMinutes: 0, avgAttempts: 0 };
    const s2 = pipeCompleted[0] || { totalDeliveries: 0, avgMinutes: 0, avgAttempts: 0 };
    const totalDels = s1.totalDeliveries + s2.totalDeliveries;
    const combinedAvg = totalDels > 0
      ? ((s1.avgMinutes || 0) * s1.totalDeliveries + (s2.avgMinutes || 0) * s2.totalDeliveries) / totalDels
      : 0;
    const combinedAttempts = totalDels > 0
      ? ((s1.avgAttempts || 0) * s1.totalDeliveries + (s2.avgAttempts || 0) * s2.totalDeliveries) / totalDels
      : 0;

    // Deliveries by day — both collections
    const dayGroup = [
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ];
    const [byDayActive, byDayCompleted] = await Promise.all([
      Order.aggregate([{ $match: activeMatch }, ...dayGroup]),
      CompletedOrder.aggregate([{ $match: match }, ...dayGroup])
    ]);

    // Merge by-day results
    const dayMap = {};
    for (const d of [...byDayActive, ...byDayCompleted]) {
      dayMap[d._id] = (dayMap[d._id] || 0) + d.count;
    }
    const byDay = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // Total assigned (for success rate) — both collections
    const assignedMatch = { ...match, deliveredAt: undefined, deliveryAssignedAt: { $ne: null } };
    const activeAssignedMatch = { ...assignedMatch, status: 'delivered' };
    const [assignedActive, assignedCompleted] = await Promise.all([
      Order.countDocuments(activeAssignedMatch),
      CompletedOrder.countDocuments(assignedMatch)
    ]);
    const totalAssigned = assignedActive + assignedCompleted;

    res.json({
      totalDeliveries: totalDels,
      avgDeliveryMinutes: Math.round(combinedAvg || 0),
      successRate: totalAssigned > 0 ? Math.round((totalDels / totalAssigned) * 100) : 100,
      avgConfirmationAttempts: Math.round((combinedAttempts || 1) * 10) / 10,
      deliveriesByDay: byDay
    });
  } catch (error) {
    logger.error('Error fetching delivery person stats', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del domiciliario' });
  }
});

module.exports = router;
