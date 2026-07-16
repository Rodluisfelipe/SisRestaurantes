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
  return crypto.randomInt(1000, 10000).toString();
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
    // Never expose hashed code / password / refresh
    const safe = persons.map(p => ({
      ...p, code: undefined, passwordHash: undefined, refreshTokenHash: undefined,
      hasAccount: !!p.passwordHash,
    }));
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
    const { name, code, phone, password } = req.body;

    if (!name || !name.trim() || !code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      return res.status(400).json({ message: 'Nombre requerido y código debe ser exactamente 4 dígitos numéricos' });
    }

    // Check for duplicate code across ALL domis of the business (active or not),
    // so a reactivated domi can never collide on PIN.
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const existing = await DeliveryPerson.findOne({ businessId, code: hashedCode });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un domiciliario con ese código' });
    }

    const person = new DeliveryPerson({ businessId, name: name.trim(), code });

    // Optional real account: phone + password (Phase B)
    if (phone) {
      const norm = DeliveryPerson.normalizePhone(phone);
      // Phone must be unique among domis so "celular + PIN" login is unambiguous
      const dup = await DeliveryPerson.findOne({ phone: norm });
      if (dup) return res.status(409).json({ message: 'Ya existe un domiciliario con ese celular' });
      person.phone = norm;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      if (!phone) return res.status(400).json({ message: 'Para asignar contraseña, ingresa también el teléfono' });
      await person.setPassword(password);
    }

    await person.save();

    res.status(201).json({ _id: person._id, name: person.name, active: person.active, status: person.status, phone: person.phone, hasAccount: !!person.passwordHash, createdAt: person.createdAt });
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

    if (req.body.name !== undefined) {
      if (!req.body.name.trim()) return res.status(400).json({ message: 'El nombre no puede estar vacío' });
      person.name = req.body.name.trim();
    }
    if (req.body.active !== undefined) person.active = req.body.active;
    if (req.body.code && /^\d{4}$/.test(req.body.code)) {
      // Prevent PIN collisions with another domi of the business
      const hashedCode = crypto.createHash('sha256').update(req.body.code).digest('hex');
      const dupCode = await DeliveryPerson.findOne({ businessId, code: hashedCode, _id: { $ne: person._id } });
      if (dupCode) return res.status(409).json({ message: 'Ya existe un domiciliario con ese código' });
      person.code = req.body.code; // Will be hashed by pre-save hook
    }
    if (req.body.phone !== undefined) {
      const norm = DeliveryPerson.normalizePhone(req.body.phone);
      if (norm) {
        const dup = await DeliveryPerson.findOne({ phone: norm, _id: { $ne: person._id } });
        if (dup) return res.status(409).json({ message: 'Ya existe un domiciliario con ese celular' });
      }
      person.phone = norm || null;
    }
    if (req.body.password) {
      if (req.body.password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
      if (!person.phone) return res.status(400).json({ message: 'Asigna un teléfono antes de la contraseña' });
      await person.setPassword(req.body.password);
      person.refreshTokenHash = null; // invalidate existing sessions on password change
    }

    await person.save();
    res.json({ _id: person._id, name: person.name, active: person.active, status: person.status, phone: person.phone, hasAccount: !!person.passwordHash });
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

      // Shadow: delivery state machine → accepted (manual QR assign)
      try {
        const dsm = require('../services/deliveryStateMachine');
        await dsm.recordForOrder(order, 'assign', { actor: 'admin', assignmentMethod: 'qr' });
      } catch (e) { /* shadow, non-fatal */ }
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

    // Assigning an own-fleet domi supersedes any pending partner offer
    if (order.assignedPartnerId || order.partnerStatus === 'offered') {
      order.assignedPartnerId = null;
      order.partnerStatus = 'none';
      order.partnerOfferExpiresAt = null;
    }

    if (deliveryPersonId && String(order.deliveryPersonId || '') !== String(deliveryPersonId)) {
      // Release the previously assigned domi's load if swapping
      if (order.deliveryPersonId) {
        const { releaseDriver } = require('../services/orderCompletionService');
        await releaseDriver(order.deliveryPersonId, { delivered: false });
      }
      order.deliveryPersonId = deliveryPersonId;
      await DeliveryPerson.findByIdAndUpdate(deliveryPersonId, {
        $set: { status: 'on_delivery' },
        $inc: { activeDeliveries: 1 }
      });
    }

    await order.save();

    // Shadow: delivery state machine → accepted (manual assign to domi)
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'assign', {
        actor: 'admin', assignmentMethod: order.deliveryMode,
        driverId: deliveryPersonId || undefined,
      });
    } catch (e) { /* shadow, non-fatal */ }

    // Native push to the assigned domi (works even with the app closed)
    if (deliveryPersonId) {
      try {
        const driver = await DeliveryPerson.findById(deliveryPersonId).select('fcmToken _id').lean();
        if (driver?.fcmToken) {
          const fcm = require('../services/fcmService');
          await fcm.notifyAssigned(driver, {
            orderId: order._id, orderNumber: order.orderNumber,
            address: order.address, totalAmount: order.finalAmount || order.totalAmount,
          });
        }
      } catch (e) { /* non-critical */ }
    }

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

