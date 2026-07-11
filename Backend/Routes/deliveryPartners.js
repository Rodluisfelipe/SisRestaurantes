const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const DeliveryPartner = require('../Models/DeliveryPartner');
const DeliveryPerson = require('../Models/DeliveryPerson');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const socketService = require('../services/socketService');
const { protectSuperAdmin, requireRole } = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Demasiados intentos. Intenta más tarde.' } });

/* ═══════════════════════ PARTNER JWT AUTH ═══════════════════════ */

function generatePartnerToken(partnerId) {
  return jwt.sign({ partnerId: partnerId.toString(), kind: 'partner' }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

async function partnerAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ message: 'No autorizado' });
  try {
    const dec = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (dec.kind !== 'partner' || !dec.partnerId) return res.status(401).json({ message: 'Sesión inválida' });
    const partner = await DeliveryPartner.findById(dec.partnerId);
    if (!partner || !partner.active) return res.status(401).json({ message: 'Cuenta inactiva' });
    req.partner = partner;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión expirada' });
  }
}

/* ═══════════════════════ SUPERADMIN CRUD ═══════════════════════ */
// Mounted under /api/delivery-partners; superadmin routes are under /admin/*

router.get('/admin/list', protectSuperAdmin, async (req, res) => {
  try {
    const partners = await DeliveryPartner.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
    res.json(partners);
  } catch (err) {
    logger.error('Error listing partners', err);
    res.status(500).json({ message: 'Error al listar partners' });
  }
});

router.post('/admin/create', protectSuperAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, commissionType, commissionValue, coverageAreas } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });

    const exists = await DeliveryPartner.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Ya existe un partner con ese email' });

    const partner = new DeliveryPartner({
      name, email: email.toLowerCase(), phone: phone || '',
      commissionType: commissionType || 'percent',
      commissionValue: commissionValue || 0,
      coverageAreas: Array.isArray(coverageAreas) ? coverageAreas : [],
    });
    await partner.setPassword(password);
    await partner.save();

    const obj = partner.toObject();
    delete obj.passwordHash;
    res.status(201).json(obj);
  } catch (err) {
    logger.error('Error creating partner', err);
    res.status(500).json({ message: 'Error al crear partner' });
  }
});

router.patch('/admin/:id', protectSuperAdmin, requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, active, commissionType, commissionValue, coverageAreas, password } = req.body;
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner no encontrado' });

    if (name !== undefined) partner.name = name;
    if (phone !== undefined) partner.phone = phone;
    if (active !== undefined) partner.active = active;
    if (commissionType !== undefined) partner.commissionType = commissionType;
    if (commissionValue !== undefined) partner.commissionValue = commissionValue;
    if (coverageAreas !== undefined) partner.coverageAreas = coverageAreas;
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Contraseña muy corta' });
      await partner.setPassword(password);
    }
    await partner.save();

    const obj = partner.toObject();
    delete obj.passwordHash;
    res.json(obj);
  } catch (err) {
    logger.error('Error updating partner', err);
    res.status(500).json({ message: 'Error al actualizar partner' });
  }
});

/* ═══════════════════════ PARTNER PORTAL AUTH ═══════════════════════ */

router.post('/portal/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });
    const partner = await DeliveryPartner.findOne({ email: email.toLowerCase() });
    if (!partner || !partner.active) return res.status(401).json({ message: 'Credenciales inválidas' });
    const ok = await partner.verifyPassword(password);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    res.json({
      token: generatePartnerToken(partner._id),
      partner: { id: partner._id, name: partner.name, email: partner.email, logo: partner.logo },
    });
  } catch (err) {
    logger.error('Partner login error', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

router.get('/portal/me', partnerAuth, (req, res) => {
  const p = req.partner;
  res.json({ id: p._id, name: p.name, email: p.email, phone: p.phone, logo: p.logo, totalDeliveries: p.totalDeliveries, rating: p.rating });
});

/* ═══════════════════════ PARTNER PORTAL — ORDERS ═══════════════════════ */

// Orders offered to this partner + orders they've accepted (active)
router.get('/portal/orders', partnerAuth, async (req, res) => {
  try {
    const orders = await Order.find({
      assignedPartnerId: req.partner._id,
      partnerStatus: { $in: ['offered', 'accepted'] },
      status: { $nin: ['delivered', 'cancelled', 'completed'] },
    })
      .sort({ partnerOfferedAt: -1 })
      .limit(50)
      .lean();

    // attach business name for display
    const bizIds = [...new Set(orders.map(o => String(o.businessId)))];
    const bizs = await BusinessConfig.find({ _id: { $in: bizIds } }).select('businessName slug phone').lean();
    const bizMap = Object.fromEntries(bizs.map(b => [String(b._id), b]));

    res.json(orders.map(o => ({
      ...o,
      business: bizMap[String(o.businessId)] || null,
    })));
  } catch (err) {
    logger.error('Error listing partner orders', err);
    res.status(500).json({ message: 'Error al obtener pedidos' });
  }
});

// Accept an offered order
router.post('/portal/orders/:id/accept', partnerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedPartnerId: req.partner._id });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (order.partnerStatus !== 'offered') return res.status(409).json({ message: 'El pedido ya no está disponible' });

    order.partnerStatus = 'accepted';
    order.deliveryAssignedAt = new Date();
    if (!order.confirmationCode) order.confirmationCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Optionally assign to one of the partner's own drivers
    let assignedDriver = null;
    if (req.body.driverId) {
      assignedDriver = await DeliveryPerson.findOne({ _id: req.body.driverId, partnerId: req.partner._id });
      if (assignedDriver) {
        order.deliveryPersonId = assignedDriver._id;
        await DeliveryPerson.updateOne({ _id: assignedDriver._id }, { $set: { status: 'on_delivery' } });
      }
    }
    await order.save();

    // Shadow: delivery state machine → accepted (partner accepts)
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'accept', {
        actor: 'partner', actorId: req.partner._id, actorName: req.partner.name,
        partnerId: req.partner._id, assignmentMethod: 'partner',
      });
    } catch (e) { /* shadow, non-fatal */ }

    // Notify restaurant
    socketService.emitToBusiness(String(order.businessId), 'delivery:assigned', {
      orderId: String(order._id), partnerId: String(req.partner._id), partnerName: req.partner.name,
    });

    res.json({ ok: true, order });
  } catch (err) {
    logger.error('Error accepting order', err);
    res.status(500).json({ message: 'Error al aceptar pedido' });
  }
});

