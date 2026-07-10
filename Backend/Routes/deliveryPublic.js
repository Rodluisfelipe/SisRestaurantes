const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
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
    const business = await BusinessConfig.findById(order.businessId).select('slug businessName phone logo theme requireDeliveryCode').lean();

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
      requireConfirmationCode: business?.requireDeliveryCode !== false,
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
    const { code, skipCode } = req.body;

    const order = await Order.findOne({ deliveryToken: token });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (new Date() > new Date(order.deliveryTokenExpiresAt)) {
      return res.status(410).json({ message: 'Este enlace ha expirado' });
    }

    // Check if business requires confirmation code
    const business = await BusinessConfig.findById(order.businessId).select('requireDeliveryCode').lean();
    const requireCode = business?.requireDeliveryCode !== false;

    if (requireCode) {
      // Code validation required
      if (!code || code.length !== 4) {
        return res.status(400).json({ message: 'Código de 4 dígitos requerido' });
      }

      if (order.confirmationAttempts >= 3) {
        return res.status(423).json({ message: 'Código bloqueado por demasiados intentos. Contacte al restaurante.' });
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
    }

    // Code correct or not required — mark as delivered
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.trackingEnabled = false;
    order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: requireCode ? 'Entregado (código confirmado)' : 'Entregado (sin código)' });
    await order.save();

    // Shadow: delivery state machine → delivered (Mode 1 / QR)
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'deliver', { actor: 'driver', assignmentMethod: 'qr', meta: { codeUsed: requireCode } });
    } catch (e) { /* shadow, non-fatal */ }

    // Update delivery person: increment totalDeliveries and set status back to available
    if (order.deliveryPersonId) {
      try {
        await DeliveryPerson.findByIdAndUpdate(order.deliveryPersonId, {
          $inc: { totalDeliveries: 1 },
          $set: { status: 'available' }
        });
      } catch (dpErr) {
        logger.warn('Failed to update delivery person after confirm', { error: dpErr.message, dpId: order.deliveryPersonId });
      }
    }

    // Notify dashboard and tracking page
    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToBusiness(order.businessId, 'delivery:confirmed', {
      orderId: order._id,
      deliveredAt: order.deliveredAt
    });
    socketService.emitToOrder(order._id, 'order:status', { status: 'delivered', updatedAt: order.deliveredAt });
    socketService.emitToOrder(order._id, 'delivery:confirmed', { deliveredAt: order.deliveredAt });

    // Move order to CompletedOrder collection
    try {
      const orderData = order.toObject();

      // Delete payment proof file if exists
      if (orderData.paymentProof) {
        try {
          const path = require('path');
          const fs = require('fs');
          const proofFilePath = path.join(__dirname, '..', orderData.paymentProof);
          if (fs.existsSync(proofFilePath)) {
            fs.unlinkSync(proofFilePath);
          }
        } catch (fileErr) {
          logger.warn('Could not delete payment proof file', { error: fileErr.message });
        }
      }

      const completedOrder = new CompletedOrder({
        ...orderData,
        paymentProof: null,
        completedAt: new Date(),
        status: 'completed'
      });

      const session = await mongoose.startSession();
      let moveSucceeded = false;
      try {
        await session.withTransaction(async () => {
          await completedOrder.save({ session });
          await Order.findByIdAndDelete(order._id, { session });
        });
        moveSucceeded = true;
      } catch (txErr) {
        logger.error('Transaction failed for delivery completion — order preserved in active', { error: txErr.message, orderId: order._id });
      } finally {
        session.endSession();
      }

      if (moveSucceeded) {
        setTimeout(() => {
          socketService.emitToBusiness(order.businessId.toString(), 'order_deleted', { _id: order._id });
        }, 3000);
      }
    } catch (moveErr) {
      logger.error('Error moving delivered order to completed', { error: moveErr.message, orderId: order._id });
    }

    // Register in cash register if one is open
    if (order.orderChannel !== 'pos') {
      try {
        const CashRegister = require('../Models/CashRegister');
        await CashRegister.findOneAndUpdate(
          { businessId: order.businessId, status: 'open' },
          { $push: { movements: {
            type: 'sale',
            amount: order.finalAmount || order.totalAmount,
            paymentMethod: order.paymentMethod || 'cash',
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderChannel: 'menuby',
            description: `MenuBy #${order.orderNumber} - ${order.customerName}`,
            createdAt: new Date()
          }}}
        );
      } catch (cashErr) {
        logger.warn('Failed to register delivery sale in cash register', { error: cashErr.message });
      }
    }

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

    // Shadow: delivery state machine → picked_up
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'pickup', { actor: 'driver', assignmentMethod: 'qr' });
    } catch (e) { /* shadow, non-fatal */ }

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