// ── Pending delivery orders (unassigned, for the admin queue) ─────────────────
router.get('/restaurants/:slug/pending-delivery-orders', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const orders = await Order.find({
      businessId,
      orderType: 'delivery',
      status: { $in: ['confirmed', 'preparing', 'ready'] },
      $or: [{ deliveryPersonId: { $exists: false } }, { deliveryPersonId: null }]
    })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean();
    res.json(orders);
  } catch (err) {
    logger.error('Error fetching pending delivery orders', err);
    res.status(500).json({ message: 'Error al obtener pedidos pendientes' });
  }
});

// ── Delivery settings (assignment mode + partners) ───────────────────────────
router.get('/restaurants/:slug/delivery-settings', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const biz = await BusinessConfig.findById(businessId).select('deliverySettings').lean();
    const settings = biz?.deliverySettings || { assignmentMode: 'manual', usePartners: false, partners: [], maxAssignRadiusKm: 8 };

    // Enrich associated partners with their name/status
    const DeliveryPartner = require('../Models/DeliveryPartner');
    const ids = (settings.partners || []).map(p => p.partnerId).filter(Boolean);
    const partnerDocs = ids.length ? await DeliveryPartner.find({ _id: { $in: ids } }).select('name active logo').lean() : [];
    const pMap = Object.fromEntries(partnerDocs.map(p => [String(p._id), p]));

    res.json({
      ...settings,
      partners: (settings.partners || []).map(p => ({
        ...p,
        name: pMap[String(p.partnerId)]?.name || 'Partner',
        partnerActive: pMap[String(p.partnerId)]?.active ?? false,
      })),
    });
  } catch (err) {
    logger.error('Error fetching delivery settings', err);
    res.status(500).json({ message: 'Error al obtener configuración' });
  }
});

router.put('/restaurants/:slug/delivery-settings', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const { assignmentMode, usePartners, maxAssignRadiusKm, partners, partnerOfferTimeoutMin } = req.body;
    const update = {};
    if (assignmentMode !== undefined) {
      if (!['manual', 'auto_nearest', 'auto_scored'].includes(assignmentMode)) {
        return res.status(400).json({ message: 'Modo de asignación inválido' });
      }
      update['deliverySettings.assignmentMode'] = assignmentMode;
    }
    if (usePartners !== undefined) update['deliverySettings.usePartners'] = !!usePartners;
    if (maxAssignRadiusKm !== undefined) update['deliverySettings.maxAssignRadiusKm'] = Math.max(1, Math.min(50, Number(maxAssignRadiusKm) || 8));
    if (partnerOfferTimeoutMin !== undefined) update['deliverySettings.partnerOfferTimeoutMin'] = Math.max(1, Math.min(120, Number(partnerOfferTimeoutMin) || 10));
    if (Array.isArray(partners)) {
      update['deliverySettings.partners'] = partners
        .filter(p => p.partnerId)
        .map(p => ({ partnerId: p.partnerId, enabled: p.enabled !== false, priority: Number(p.priority) || 1 }));
    }

    await BusinessConfig.updateOne({ _id: businessId }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error updating delivery settings', err);
    res.status(500).json({ message: 'Error al guardar configuración' });
  }
});