// Reject an offered order → re-offer to next partner or back to manual
router.post('/portal/orders/:id/reject', partnerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedPartnerId: req.partner._id });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    order.partnerStatus = 'rejected';
    order.assignedPartnerId = null;
    await order.save();

    // Try to offer to the next partner in priority order
    const business = await BusinessConfig.findById(order.businessId).lean();
    if (business?.deliverySettings?.usePartners) {
      const assignmentService = require('../services/assignmentService');
      // Exclude the rejecting partner by temporarily filtering
      const remaining = (business.deliverySettings.partners || [])
        .filter(p => p.enabled && String(p.partnerId) !== String(req.partner._id));
      const nextBusiness = { ...business, deliverySettings: { ...business.deliverySettings, partners: remaining } };
      const orderDoc = await Order.findById(order._id);
      await assignmentService.offerToPartner(orderDoc, nextBusiness);
    }

    // Notify restaurant so they can act manually if needed
    socketService.emitToBusiness(String(order.businessId), 'delivery:partner_rejected', {
      orderId: String(order._id), partnerId: String(req.partner._id),
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('Error rejecting order', err);
    res.status(500).json({ message: 'Error al rechazar pedido' });
  }
});

// Mark accepted order as delivered
router.post('/portal/orders/:id/deliver', partnerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, assignedPartnerId: req.partner._id, partnerStatus: 'accepted' });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: `Entregado por partner ${req.partner.name}` });
    await order.save();

    // Shadow: delivery state machine → delivered (partner delivers)
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'deliver', {
        actor: 'partner', actorId: req.partner._id, actorName: req.partner.name,
        partnerId: req.partner._id, assignmentMethod: 'partner',
      });
    } catch (e) { /* shadow, non-fatal */ }

    await DeliveryPartner.updateOne({ _id: req.partner._id }, { $inc: { totalDeliveries: 1 } });

    socketService.emitToBusiness(String(order.businessId), 'delivery:confirmed', { orderId: String(order._id) });
    socketService.emitToOrder(String(order._id), 'order:status', { status: 'delivered' });

    res.json({ ok: true });
  } catch (err) {
    logger.error('Error delivering partner order', err);
    res.status(500).json({ message: 'Error al marcar entregado' });
  }
});

/* ═══════════════════════ PARTNER PORTAL — SUS REPARTIDORES ═══════════════════════ */

// List the partner's own drivers
router.get('/portal/drivers', partnerAuth, async (req, res) => {
  try {
    const drivers = await DeliveryPerson.find({ partnerId: req.partner._id })
      .select('name phone active status totalDeliveries createdAt')
      .sort({ createdAt: -1 }).lean();
    res.json(drivers);
  } catch (err) {
    logger.error('Error listing partner drivers', err);
    res.status(500).json({ message: 'Error al obtener repartidores' });
  }
});

// Register a driver for the partner company
router.post('/portal/drivers', partnerAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Nombre requerido' });
    const code = Math.floor(1000 + Math.random() * 9000).toString(); // auto-generado (no se usa como login por ahora)
    const driver = new DeliveryPerson({
      partnerId: req.partner._id,
      name: name.trim(),
      phone: (phone || '').replace(/\D/g, '') || null,
      code,
      active: true,
    });
    await driver.save();
    res.status(201).json({ _id: driver._id, name: driver.name, phone: driver.phone, active: driver.active, status: driver.status, totalDeliveries: 0 });
  } catch (err) {
    logger.error('Error creating partner driver', err);
    res.status(500).json({ message: 'Error al crear repartidor' });
  }
});

// Update / deactivate a partner driver
router.patch('/portal/drivers/:id', partnerAuth, async (req, res) => {
  try {
    const driver = await DeliveryPerson.findOne({ _id: req.params.id, partnerId: req.partner._id });
    if (!driver) return res.status(404).json({ message: 'Repartidor no encontrado' });
    if (req.body.name !== undefined) driver.name = req.body.name.trim();
    if (req.body.phone !== undefined) driver.phone = (req.body.phone || '').replace(/\D/g, '') || null;
    if (req.body.active !== undefined) driver.active = req.body.active;
    await driver.save();
    res.json({ _id: driver._id, name: driver.name, phone: driver.phone, active: driver.active, status: driver.status });
  } catch (err) {
    logger.error('Error updating partner driver', err);
    res.status(500).json({ message: 'Error al actualizar repartidor' });
  }
});

module.exports = router;