// ── Phase B: password-based driver accounts ──────────────────────────────────
function generateDomiRefresh(dpId) {
  return jwt.sign({ dpId: dpId.toString(), type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/delivery/domi/login — phone + password (no slug needed)
router.post('/domi/login', deliveryLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'Teléfono y contraseña requeridos' });

    const norm = DeliveryPerson.normalizePhone(phone);
    const person = await DeliveryPerson.findOne({ phone: norm, active: true, passwordHash: { $ne: null } });
    if (!person) return res.status(401).json({ message: 'Teléfono o contraseña incorrectos' });

    const ok = await person.verifyPassword(password);
    if (!ok) return res.status(401).json({ message: 'Teléfono o contraseña incorrectos' });

    const business = await BusinessConfig.findById(person.businessId).select('slug businessName').lean();
    const token = generateDomiToken(person._id.toString(), person.businessId, 'profile');
    const refreshToken = generateDomiRefresh(person._id);
    person.refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await person.save();

    res.json({
      mode: 'profile', token, refreshToken,
      name: person.name, deliveryPersonId: person._id,
      businessId: person.businessId, businessName: business?.businessName, slug: business?.slug,
    });
  } catch (err) {
    logger.error('Error in domi login', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/delivery/domi/refresh — rotate access token with a refresh token
router.post('/domi/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'refreshToken requerido' });

    let dec;
    try { dec = jwt.verify(refreshToken, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ message: 'Sesión expirada' }); }
    if (dec.type !== 'refresh' || !dec.dpId) return res.status(401).json({ message: 'Token inválido' });

    const person = await DeliveryPerson.findById(dec.dpId);
    if (!person || !person.active) return res.status(401).json({ message: 'Cuenta inactiva' });

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (person.refreshTokenHash !== hash) return res.status(401).json({ message: 'Sesión revocada' });

    // Rotate refresh token
    const newRefresh = generateDomiRefresh(person._id);
    person.refreshTokenHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    await person.save();

    const token = generateDomiToken(person._id.toString(), person.businessId, 'profile');
    res.json({ token, refreshToken: newRefresh });
  } catch (err) {
    logger.error('Error in domi refresh', err);
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
    const business = await BusinessConfig.findById(businessId).select('requireDeliveryCode').lean();
    const requireCode = business?.requireDeliveryCode !== false;
    const safe = orders.map(o => ({
      ...o,
      confirmationCode: undefined,
      requireConfirmationCode: requireCode
    }));

    res.json(safe);
  } catch (error) {
    logger.error('Error fetching domi orders', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ── Phase C: offer lifecycle (accept / reject) ───────────────────────────────
// GET /api/restaurants/:slug/domi/offers — pending offers for this driver
router.get('/:slug/domi/offers', domiAuth, async (req, res) => {
  try {
    const { dpId } = req.domi;
    if (!dpId || String(dpId).startsWith('daily-')) return res.json([]);
    const DeliveryOffer = require('../Models/DeliveryOffer');
    const offers = await DeliveryOffer.find({ driverId: dpId, state: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ offeredAt: -1 }).lean();
    const enriched = await Promise.all(offers.map(async (o) => {
      const order = await Order.findById(o.orderId)
        .select('orderNumber customerName address totalAmount items deliveryCoordinates').lean();
      return { ...o, order };
    }));
    res.json(enriched);
  } catch (err) {
    logger.error('Error fetching domi offers', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/restaurants/:slug/domi/offers/:id/accept
router.post('/:slug/domi/offers/:id/accept', domiAuth, async (req, res) => {
  try {
    const { dpId } = req.domi;
    const DeliveryOffer = require('../Models/DeliveryOffer');
    const DeliveryPerson = require('../Models/DeliveryPerson');
    const offer = await DeliveryOffer.findOne({ _id: req.params.id, driverId: dpId });
    if (!offer) return res.status(404).json({ message: 'Oferta no encontrada' });
    const driver = await DeliveryPerson.findById(dpId);
    if (!driver) return res.status(404).json({ message: 'Domiciliario no encontrado' });

    const assignmentService = require('../services/assignmentService');
    const result = await assignmentService.acceptOffer(offer, driver);
    if (!result.ok) {
      const msg = result.reason === 'expired' ? 'La oferta expiró'
        : result.reason === 'already_assigned' ? 'El pedido ya fue tomado'
        : 'La oferta ya no está disponible';
      return res.status(409).json({ message: msg, reason: result.reason });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error accepting offer', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/restaurants/:slug/domi/offers/:id/reject
router.post('/:slug/domi/offers/:id/reject', domiAuth, async (req, res) => {
  try {
    const { dpId } = req.domi;
    const DeliveryOffer = require('../Models/DeliveryOffer');
    const offer = await DeliveryOffer.findOne({ _id: req.params.id, driverId: dpId });
    if (!offer) return res.status(404).json({ message: 'Oferta no encontrada' });
    const assignmentService = require('../services/assignmentService');
    await assignmentService.rejectOffer(offer);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error rejecting offer', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/restaurants/:slug/domi/orders/:id/confirm — Domi confirms with code
router.post('/:slug/domi/orders/:id/confirm', confirmLimiter, domiAuth, async (req, res) => {
  try {
    const { businessId } = req.domi;
    const { code } = req.body;

    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    // Check if business requires confirmation code
    const business = await BusinessConfig.findById(businessId).select('requireDeliveryCode').lean();
    const requireCode = business?.requireDeliveryCode !== false;

    if (requireCode) {
      if (!code || code.length !== 4) {
        return res.status(400).json({ message: 'Código de 4 dígitos requerido' });
      }

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
    }

    // Correct or not required — mark delivered
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.trackingEnabled = false;
    order.statusHistory.push({ status: 'delivered', timestamp: new Date(), note: requireCode ? 'Entregado (código confirmado)' : 'Entregado (sin código)' });
    await order.save();

    // Shadow: delivery state machine → delivered (Mode 2/3, authenticated)
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'deliver', {
        actor: 'driver', actorId: req.domi?.dpId && !String(req.domi.dpId).startsWith('daily-') ? req.domi.dpId : null,
        assignmentMethod: req.domi?.mode, meta: { codeUsed: requireCode },
      });
    } catch (e) { /* shadow, non-fatal */ }

    // Update delivery person: increment totalDeliveries and set status back to available
    if (order.deliveryPersonId) {
      try {
        await DeliveryPerson.findByIdAndUpdate(order.deliveryPersonId, {
          $inc: { totalDeliveries: 1 },
          $set: { status: 'available' }
        });
        socketService.emitToBusiness(order.businessId, 'domi:status', {
          deliveryPersonId: order.deliveryPersonId,
          status: 'available'
        });
      } catch (dpErr) {
        logger.warn('Failed to update delivery person after confirm', { error: dpErr.message, dpId: order.deliveryPersonId });
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

    // Move order to CompletedOrder collection
    try {
      const orderData = order.toObject();

      if (orderData.paymentProof) {
        try {
          const path = require('path');
          const fs = require('fs');
          const proofFilePath = path.join(__dirname, '..', orderData.paymentProof);
          if (fs.existsSync(proofFilePath)) {
            fs.unlinkSync(proofFilePath);
          }
        } catch (fileErr) {
          logger.warn('Could not delete payment proof file', { error: fileErr.message });
        }
      }

      const completedOrder = new CompletedOrder({
        ...orderData,
        paymentProof: null,
        completedAt: new Date(),
        status: 'completed'
      });

      const session = await mongoose.startSession();
      let moveSucceeded = false;
      try {
        await session.withTransaction(async () => {
          await completedOrder.save({ session });
          await Order.findByIdAndDelete(order._id, { session });
        });
        moveSucceeded = true;
      } catch (txErr) {
        logger.error('Transaction failed for domi delivery completion', { error: txErr.message, orderId: order._id });
      } finally {
        session.endSession();
      }

      if (moveSucceeded) {
        setTimeout(() => {
          socketService.emitToBusiness(order.businessId.toString(), 'order_deleted', { _id: order._id });
        }, 3000);
      }
    } catch (moveErr) {
      logger.error('Error moving domi delivered order to completed', { error: moveErr.message, orderId: order._id });
    }

    // Register in cash register if one is open
    if (order.orderChannel !== 'pos') {
      try {
        const CashRegister = require('../Models/CashRegister');
        await CashRegister.findOneAndUpdate(
          { businessId: order.businessId, status: 'open' },
          { $push: { movements: {
            type: 'sale',
            amount: order.finalAmount || order.totalAmount,
            paymentMethod: order.paymentMethod || 'cash',
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderChannel: 'menuby',
            description: `MenuBy #${order.orderNumber} - ${order.customerName}`,
            createdAt: new Date()
          }}}
        );
      } catch (cashErr) {
        logger.warn('Failed to register delivery sale in cash register', { error: cashErr.message });
      }
    }

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

    // Shadow: delivery state machine → picked_up
    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'pickup', {
        actor: 'driver', actorId: req.domi.dpId && !String(req.domi.dpId).startsWith('daily-') ? req.domi.dpId : null,
        assignmentMethod: req.domi.mode,
      });
    } catch (e) { /* shadow, non-fatal */ }

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

// ── Driver availability + presence (own-fleet, Mode 3 profiles) ──────────────
// POST /:slug/domi/online  { online, lat, lng }  → toggle availability + report location
router.post('/:slug/domi/online', domiAuth, async (req, res) => {
  try {
    if (!req.domi.dpId) return res.status(400).json({ message: 'Este modo no admite disponibilidad' });
    const { online, lat, lng } = req.body;
    const update = { isOnline: !!online, lastSeenAt: new Date() };
    if (typeof lat === 'number' && typeof lng === 'number') {
      update.lastLocation = { type: 'Point', coordinates: [lng, lat] };
    }
    await DeliveryPerson.updateOne({ _id: req.domi.dpId }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error updating domi availability', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /:slug/domi/heartbeat  { lat, lng }  → keep presence + location fresh while online
router.post('/:slug/domi/heartbeat', domiAuth, async (req, res) => {
  try {
    if (!req.domi.dpId) return res.json({ ok: true });
    const { lat, lng } = req.body;
    const update = { lastSeenAt: new Date() };
    if (typeof lat === 'number' && typeof lng === 'number') {
      update.lastLocation = { type: 'Point', coordinates: [lng, lat] };
    }
    await DeliveryPerson.updateOne({ _id: req.domi.dpId }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

// ── Background GPS relay (from Expo TaskManager when app is in background) ────
// POST /:slug/domi/orders/:id/location  { lat, lng }
router.post('/:slug/domi/orders/:id/location', domiAuth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'lat y lng son requeridos como número' });
    }
    const orderId = req.params.id;
    // Relay to socket so restaurant dashboard gets live updates even when driver app is in background
    socketService.emitToOrder(orderId, 'domi:location', { lat, lng, orderId });
    // Also emit to the delivery room of the business
    const business = await resolveSlug(req.params.slug).catch(() => null);
    if (business) {
      socketService.emitToDeliveryRoom(req.params.slug, 'domi:location', { lat, lng, orderId });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error relaying domi location', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;
