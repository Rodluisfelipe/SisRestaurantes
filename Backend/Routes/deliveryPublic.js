const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const DeliveryPerson = require('../Models/DeliveryPerson');
const DeliverySession = require('../Models/DeliverySession');
const BusinessConfig = require('../Models/BusinessConfig');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

const deliveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Demasiadas solicitudes. Intente de nuevo más tarde.' }
});

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Demasiados intentos. Intente de nuevo más tarde.' }
});

// Helper: resolve slug to businessId
async function resolveSlug(slug) {
  const business = await BusinessConfig.findOne({ slug }).select('_id slug businessName phone logo theme').lean();
  if (!business) throw new Error('Negocio no encontrado');
  return business;
}

// Generate a short-lived JWT for domi session (12 hours)
function generateDomiToken(deliveryPersonId, businessId, mode) {
  return jwt.sign(
    { dpId: deliveryPersonId, businessId: businessId.toString(), mode },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// Verify domi JWT
function verifyDomiToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Middleware: authenticate domi
function domiAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado' });
  }
  const decoded = verifyDomiToken(authHeader.split(' ')[1]);
  if (!decoded || !decoded.dpId) {
    return res.status(401).json({ message: 'Sesión expirada' });
  }
  req.domi = decoded;
  next();
}

// ============================================
// MODE 1 — QR Token (Public, no auth)
// ============================================

