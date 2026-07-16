const express = require('express');
const router = express.Router();
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
const multer = require('multer');

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
// The token is a crypto.randomUUID() — constrain the param so these routes
// never swallow other single-segment paths (this router is also mounted at
// /api/restaurants).
const UUID_PARAM = ':token([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';

// GET /api/delivery/:token — Public page for QR domiciliario
router.get(`/${UUID_PARAM}`, deliveryLimiter, async (req, res) => {
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
router.post(`/${UUID_PARAM}/confirm`, confirmLimiter, async (req, res) => {
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

    // Release driver, notify dashboard/tracking, archive to CompletedOrder, cash register
    const { finalizeDeliveredOrder } = require('../services/orderCompletionService');
    await finalizeDeliveredOrder(order);

    res.json({ message: 'Entrega confirmada exitosamente', deliveredAt: order.deliveredAt });
  } catch (error) {
    logger.error('Error confirming delivery', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/delivery/:token/picked — Domi marks order as picked up
router.post(`/${UUID_PARAM}/picked`, deliveryLimiter, async (req, res) => {
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

// POST /api/delivery/domi/login-pin — phone + 4-digit PIN (no slug, no password)
router.post('/domi/login-pin', deliveryLimiter, async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: 'Celular y PIN requeridos' });
    if (!/^\d{4}$/.test(code)) return res.status(400).json({ message: 'El PIN debe ser de 4 dígitos' });

    const norm = DeliveryPerson.normalizePhone(phone);
    if (!norm) return res.status(400).json({ message: 'Celular inválido' });

    // Match by phone, then verify the PIN (phone should be unique among domis;
    // if legacy data has duplicates, we log in the one whose PIN matches).
    const candidates = await DeliveryPerson.find({ phone: norm, active: true });
    const person = candidates.find(p => p.verifyCode(code));
    if (!person) return res.status(401).json({ message: 'Celular o PIN incorrectos' });

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
    logger.error('Error in domi login-pin', err);
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

    // Restaurant info for the two-stage flow (go to store → go to customer) + display
    const business = await BusinessConfig.findById(businessId)
      .select('requireDeliveryCode businessName address location logo phone phoneCountryCode')
      .lean();
    const requireCode = business?.requireDeliveryCode !== false;
    const restaurant = business ? {
      name: business.businessName,
      address: business.location?.address || business.address || '',
      coordinates: business.location?.coordinates || null, // { lat, lng }
      phone: (business.phoneCountryCode ? business.phoneCountryCode : '') + (business.phone || ''),
      logo: business.logo || null,
    } : null;

    // Never expose the customer confirmation code to the domi
    const safe = orders.map(o => ({
      ...o,
      confirmationCode: undefined,
      requireConfirmationCode: requireCode,
      restaurant,
    }));

    res.json(safe);
  } catch (error) {
    logger.error('Error fetching domi orders', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /:slug/domi/me — driver profile (name, photo, phone, business, summary)
router.get('/:slug/domi/me', domiAuth, async (req, res) => {
  try {
    const { dpId, businessId } = req.domi;
    const business = await BusinessConfig.findById(businessId).select('businessName slug logo').lean();
    if (!dpId || String(dpId).startsWith('daily-')) {
      return res.json({ name: 'Domiciliario del día', mode: 'fixed', business: business ? { name: business.businessName, logo: business.logo } : null });
    }
    const p = await DeliveryPerson.findById(dpId).select('name phone photo rating totalDeliveries activeDeliveries createdAt').lean();
    if (!p) return res.status(404).json({ message: 'Domiciliario no encontrado' });
    res.json({
      id: p._id, name: p.name, phone: p.phone, photo: p.photo || null,
      rating: p.rating ?? 5, totalDeliveries: p.totalDeliveries || 0,
      activeDeliveries: p.activeDeliveries || 0, memberSince: p.createdAt,
      business: business ? { name: business.businessName, slug: business.slug, logo: business.logo } : null,
    });
  } catch (err) {
    logger.error('Error fetching domi profile', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /:slug/domi/stats — the driver's own delivery stats
router.get('/:slug/domi/stats', domiAuth, async (req, res) => {
  try {
    const { dpId, businessId } = req.domi;
    if (!dpId || String(dpId).startsWith('daily-')) return res.json({ total: 0, today: 0, week: 0, avgMinutes: 0, chartData: [] });

    const mongoose = require('mongoose');
    const dp = new mongoose.Types.ObjectId(dpId);
    const bid = new mongoose.Types.ObjectId(businessId);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);

    const match = { deliveryPersonId: dp, deliveredAt: { $ne: null } };
    const [totalA, totalC, todayA, todayC] = await Promise.all([
      Order.countDocuments({ ...match, businessId: bid, status: 'delivered' }),
      CompletedOrder.countDocuments({ ...match, businessId: bid }),
      Order.countDocuments({ ...match, businessId: bid, status: 'delivered', deliveredAt: { $gte: todayStart } }),
      CompletedOrder.countDocuments({ ...match, businessId: bid, deliveredAt: { $gte: todayStart } }),
    ]);

    // avg minutes (assigned → delivered) across both collections
    const avgProject = { m: { $divide: [{ $subtract: ['$deliveredAt', '$deliveryAssignedAt'] }, 60000] } };
    const avgGroup = { _id: null, avg: { $avg: '$m' }, n: { $sum: 1 } };
    const avgMatch = { deliveryPersonId: dp, deliveryAssignedAt: { $ne: null }, deliveredAt: { $ne: null } };
    const [a1, a2] = await Promise.all([
      Order.aggregate([{ $match: { ...avgMatch, status: 'delivered' } }, { $project: avgProject }, { $group: avgGroup }]),
      CompletedOrder.aggregate([{ $match: avgMatch }, { $project: avgProject }, { $group: avgGroup }]),
    ]);
    const s1 = a1[0] || { avg: 0, n: 0 }; const s2 = a2[0] || { avg: 0, n: 0 };
    const nn = s1.n + s2.n;
    const avgMinutes = nn > 0 ? Math.round((s1.avg * s1.n + s2.avg * s2.n) / nn) : 0;

    // last 7 days chart
    const dayPipe = (Model, extra) => Model.aggregate([
      { $match: { deliveryPersonId: dp, deliveredAt: { $gte: weekStart }, ...extra } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$deliveredAt', timezone: 'America/Bogota' } }, c: { $sum: 1 } } },
    ]);
    const [dA, dC] = await Promise.all([dayPipe(Order, { status: 'delivered' }), dayPipe(CompletedOrder, {})]);
    const dayMap = {};
    for (const d of [...dA, ...dC]) dayMap[d._id] = (dayMap[d._id] || 0) + d.c;
    const chartData = []; let week = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const c = dayMap[key] || 0; week += c;
      chartData.push({ date: d.toLocaleDateString('es-CO', { weekday: 'short' }), count: c });
    }

    res.json({ total: totalA + totalC, today: todayA + todayC, week, avgMinutes, chartData });
  } catch (err) {
    logger.error('Error fetching domi stats', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /:slug/domi/photo — upload/replace the driver's profile photo
router.post('/:slug/domi/photo', domiAuth, photoUpload.single('photo'), async (req, res) => {
  try {
    const { dpId } = req.domi;
    if (!dpId || String(dpId).startsWith('daily-')) return res.status(400).json({ message: 'Este modo no admite foto' });
    if (!req.file) return res.status(400).json({ message: 'No se recibió imagen' });

    const { uploadImage, deleteImage, isSpacesConfigured } = require('../services/imageUploadService');
    if (!isSpacesConfigured()) return res.status(503).json({ message: 'Subida de imágenes no configurada' });

    const person = await DeliveryPerson.findById(dpId);
    if (!person) return res.status(404).json({ message: 'Domiciliario no encontrado' });

    const result = await uploadImage(req.file.buffer, 'domi-photos', { maxWidth: 400, quality: 80 });
    const url = result?.url || result;
    if (person.photo) { try { await deleteImage(person.photo); } catch { /* noop */ } }
    person.photo = url;
    await person.save();
    res.json({ ok: true, photo: url });
  } catch (err) {
    logger.error('Error uploading domi photo', err);
    res.status(500).json({ message: 'Error al subir la foto' });
  }
});

// POST /:slug/domi/orders/:id/arrived-store  { code } — confirm arrival at the
// restaurant with the daily pickup code, then mark the order picked up.
router.post('/:slug/domi/orders/:id/arrived-store', deliveryLimiter, domiAuth, async (req, res) => {
  try {
    const { businessId } = req.domi;
    const { code } = req.body;
    const order = await Order.findOne({ _id: req.params.id, businessId });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

    const { verifyDailyPickupCode } = require('../utils/dailyPickupCode');
    const ok = await verifyDailyPickupCode(businessId, code);
    if (!ok) return res.status(400).json({ message: 'Código de recogida incorrecto' });

    order.deliveryArrivedStoreAt = new Date();
    order.deliveryPickedAt = order.deliveryPickedAt || new Date();
    order.trackingEnabled = true;
    await order.save();

    try {
      const dsm = require('../services/deliveryStateMachine');
      await dsm.recordForOrder(order, 'arrive_store', { actor: 'driver', actorId: req.domi.dpId && !String(req.domi.dpId).startsWith('daily-') ? req.domi.dpId : null });
      await dsm.recordForOrder(order, 'pickup', { actor: 'driver' });
    } catch (e) { /* shadow, non-fatal */ }

    socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject());
    socketService.emitToOrder(order._id, 'order:status', { status: order.status, pickedAt: order.deliveryPickedAt });

    res.json({ ok: true, arrivedAt: order.deliveryArrivedStoreAt });
  } catch (err) {
    logger.error('Error confirming arrival at store', err);
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

    // Release driver, notify dashboard/tracking, archive to CompletedOrder, cash register
    const { finalizeDeliveredOrder } = require('../services/orderCompletionService');
    await finalizeDeliveredOrder(order);

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

// POST /:slug/domi/push-token  { fcmToken }  → register native FCM token
router.post('/:slug/domi/push-token', domiAuth, async (req, res) => {
  try {
    if (!req.domi.dpId || String(req.domi.dpId).startsWith('daily-')) {
      return res.json({ ok: true }); // fixed/daily sessions have no persistent driver
    }
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 20) {
      return res.status(400).json({ message: 'Token de push inválido' });
    }
    await DeliveryPerson.updateOne({ _id: req.domi.dpId }, { $set: { fcmToken } });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Error saving push token', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// DELETE /:slug/domi/push-token  → clear token (on logout)
router.delete('/:slug/domi/push-token', domiAuth, async (req, res) => {
  try {
    if (req.domi.dpId && !String(req.domi.dpId).startsWith('daily-')) {
      await DeliveryPerson.updateOne({ _id: req.domi.dpId }, { $set: { fcmToken: null } });
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
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