// Assign an order to a specific partner company (manual dispatch → offer)
router.post('/restaurants/:slug/orders/:id/assign-partner', tenantAuth, async (req, res) => {
  try {
    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ message: 'partnerId requerido' });

    const businessId = await resolveSlug(req.params.slug);
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (order.orderType !== 'delivery') return res.status(400).json({ message: 'Solo pedidos de delivery' });

    const DeliveryPartner = require('../Models/DeliveryPartner');
    const partner = await DeliveryPartner.findOne({ _id: partnerId, active: true }).lean();
    if (!partner) return res.status(404).json({ message: 'Empresa no encontrada o inactiva' });

    // Admin dispatch overrides a previous rejection/timeout by this partner
    order.rejectedPartnerIds = (order.rejectedPartnerIds || []).filter(id => String(id) !== String(partner._id));
    // Release the previously assigned domi's load if any
    if (order.deliveryPersonId) {
      const { releaseDriver } = require('../services/orderCompletionService');
      await releaseDriver(order.deliveryPersonId, { delivered: false });
    }
    const biz = await BusinessConfig.findById(businessId).select('deliverySettings').lean();
    const timeoutMin = biz?.deliverySettings?.partnerOfferTimeoutMin || 10;
    order.assignedPartnerId = partner._id;
    order.partnerStatus = 'offered';
    order.partnerOfferedAt = new Date();
    order.partnerOfferExpiresAt = new Date(Date.now() + timeoutMin * 60 * 1000);
    order.assignmentMethod = 'partner';
    order.deliveryPersonId = null;
    if (!order.confirmationCode) order.confirmationCode = generateConfirmationCode();
    order.status = 'inProgress';
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: 'inProgress', timestamp: new Date(), note: `Ofrecido a empresa ${partner.name}` });
    await order.save();

    // Notify the partner portal (realtime) + shadow state machine
    try {
      socketService.emitToPartner(String(partner._id), 'partner:new_offer', {
        orderId: String(order._id), orderNumber: order.orderNumber, businessId: String(order.businessId),
      });
      socketService.emitToBusiness(String(order.businessId), 'orderUpdated', order.toObject());
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'offer', {
        actor: 'admin', partnerId: partner._id, assignmentMethod: 'partner',
        meta: { partnerName: partner.name, manual: true },
      });
    } catch (e) { /* non-critical */ }

    res.json({ ok: true, partnerName: partner.name, confirmationCode: order.confirmationCode });
  } catch (err) {
    logger.error('Error assigning order to partner', err);
    res.status(500).json({ message: 'Error al asignar a la empresa' });
  }
});

// List all active partner companies available to associate
router.get('/restaurants/:slug/available-partners', tenantAuth, async (req, res) => {
  try {
    const DeliveryPartner = require('../Models/DeliveryPartner');
    const partners = await DeliveryPartner.find({ active: true }).select('name phone logo coverageAreas').sort({ name: 1 }).lean();
    res.json(partners);
  } catch (err) {
    logger.error('Error listing available partners', err);
    res.status(500).json({ message: 'Error al obtener partners' });
  }
});

// Trigger auto-assignment for a specific order
router.post('/restaurants/:slug/orders/:id/auto-assign', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveSlug(req.params.slug);
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    const business = await BusinessConfig.findById(businessId).lean();
    const assignmentService = require('../services/assignmentService');
    const result = await assignmentService.autoAssignOrder(order, business);

    if (result.assigned) {
      return res.json({ ok: true, assigned: true, driverName: result.driver?.name, method: result.method, distanceKm: result.distanceKm });
    }
    if (result.offered) {
      return res.json({
        ok: true, assigned: false, offered: true,
        driverName: result.driver?.name, partnerName: result.partner?.name,
        distanceKm: result.distanceKm,
      });
    }
    return res.json({ ok: false, assigned: false, reason: result.reason || 'no_driver_available' });
  } catch (err) {
    logger.error('Error auto-assigning order', err);
    res.status(500).json({ message: 'Error en asignación automática' });
  }
});

// ── Delivery timeline (state machine + immutable event log) for audit ────────
router.get('/restaurants/:slug/orders/:id/timeline', tenantAuth, async (req, res) => {
  try {
    const Delivery = require('../Models/Delivery');
    const DeliveryEvent = require('../Models/DeliveryEvent');

    const businessId = await resolveSlug(req.params.slug);
    const delivery = await Delivery.findOne({ orderId: req.params.id, businessId }).lean();
    if (!delivery) {
      return res.json({ delivery: null, events: [] });
    }

    const events = await DeliveryEvent.find({ deliveryId: delivery._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ delivery, events });
  } catch (err) {
    logger.error('Error fetching delivery timeline', err);
    res.status(500).json({ message: 'Error al obtener la línea de tiempo' });
  }
});

module.exports = router;