// GET /api/delivery/:token — Public page for QR domiciliario
router.get('/:token', deliveryLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const order = await Order.findOne({ deliveryToken: token }).lean();

    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado o token inválido' });
    }

    if (new Date() > new Date(order.deliveryTokenExpiresAt)) {
      return res.status(410).json({ message: 'Este enlace ha expirado' });
    }

    if (order.status === 'delivered' || order.status === 'completed') {
      return res.status(410).json({ message: 'Este pedido ya fue entregado' });
    }

    // Get business info for the page
    const business = await BusinessConfig.findById(order.businessId).select('slug businessName phone logo theme').lean();

    // Return order info for the domi page (NEVER include confirmationCode)
    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      address: order.address,
      deliveryCoordinates: order.deliveryCoordinates,
      customer: {
        name: order.customerName,
        phone: order.phone
      },
      items: order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        selectedToppings: i.selectedToppings
      })),
      total: order.finalAmount || order.totalAmount,
      deliveryFee: order.deliveryFee || 0,
      business: {
        name: business?.businessName,
        phone: business?.phone,
        slug: business?.slug,
        logo: business?.logo || null,
        buttonColor: business?.theme?.buttonColor || '#2563eb',
        buttonTextColor: business?.theme?.buttonTextColor || '#ffffff'
      },
      status: order.status,
      deliveryAssignedAt: order.deliveryAssignedAt,
      deliveryPickedAt: order.deliveryPickedAt || null
    });
  } catch (error) {
    logger.error('Error fetching delivery by token', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/delivery/:token/confirm — Domi confirms delivery with 4-digit code
router.post('/:token/confirm', confirmLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const { code } = req.body;

    if (!code || code.length !== 4) {
      return res.status(400).json({ message: 'Código de 4 dígitos requerido' });
    }

    const order = await Order.findOne({ deliveryToken: token });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (new Date() > new Date(order.deliveryTokenExpiresAt)) {
      return res.status(410).json({ message: 'Este enlace ha expirado' });
    }

    if (order.confirmationAttempts >= 3) {
      return res.status(423).json({ message: 'Código bloqueado por demasiados intentos. Contacte al restaurante.' });
    }

    if (order.confirmationCode !== code) {
      order.confirmationAttempts += 1;
      await order.save();

      if (order.confirmationAttempts >= 3) {
        // Emit blocked alert to dashboard
        socketService.emitToBusiness(order.businessId, 'delivery:blocked', {
          orderId: order._id,
          reason: 'max_attempts'
        });
        return res.status(423).json({ message: 'Código bloqueado. Se ha notificado al restaurante.' });
      }

      return res.status(400).json({
        message: 'Código incorrecto',
        attemptsRemaining: 3 - order.confirmationAttempts
      });
    }

    // Code correct — mark as delivered
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.trackingEnabled = false;
    order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: 'Entregado (código confirmado)' });
    await order.save();

    // Notify dashboard and tracking page
    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToBusiness(order.businessId, 'delivery:confirmed', {
      orderId: order._id,
      deliveredAt: order.deliveredAt
    });
    socketService.emitToOrder(order._id, 'order:status', { status: 'delivered', updatedAt: order.deliveredAt });
    socketService.emitToOrder(order._id, 'delivery:confirmed', { deliveredAt: order.deliveredAt });

    res.json({ message: 'Entrega confirmada exitosamente', deliveredAt: order.deliveredAt });
  } catch (error) {
    logger.error('Error confirming delivery', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/delivery/:token/picked — Domi marks order as picked up
router.post('/:token/picked', deliveryLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const order = await Order.findOne({ deliveryToken: token });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    order.deliveryPickedAt = new Date();
    order.trackingEnabled = true;
    await order.save();

    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToOrder(order._id, 'order:status', { status: order.status, updatedAt: new Date(), pickedAt: order.deliveryPickedAt });

    res.json({ message: 'Pedido recogido', deliveryPickedAt: order.deliveryPickedAt });
  } catch (error) {
    logger.error('Error marking as picked', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ============================================
// MODES 2 & 3 — Domi fixed / profile auth
// ============================================

// POST /api/restaurants/:slug/domi/auth — Authenticate domiciliario
router.post('/:slug/domi/auth', deliveryLimiter, async (req, res) => {
  try {
    const business = await resolveSlug(req.params.slug);
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Código requerido' });
    }

    // Try Mode 3 first: profile-based auth (4-digit code)
    if (/^\d{4}$/.test(code)) {
      const person = await DeliveryPerson.findByCode(business._id, code);
      if (person) {
        const token = generateDomiToken(person._id.toString(), business._id, 'profile');
        return res.json({
          mode: 'profile',
          token,
          name: person.name,
          deliveryPersonId: person._id,
          businessName: business.businessName,
          slug: business.slug
        });
      }
    }

    // Try Mode 2: daily session code
    const today = new Date().toISOString().slice(0, 10);
    const session = await DeliverySession.findOne({
      businessId: business._id,
      validDate: today,
      dailyCode: code.toUpperCase(),
      active: true
    });

    if (session) {
      const token = generateDomiToken('daily-' + session._id.toString(), business._id, 'fixed');
      return res.json({
        mode: 'fixed',
        token,
        name: 'Domiciliario del día',
        businessName: business.businessName,
        slug: business.slug
      });
    }

    return res.status(401).json({ message: 'Código inválido' });
  } catch (error) {
    logger.error('Error in domi auth', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/restaurants/:slug/domi/orders — Get assigned orders for domi
router.get('/:slug/domi/orders', domiAuth, async (req, res) => {
  try {
    const { dpId, businessId, mode } = req.domi;

    const filter = {
      businessId,
      orderType: 'delivery',
      status: { $in: ['inProgress'] },
      deliveryMode: { $ne: null }
    };

    if (mode === 'profile') {
      filter.deliveryPersonId = dpId;
    }
    // Mode 'fixed': show all delivery orders assigned to fixed mode

    const orders = await Order.find(filter).sort({ deliveryAssignedAt: -1 }).lean();

    // Never expose confirmation code to domi
    const safe = orders.map(o => ({
      ...o,
      confirmationCode: undefined
    }));

    res.json(safe);
  } catch (error) {
    logger.error('Error fetching domi orders', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/restaurants/:slug/domi/orders/:id/confirm — Domi confirms with code
router.post('/:slug/domi/orders/:id/confirm', confirmLimiter, domiAuth, async (req, res) => {
  try {
    const { businessId } = req.domi;
    const { code } = req.body;

    if (!code || code.length !== 4) {
      return res.status(400).json({ message: 'Código de 4 dígitos requerido' });
    }

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    if (order.confirmationAttempts >= 3) {
      return res.status(423).json({ message: 'Código bloqueado. Contacte al restaurante.' });
    }

    if (order.confirmationCode !== code) {
      order.confirmationAttempts += 1;
      await order.save();

      if (order.confirmationAttempts >= 3) {
        socketService.emitToBusiness(order.businessId, 'delivery:blocked', {
          orderId: order._id,
          reason: 'max_attempts'
        });
        return res.status(423).json({ message: 'Código bloqueado. Se ha notificado al restaurante.' });
      }

      return res.status(400).json({
        message: 'Código incorrecto',
        attemptsRemaining: 3 - order.confirmationAttempts
      });
    }

    // Correct — mark delivered
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.trackingEnabled = false;
    order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: 'Entregado (código confirmado)' });
    await order.save();

    // Update delivery person status back to available
    if (order.deliveryPersonId) {
      const remainingOrders = await Order.countDocuments({
        deliveryPersonId: order.deliveryPersonId,
        status: 'inProgress'
      });
      if (remainingOrders === 0) {
        await DeliveryPerson.findByIdAndUpdate(order.deliveryPersonId, { status: 'available' });
        socketService.emitToBusiness(order.businessId, 'domi:status', {
          deliveryPersonId: order.deliveryPersonId,
          status: 'available'
        });
      }
    }

    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToBusiness(order.businessId, 'delivery:confirmed', {
      orderId: order._id,
      deliveryPersonId: order.deliveryPersonId,
      deliveredAt: order.deliveredAt
    });
    socketService.emitToOrder(order._id, 'order:status', { status: 'delivered', updatedAt: order.deliveredAt });
    socketService.emitToOrder(order._id, 'delivery:confirmed', { deliveredAt: order.deliveredAt });

    res.json({ message: 'Entrega confirmada exitosamente', deliveredAt: order.deliveredAt });
  } catch (error) {
    logger.error('Error confirming domi delivery', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/restaurants/:slug/domi/orders/:id/picked — Domi picks up order
router.post('/:slug/domi/orders/:id/picked', deliveryLimiter, domiAuth, async (req, res) => {
  try {
    const { businessId } = req.domi;
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    order.deliveryPickedAt = new Date();
    order.trackingEnabled = true;
    await order.save();

    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToOrder(order._id, 'order:status', { status: order.status, updatedAt: new Date(), pickedAt: order.deliveryPickedAt });

    res.json({ message: 'Pedido recogido', deliveryPickedAt: order.deliveryPickedAt });
  } catch (error) {
    logger.error('Error marking as picked', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ============================================
// PUBLIC TRACKING — Client order tracking
// ============================================

// GET /api/restaurants/:slug/track/:orderId
router.get('/:slug/track/:orderId', deliveryLimiter, async (req, res) => {
  try {
    const business = await resolveSlug(req.params.slug);
    const order = await Order.findOne({ _id: req.params.orderId, businessId: business._id })
      .select('orderNumber status statusHistory deliveryAssignedAt deliveryPickedAt deliveredAt deliveryPersonId trackingEnabled orderType customerName items totalAmount finalAmount deliveryFee')
      .lean();

    if (!order) {
      // Check completed orders
      const completed = await CompletedOrder.findOne({ _id: req.params.orderId, businessId: business._id })
        .select('orderNumber status deliveredAt orderType customerName items totalAmount finalAmount deliveryFee')
        .lean();
      if (!completed) return res.status(404).json({ message: 'Pedido no encontrado' });
      return res.json({
        ...completed,
        business: { name: business.businessName, phone: business.phone, slug: business.slug, logo: business.logo || null, buttonColor: business.theme?.buttonColor || '#2563eb', buttonTextColor: business.theme?.buttonTextColor || '#ffffff' },
        trackingEnabled: false
      });
    }

    // Get delivery person name if assigned
    let deliveryPersonName = null;
    if (order.deliveryPersonId) {
      const dp = await DeliveryPerson.findById(order.deliveryPersonId).select('name').lean();
      if (dp) deliveryPersonName = dp.name;
    }

    // Don't expose sensitive details — no address, no phone
    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      deliveryAssignedAt: order.deliveryAssignedAt,
      deliveryPickedAt: order.deliveryPickedAt,
      deliveredAt: order.deliveredAt,
      trackingEnabled: order.trackingEnabled,
      deliveryPersonName,
      items: order.items.map(i => ({ name: i.name, quantity: i.quantity })),
      total: order.finalAmount || order.totalAmount,
      deliveryFee: order.deliveryFee || 0,
      business: { name: business.businessName, phone: business.phone, slug: business.slug, logo: business.logo || null, buttonColor: business.theme?.buttonColor || '#2563eb', buttonTextColor: business.theme?.buttonTextColor || '#ffffff' }
    });
  } catch (error) {
    logger.error('Error fetching tracking info', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
