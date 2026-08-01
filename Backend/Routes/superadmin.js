const express = require('express');
const router = express.Router();
const superadmin = require('../Controllers/superadmin');
const authMiddleware = require('../middleware/authSuperAdmin');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const Banner = require('../Models/Banner');
const PaymentRequest = require('../Models/PaymentRequest');
const Subscription = require('../Models/Subscription');
const AuditLog = require('../Models/AuditLog');
const { Worker } = require('../Models/Worker');
const CrewWalletTxn = require('../Models/CrewWalletTxn');
const CrewWithdrawalRequest = require('../Models/CrewWithdrawalRequest');
const CrewRechargeRequest = require('../Models/CrewRechargeRequest');
const CrewEmployer = require('../Models/CrewEmployer');
const crewLedger = require('../services/crewLedger');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Rutas protegidas (requieren autenticación de superadmin)
router.use(authMiddleware.protectSuperAdmin);

const { requireRole } = authMiddleware;

// Crear nuevo negocio — solo admin+
router.post('/business', requireRole('admin'), superadmin.crearNegocio);

// Listar negocios — cualquier rol (auditor incluido)
router.get('/business', superadmin.listarNegocios);

// Activar/desactivar negocio — support+ (soporte puede pausar/reactivar)
router.patch('/business/:id/activate', requireRole('support'), superadmin.activarNegocio);

// Toggle POS beta para un negocio — admin+
router.patch('/business/:id/pos-beta', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const negocio = await BusinessConfig.findByIdAndUpdate(
      id,
      { 'features.posBetaEnabled': !!enabled },
      { new: true }
    );
    if (!negocio) return res.status(404).json({ message: 'Negocio no encontrado' });
    const io = req.app.get('io');
    if (io) io.emit('businesses-updated');
    res.json(negocio);
  } catch (error) {
    logger.error('Error toggling POS beta', error);
    res.status(500).json({ message: 'Error al cambiar POS beta' });
  }
});

// Toggle Menú V2 (perfil + historias) para un negocio — admin+
router.patch('/business/:id/menu-v2', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const negocio = await BusinessConfig.findByIdAndUpdate(
      id,
      { 'features.menuV2': !!enabled },
      { new: true }
    );
    if (!negocio) return res.status(404).json({ message: 'Negocio no encontrado' });
    const io = req.app.get('io');
    if (io) io.emit('businesses-updated');
    res.json(negocio);
  } catch (error) {
    logger.error('Error toggling menu V2', error);
    res.status(500).json({ message: 'Error al cambiar Menú V2' });
  }
});

/**
 * GET /search?q= — buscador único para soporte.
 *
 * Un solo campo donde pegar lo que sea (nombre de negocio, slug, teléfono,
 * número de pedido o nombre de cliente) sin tener que adivinar antes en qué
 * sección buscar.
 */
router.get('/search', requireRole('support'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ businesses: [], orders: [] });

    // Escapar para que un punto o paréntesis no se interprete como regex
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    const digits = q.replace(/\D/g, '');

    const orderOr = [{ orderNumber: rx }, { customerName: rx }];
    if (digits.length >= 6) orderOr.push({ phone: new RegExp(digits) });

    const [businesses, activeOrders, completedOrders] = await Promise.all([
      BusinessConfig.find({
        $or: [{ businessName: rx }, { slug: rx }, ...(digits.length >= 6 ? [{ whatsappNumber: new RegExp(digits) }] : [])],
      }).select('_id businessName slug city isActive').limit(8).lean(),

      Order.find({ $or: orderOr })
        .select('_id orderNumber customerName phone status finalAmount totalAmount businessId createdAt')
        .sort({ createdAt: -1 }).limit(8).lean(),

      CompletedOrder.find({ $or: orderOr })
        .select('_id orderNumber customerName phone status finalAmount totalAmount businessId createdAt')
        .sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const orders = [...activeOrders, ...completedOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Resolver el nombre del negocio de cada pedido en una sola consulta
    const bizIds = [...new Set(orders.map((o) => String(o.businessId)).filter(Boolean))];
    const bizMap = new Map();
    if (bizIds.length) {
      const bizs = await BusinessConfig.find({ _id: { $in: bizIds } }).select('_id businessName slug').lean();
      bizs.forEach((b) => bizMap.set(String(b._id), b));
    }

    res.json({
      businesses,
      orders: orders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        phone: o.phone,
        status: o.status,
        amount: o.finalAmount || o.totalAmount || 0,
        createdAt: o.createdAt,
        business: bizMap.get(String(o.businessId)) || null,
      })),
    });
  } catch (error) {
    logger.error('Error in superadmin search', error);
    res.status(500).json({ message: 'Error al buscar' });
  }
});

/**
 * GET /business-health — qué negocios se están apagando.
 *
 * El churn agregado dice cuántos se fueron; esto dice CUÁLES están en riesgo
 * ahora, que es lo único sobre lo que todavía se puede actuar. Se apoya en los
 * pedidos (activos + completados), sin campos nuevos.
 */
router.get('/business-health', requireRole('support'), async (req, res) => {
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 864e5);
    const d14 = new Date(now.getTime() - 14 * 864e5);

    // Un pedido vive en Order o en CompletedOrder, así que se agregan ambos
    const pipeline = (dateField) => ([
      { $match: { [dateField]: { $gte: d14 } } },
      {
        $group: {
          _id: '$businessId',
          last7: { $sum: { $cond: [{ $gte: [`$${dateField}`, d7] }, 1, 0] } },
          prev7: { $sum: { $cond: [{ $lt: [`$${dateField}`, d7] }, 1, 0] } },
        },
      },
    ]);

    const [actives, completed, lastActive, lastCompleted, businesses] = await Promise.all([
      Order.aggregate(pipeline('createdAt')),
      CompletedOrder.aggregate(pipeline('createdAt')),
      Order.aggregate([{ $group: { _id: '$businessId', last: { $max: '$createdAt' } } }]),
      CompletedOrder.aggregate([{ $group: { _id: '$businessId', last: { $max: '$createdAt' } } }]),
      BusinessConfig.find({ isActive: true })
        .select('_id businessName slug city createdAt subscriptionStatus')
        .lean(),
    ]);

    const counts = new Map();
    for (const row of [...actives, ...completed]) {
      const k = String(row._id);
      const cur = counts.get(k) || { last7: 0, prev7: 0 };
      counts.set(k, { last7: cur.last7 + row.last7, prev7: cur.prev7 + row.prev7 });
    }

    const lastSeen = new Map();
    for (const row of [...lastActive, ...lastCompleted]) {
      const k = String(row._id);
      const prev = lastSeen.get(k);
      if (!prev || (row.last && row.last > prev)) lastSeen.set(k, row.last);
    }

    const items = businesses.map((b) => {
      const k = String(b._id);
      const c = counts.get(k) || { last7: 0, prev7: 0 };
      const last = lastSeen.get(k) || null;
      const daysSince = last ? Math.floor((now - new Date(last)) / 864e5) : null;
      const trend = c.prev7 > 0 ? Math.round(((c.last7 - c.prev7) / c.prev7) * 100) : (c.last7 > 0 ? 100 : 0);
      const daysOld = Math.floor((now - new Date(b.createdAt)) / 864e5);

      // Nunca pidió y ya lleva más de una semana registrado: no activó
      let risk = 'ok';
      let reason = 'Operando con normalidad';
      if (last === null) {
        risk = daysOld >= 7 ? 'never' : 'new';
        reason = daysOld >= 7 ? 'Nunca ha recibido un pedido' : 'Recién registrado';
      } else if (daysSince >= 14) {
        risk = 'high';
        reason = `Sin pedidos hace ${daysSince} días`;
      } else if (daysSince >= 7) {
        risk = 'medium';
        reason = `Sin pedidos hace ${daysSince} días`;
      } else if (c.prev7 >= 5 && trend <= -50) {
        risk = 'medium';
        reason = `Cayó ${Math.abs(trend)}% esta semana`;
      }

      return {
        _id: b._id,
        businessName: b.businessName,
        slug: b.slug,
        city: b.city || null,
        subscriptionStatus: b.subscriptionStatus || null,
        lastOrderAt: last,
        daysSinceLastOrder: daysSince,
        ordersLast7: c.last7,
        ordersPrev7: c.prev7,
        trendPct: trend,
        daysRegistered: daysOld,
        risk,
        reason,
      };
    });

    const order = { high: 0, never: 1, medium: 2, new: 3, ok: 4 };
    items.sort((a, b) => (order[a.risk] - order[b.risk]) || ((b.daysSinceLastOrder ?? 0) - (a.daysSinceLastOrder ?? 0)));

    res.json({
      generatedAt: now,
      summary: {
        total: items.length,
        high: items.filter((i) => i.risk === 'high').length,
        medium: items.filter((i) => i.risk === 'medium').length,
        never: items.filter((i) => i.risk === 'never').length,
        ok: items.filter((i) => i.risk === 'ok').length,
      },
      items,
    });
  } catch (error) {
    logger.error('Error computing business health', error);
    res.status(500).json({ message: 'Error al calcular la salud de los negocios' });
  }
});

// Obtener credenciales del admin del negocio — solo admin+
router.get('/business/:id/credentials', requireRole('admin'), superadmin.getBusinessCredentials);

// Resetear credenciales (email/usuario y/o contraseña) — solo admin+
router.patch('/business/:id/reset-credentials', requireRole('admin'), superadmin.resetBusinessCredentials);

// Eliminar negocio — solo admin+ (destructivo)
router.delete('/business/:id', requireRole('admin'), superadmin.eliminarNegocio);

// Toggle proveedor marketplace — admin+
router.patch('/business/:id/supplier', requireRole('admin'), async (req, res) => {
  try {
    const { enabled, categories, description } = req.body;
    const update = {
      isSupplier: !!enabled,
      'supplierInfo.categories': categories || [],
      'supplierInfo.description': description || ''
    };
    if (enabled) {
      update['supplierInfo.approvedAt'] = new Date();
      update['supplierInfo.approvedBy'] = req.user?.email || 'superadmin';
    } else {
      update['supplierInfo.approvedAt'] = null;
      update['supplierInfo.approvedBy'] = null;
    }
    const negocio = await BusinessConfig.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!negocio) return res.status(404).json({ message: 'Negocio no encontrado' });
    res.json({ success: true, business: negocio });
  } catch (error) {
    logger.error('Error toggling supplier status', error, req);
    res.status(500).json({ message: 'Error al actualizar proveedor' });
  }
});

// ========== GESTIÓN DE PEDIDOS (SuperAdmin) ==========

const VALID_ORDER_STATUSES = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'ready', 'inProgress', 'completed', 'cancelled', 'delivered'];
const COMPLETED_STATUSES = ['completed', 'delivered', 'cancelled'];

// GET /api/superadmin/orders - Listar todos los pedidos de todos los negocios
router.get('/orders', async (req, res) => {
  try {
    const { status, businessId, collection: col, search } = req.query;

    // --- Active orders ---
    const activeQuery = {};
    if (status) activeQuery.status = status;
    if (businessId && mongoose.isValidObjectId(businessId)) activeQuery.businessId = new mongoose.Types.ObjectId(businessId);

    let activeOrders = [];
    if (!col || col === 'active') {
      activeOrders = await Order.find(activeQuery)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('businessId', 'businessName slug')
        .lean();
      activeOrders = activeOrders.map(o => ({ ...o, _collection: 'orders' }));
    }

    // --- Completed orders ---
    const completedQuery = {};
    if (status) completedQuery.status = status;
    if (businessId && mongoose.isValidObjectId(businessId)) completedQuery.businessId = new mongoose.Types.ObjectId(businessId);

    let completedOrders = [];
    if (!col || col === 'completed') {
      completedOrders = await CompletedOrder.find(completedQuery)
        .sort({ completedAt: -1 })
        .limit(200)
        .populate('businessId', 'businessName slug')
        .lean();
      completedOrders = completedOrders.map(o => ({ ...o, _collection: 'completedorders' }));
    }

    let allOrders = [...activeOrders, ...completedOrders];

    // Client-side search by customer name
    if (search) {
      const s = search.toLowerCase();
      allOrders = allOrders.filter(o => (o.customerName || '').toLowerCase().includes(s));
    }

    // Sort all by date descending
    allOrders.sort((a, b) => {
      const da = a.completedAt || a.createdAt || 0;
      const db = b.completedAt || b.createdAt || 0;
      return new Date(db) - new Date(da);
    });

    // Get business list for filter dropdown + REAL totals (not limited by the 200 cap above)
    const [businesses, totalActive, totalCompleted] = await Promise.all([
      BusinessConfig.find({}, 'businessName slug').sort({ businessName: 1 }).lean(),
      (!col || col === 'active') ? Order.countDocuments(activeQuery) : Promise.resolve(0),
      (!col || col === 'completed') ? CompletedOrder.countDocuments(completedQuery) : Promise.resolve(0),
    ]);

    res.json({
      success: true,
      orders: allOrders,
      businesses: businesses.map(b => ({ id: b._id, name: b.businessName, slug: b.slug })),
      loaded: allOrders.length,
      totals: {
        active: totalActive,
        completed: totalCompleted,
        all: totalActive + totalCompleted,
      },
      cappedAt: 200,
    });
  } catch (error) {
    logger.error('Error fetching orders (superadmin)', error, req);
    res.status(500).json({ message: 'Error al obtener pedidos' });
  }
});

// GET /api/superadmin/stats/overview - KPIs agregados para el Home Dashboard
router.get('/stats/overview', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalBusinesses,
      activeBusinesses,
      activeOrdersCount,
      completedOrdersCount,
      ordersThisMonth,
      gmvAllTimeAgg,
      gmvThisMonthAgg,
      pendingBanners,
      pendingPaymentRequests,
      activeSubscriptions,
      expiringSubscriptions,
      topBusinessesAgg,
      recentAuditLogs,
    ] = await Promise.all([
      BusinessConfig.countDocuments({}),
      BusinessConfig.countDocuments({ isActive: true }),
      Order.estimatedDocumentCount(),
      CompletedOrder.estimatedDocumentCount(),
      CompletedOrder.countDocuments({ completedAt: { $gte: startOfMonth } }),
      CompletedOrder.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, sum: { $sum: '$totalAmount' } } },
      ]),
      CompletedOrder.aggregate([
        { $match: { completedAt: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, sum: { $sum: '$totalAmount' } } },
      ]),
      Banner.countDocuments({ status: 'pending' }),
      PaymentRequest.countDocuments({ status: 'pending' }),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({
        status: 'active',
        periodEnd: { $gte: now, $lte: sevenDaysFromNow },
      }),
      CompletedOrder.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: '$businessId', count: { $sum: 1 }, gmv: { $sum: '$totalAmount' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'businessconfigs', localField: '_id', foreignField: '_id', as: 'business' } },
        { $unwind: { path: '$business', preserveNullAndEmptyArrays: true } },
        { $project: {
          _id: 0,
          businessId: '$_id',
          name: { $ifNull: ['$business.businessName', 'Sin nombre'] },
          slug: '$business.slug',
          count: 1,
          gmv: 1,
        } },
      ]),
      AuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select('action resource resourceName userEmail userRole businessName createdAt reverted')
        .lean(),
    ]);

    res.json({
      success: true,
      generatedAt: now.toISOString(),
      kpis: {
        businesses: {
          total: totalBusinesses,
          active: activeBusinesses,
          inactive: Math.max(0, totalBusinesses - activeBusinesses),
        },
        orders: {
          activeNow: activeOrdersCount,
          completedAllTime: completedOrdersCount,
          totalAllTime: activeOrdersCount + completedOrdersCount,
          thisMonth: ordersThisMonth,
        },
        gmv: {
          allTime: gmvAllTimeAgg[0]?.sum || 0,
          thisMonth: gmvThisMonthAgg[0]?.sum || 0,
        },
        subscriptions: {
          active: activeSubscriptions,
          expiringSoon: expiringSubscriptions,
        },
      },
      pending: {
        banners: pendingBanners,
        paymentRequests: pendingPaymentRequests,
      },
      topBusinesses: topBusinessesAgg,
      recentActivity: recentAuditLogs,
    });
  } catch (error) {
    logger.error('Error fetching stats/overview (superadmin)', error, req);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// PATCH /api/superadmin/orders/:id/status - Cambiar estado de un pedido — support+
router.patch('/orders/:id/status', requireRole('support'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, fromCollection } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de pedido inválido' });
    }
    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido', validStatuses: VALID_ORDER_STATUSES });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    let order = null;
    let sourceCollection = fromCollection;

    // Try to find in orders first, then completedorders
    order = await Order.findById(objectId);
    if (order) {
      sourceCollection = 'orders';
    } else {
      order = await CompletedOrder.findById(objectId);
      if (order) sourceCollection = 'completedorders';
    }

    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    const oldStatus = order.status;
    const shouldBeCompleted = COMPLETED_STATUSES.includes(status);
    const isCurrentlyInOrders = sourceCollection === 'orders';

    if (shouldBeCompleted && isCurrentlyInOrders) {
      // Move from orders -> completedorders
      const orderData = order.toObject();
      delete orderData._id;
      delete orderData.__v;
      orderData.status = status;
      orderData.completedAt = new Date();
      orderData.reportDate = new Date().toISOString().split('T')[0];

      const completedOrder = new CompletedOrder(orderData);
      await completedOrder.save();
      await Order.findByIdAndDelete(objectId);

      logger.info('SuperAdmin moved order to completed', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Pedido movido a completados con estado "${status}"`,
        order: { ...completedOrder.toObject(), _collection: 'completedorders' },
        moved: true
      });
    } else if (!shouldBeCompleted && !isCurrentlyInOrders) {
      // Move from completedorders -> orders (reactivating)
      const orderData = order.toObject();
      delete orderData._id;
      delete orderData.__v;
      delete orderData.completedAt;
      delete orderData.reportDate;
      delete orderData.includedInReport;
      orderData.status = status;

      const activeOrder = new Order(orderData);
      await activeOrder.save();
      await CompletedOrder.findByIdAndDelete(objectId);

      logger.info('SuperAdmin moved order back to active', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Pedido reactivado con estado "${status}"`,
        order: { ...activeOrder.toObject(), _collection: 'orders' },
        moved: true
      });
    } else {
      // Same collection, just update status
      order.status = status;
      if (shouldBeCompleted && !order.completedAt) {
        order.completedAt = new Date();
      }
      await order.save();

      logger.info('SuperAdmin updated order status', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Estado actualizado a "${status}"`,
        order: { ...order.toObject(), _collection: sourceCollection },
        moved: false
      });
    }
  } catch (error) {
    logger.error('Error updating order status (superadmin)', error, req);
    res.status(500).json({ message: 'Error al actualizar pedido' });
  }
});

/* ─────────────────────────────────────────────
 *  CREW — cola de verificación KYC (workers)
 *  Permisos: lectura = support+, decisión = admin+.
 * ───────────────────────────────────────────── */

const KYC_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'none'];

// GET /api/superadmin/crew/kyc?status=pending — cola de KYCs
router.get('/crew/kyc', async (req, res) => {
  try {
    const { status = 'pending', limit = 100 } = req.query;
    const q = {};
    if (status === 'any') {
      q['kyc.status'] = { $in: KYC_STATUSES.filter(s => s !== 'none') };
    } else if (KYC_STATUSES.includes(status)) {
      q['kyc.status'] = status;
    }

    const [workers, counts] = await Promise.all([
      Worker.find(q)
        .sort({ 'kyc.submittedAt': -1, createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .select('name phone email photo cedula kyc university level rating stats createdAt')
        .populate('kyc.reviewedBy', 'email name')
        .lean(),
      Worker.aggregate([
        { $match: { 'kyc.status': { $in: ['pending', 'approved', 'rejected'] } } },
        { $group: { _id: '$kyc.status', count: { $sum: 1 } } },
      ]),
    ]);

    const countsByStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
    res.json({ success: true, workers, counts: countsByStatus });
  } catch (error) {
    logger.error('Error listing crew KYC queue', error, req);
    res.status(500).json({ message: 'Error al cargar la cola de KYC' });
  }
});

// POST /api/superadmin/crew/kyc/:workerId/approve
router.post('/crew/kyc/:workerId/approve', requireRole('admin'), async (req, res) => {
  try {
    const { workerId } = req.params;
    if (!mongoose.isValidObjectId(workerId)) return res.status(400).json({ message: 'workerId inválido' });
    const worker = await Worker.findById(workerId);
    if (!worker) return res.status(404).json({ message: 'Trabajador no encontrado' });
    if (worker.kyc?.status !== 'pending') {
      return res.status(400).json({ message: `KYC en estado "${worker.kyc?.status || 'none'}", no se puede aprobar` });
    }
    worker.kyc.status = 'approved';
    worker.kyc.reviewedAt = new Date();
    worker.kyc.reviewedBy = req.user?.id || null;
    worker.kyc.rejectionReason = null;
    worker.idVerified = true;
    await worker.save();
    res.json({ success: true, worker: { id: worker._id, kyc: worker.kyc, idVerified: worker.idVerified } });
  } catch (error) {
    logger.error('Error approving crew KYC', error, req);
    res.status(500).json({ message: 'Error al aprobar' });
  }
});

// POST /api/superadmin/crew/kyc/:workerId/reject
router.post('/crew/kyc/:workerId/reject', requireRole('admin'), async (req, res) => {
  try {
    const { workerId } = req.params;
    const { reason } = req.body || {};
    if (!mongoose.isValidObjectId(workerId)) return res.status(400).json({ message: 'workerId inválido' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ message: 'La razón del rechazo es obligatoria' });
    const worker = await Worker.findById(workerId);
    if (!worker) return res.status(404).json({ message: 'Trabajador no encontrado' });
    if (worker.kyc?.status !== 'pending') {
      return res.status(400).json({ message: `KYC en estado "${worker.kyc?.status || 'none'}", no se puede rechazar` });
    }
    worker.kyc.status = 'rejected';
    worker.kyc.reviewedAt = new Date();
    worker.kyc.reviewedBy = req.user?.id || null;
    worker.kyc.rejectionReason = String(reason).trim().slice(0, 300);
    worker.idVerified = false;
    await worker.save();
    res.json({ success: true, worker: { id: worker._id, kyc: worker.kyc } });
  } catch (error) {
    logger.error('Error rejecting crew KYC', error, req);
    res.status(500).json({ message: 'Error al rechazar' });
  }
});

/* ─────────────────────────────────────────────
 *  CREW — cola de retiros + overview de la billetera de la plataforma
 *  Lectura desde auditor; pagos/rechazos requieren admin+ (mueve plata real).
 * ───────────────────────────────────────────── */

// GET /api/superadmin/crew/withdrawals?status=pending
router.get('/crew/withdrawals', async (req, res) => {
  try {
    const { status = 'pending', limit = 100 } = req.query;
    const q = {};
    if (['pending', 'processing', 'paid', 'rejected'].includes(status)) q.status = status;
    const [withdrawals, counts] = await Promise.all([
      CrewWithdrawalRequest.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .populate('workerId', 'name phone email photo cedula kyc.status wallet')
        .populate('paidBy', 'email name')
        .lean(),
      CrewWithdrawalRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);
    const countsByStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: { count: c.count, total: c.total } }), {});
    res.json({ success: true, withdrawals, counts: countsByStatus });
  } catch (error) {
    logger.error('Error listing crew withdrawals', error, req);
    res.status(500).json({ message: 'Error al cargar retiros' });
  }
});

// POST /api/superadmin/crew/withdrawals/:id/pay
router.post('/crew/withdrawals/:id/pay', requireRole('admin'), async (req, res) => {
  try {
    const { externalReference } = req.body || {};
    const result = await crewLedger.markWithdrawalPaid({
      withdrawalId: req.params.id,
      externalReference: externalReference || null,
      paidBy: req.user.id,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (['NOT_FOUND', 'INVALID_STATE'].includes(e.code)) {
      return res.status(400).json({ message: e.message, code: e.code });
    }
    logger.error('Error paying crew withdrawal', e, req);
    res.status(500).json({ message: e.message || 'Error al marcar pagado' });
  }
});

// POST /api/superadmin/crew/withdrawals/:id/reject
router.post('/crew/withdrawals/:id/reject', requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body || {};
    const result = await crewLedger.rejectWithdrawal({
      withdrawalId: req.params.id,
      reason,
      rejectedBy: req.user.id,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (['NOT_FOUND', 'INVALID_STATE', 'MISSING_REASON'].includes(e.code)) {
      return res.status(400).json({ message: e.message, code: e.code });
    }
    logger.error('Error rejecting crew withdrawal', e, req);
    res.status(500).json({ message: e.message || 'Error al rechazar' });
  }
});

// GET /api/superadmin/crew/recharges?status=pending&ownerType=business|crew_employer
router.get('/crew/recharges', async (req, res) => {
  try {
    const { status = 'pending', ownerType, limit = 100 } = req.query;
    const q = {};
    if (['pending', 'approved', 'rejected'].includes(status)) q.status = status;
    if (['business', 'crew_employer'].includes(ownerType)) q.ownerType = ownerType;

    const [requests, counts] = await Promise.all([
      CrewRechargeRequest.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .populate('businessId', 'businessName slug crewWallet logo')
        .populate('employerId', 'name kind crewWallet photo')
        .populate('reviewedBy', 'email name')
        .lean(),
      CrewRechargeRequest.aggregate([
        { $group: { _id: { status: '$status', ownerType: '$ownerType' }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);
    // Agregamos por status (total) y desglose por ownerType
    const countsByStatus = {};
    for (const c of counts) {
      const s = c._id.status;
      if (!countsByStatus[s]) countsByStatus[s] = { count: 0, total: 0, business: 0, crew_employer: 0 };
      countsByStatus[s].count += c.count;
      countsByStatus[s].total += c.total;
      countsByStatus[s][c._id.ownerType || 'business'] += c.count;
    }
    res.json({ success: true, requests, counts: countsByStatus });
  } catch (error) {
    logger.error('Error listing crew recharges', error, req);
    res.status(500).json({ message: 'Error al cargar recargas' });
  }
});

// POST /api/superadmin/crew/recharges/:id/approve — acredita y deja trace en ledger.
// Funciona para BusinessConfig y CrewEmployer (polimórfico vía ownerType).
router.post('/crew/recharges/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const reqDoc = await CrewRechargeRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'Solicitud no encontrada' });
    if (reqDoc.status !== 'pending') {
      return res.status(400).json({ message: `Solicitud en estado ${reqDoc.status}` });
    }

    const ownerType = reqDoc.ownerType || 'business';
    const ownerId = ownerType === 'business' ? reqDoc.businessId : reqDoc.employerId;
    if (!ownerId) {
      return res.status(400).json({ message: 'Recarga sin owner identificable' });
    }

    const result = await crewLedger.depositOwnerWallet({
      ownerType, ownerId,
      amount: reqDoc.amount,
      idempotencyKey: `crew_recharge:${reqDoc._id}`,
      note: `Recarga aprobada (${reqDoc.paymentMethod})`,
      performedBy: { kind: 'superadmin', id: req.user.id },
    });

    reqDoc.status = 'approved';
    reqDoc.reviewedAt = new Date();
    reqDoc.reviewedBy = req.user.id;
    reqDoc.walletTxnId = result.txn._id;
    await reqDoc.save();

    const io = req.app.get('io');
    if (io) {
      io.to(String(ownerId)).emit('crew-wallet-updated', { wallet: result.wallet, ownerType });
    }

    res.json({ success: true, request: reqDoc, wallet: result.wallet, duplicated: result.duplicated });
  } catch (e) {
    logger.error('Error approving crew recharge', e, req);
    res.status(500).json({ message: e.message || 'Error al aprobar' });
  }
});

// POST /api/superadmin/crew/recharges/:id/reject
router.post('/crew/recharges/:id/reject', requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason?.trim()) return res.status(400).json({ message: 'El motivo es obligatorio' });
    const reqDoc = await CrewRechargeRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'Solicitud no encontrada' });
    if (reqDoc.status !== 'pending') {
      return res.status(400).json({ message: `Solicitud en estado ${reqDoc.status}` });
    }
    reqDoc.status = 'rejected';
    reqDoc.rejectionReason = reason.trim().slice(0, 300);
    reqDoc.reviewedAt = new Date();
    reqDoc.reviewedBy = req.user.id;
    await reqDoc.save();
    res.json({ success: true, request: reqDoc });
  } catch (e) {
    logger.error('Error rejecting crew recharge', e, req);
    res.status(500).json({ message: e.message || 'Error al rechazar' });
  }
});

// POST /api/superadmin/crew/backfill-payouts — recupera bookings que quedaron
// marcados como completed pero nunca recibieron el payout (bug del release
// con escrow vacío que afectó turnos publicados antes del sistema).
// Idempotente: el release interno detecta duplicados via idempotencyKey.
router.post('/crew/backfill-payouts', requireRole('admin'), async (req, res) => {
  try {
    const ShiftBooking = require('../Models/ShiftBooking');
    const { Worker } = require('../Models/Worker');
    const stuck = await ShiftBooking.find({
      status: 'completed',
      payoutStatus: { $ne: 'released' },
    }).limit(500).lean();

    const results = { processed: 0, released: 0, failed: [], skipped: 0 };

    for (const bk of stuck) {
      try {
        const release = await crewLedger.releaseBookingFunds({
          bookingId: bk._id,
          performedBy: { kind: 'superadmin', id: req.user.id },
        });
        if (release.alreadyReleased) { results.skipped++; continue; }
        results.released++;

        // Si el booking no tenía xpAwarded, le damos XP también
        const fresh = await ShiftBooking.findById(bk._id);
        if (!fresh.xpAwarded || fresh.xpAwarded === 0) {
          const xp = Math.round((fresh.agreedHours || 0) * 25);
          if (xp > 0) {
            await Worker.addXP(fresh.workerId, xp);
            await Worker.updateOne(
              { _id: fresh.workerId },
              {
                $inc: { 'stats.shiftsCompleted': 1, 'stats.hoursWorked': fresh.agreedHours || 0 },
                $set: { lastShiftAt: new Date() },
              },
            );
            fresh.xpAwarded = xp;
            await fresh.save();
          }
        }
      } catch (e) {
        results.failed.push({ bookingId: String(bk._id), error: e.message, code: e.code });
      }
      results.processed++;
    }

    res.json({ success: true, ...results });
  } catch (e) {
    logger.error('Error backfilling payouts', e, req);
    res.status(500).json({ message: e.message || 'Error en backfill' });
  }
});

// POST /api/superadmin/crew/auto-release-stale — auto-libera bookings que el
// worker terminó (checked_in con workerCheckoutAt) pero el negocio nunca confirmó.
// Pensado para ejecutarse cada N minutos desde un cron / scheduled task.
// Query params: ?maxAgeHours=24 (default), ?limit=200 (default).
router.post('/crew/auto-release-stale', requireRole('admin'), async (req, res) => {
  try {
    const maxAgeHours = Number(req.query.maxAgeHours || req.body?.maxAgeHours || 24);
    const limit = Number(req.query.limit || req.body?.limit || 200);
    const result = await crewLedger.autoReleaseStaleBookings({
      maxAgeHours,
      limit,
      performedBy: { kind: 'superadmin', id: req.user.id },
    });
    res.json({ success: true, ...result, maxAgeHours, limit });
  } catch (e) {
    logger.error('Error in auto-release-stale', e, req);
    res.status(500).json({ message: e.message || 'Error al auto-liberar' });
  }
});

// GET /api/superadmin/crew/treasury — visión global de plata en Crew
router.get('/crew/treasury', async (req, res) => {
  try {
    const [walletsAgg, commissionAgg, pendingWithdrawalsAgg, ledgerByKind] = await Promise.all([
      BusinessConfig.aggregate([
        { $group: {
          _id: null,
          totalAvailable: { $sum: '$crewWallet.balance' },
          totalInEscrow: { $sum: '$crewWallet.pendingBalance' },
          totalLifetimeSpent: { $sum: '$crewWallet.totalSpent' },
          totalLifetimeCommission: { $sum: '$crewWallet.totalCommissionPaid' },
          rechargedBusinesses: { $sum: { $cond: [{ $gt: ['$crewWallet.balance', 0] }, 1, 0] } },
        } },
      ]),
      CrewWalletTxn.aggregate([
        { $match: { kind: 'shift_commission' } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        } },
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ]),
      CrewWithdrawalRequest.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      CrewWalletTxn.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: '$kind', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      success: true,
      treasury: {
        businesses: walletsAgg[0] || {
          totalAvailable: 0, totalInEscrow: 0, totalLifetimeSpent: 0, totalLifetimeCommission: 0, rechargedBusinesses: 0,
        },
        pendingWithdrawals: pendingWithdrawalsAgg[0] || { total: 0, count: 0 },
      },
      commissionByMonth: commissionAgg,
      activityLast30d: ledgerByKind,
    });
  } catch (error) {
    logger.error('Error fetching crew treasury', error, req);
    res.status(500).json({ message: 'Error al cargar treasury' });
  }
});

/* ─────────────────────────────────────────────
 *  CREW — cola de aprobación de empleadores externos
 *  Empleadores con cuenta self-signup llegan en `pending_approval`. Acá los
 *  revisamos uno por uno antes de dejarlos publicar/cargar saldo.
 * ───────────────────────────────────────────── */

// GET /api/superadmin/crew/employers?status=pending_approval
router.get('/crew/employers', async (req, res) => {
  try {
    const { status = 'pending_approval', kind, limit = 100 } = req.query;
    const q = {};
    if (['pending_approval', 'approved', 'rejected', 'suspended', 'banned'].includes(status)) {
      q.status = status;
    }
    if (['individual', 'business'].includes(kind)) q.kind = kind;

    const [employers, counts] = await Promise.all([
      CrewEmployer.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .select('-password -refreshToken -verificationDocs')
        .populate('approvedBy', 'email name')
        .lean(),
      CrewEmployer.aggregate([
        { $group: { _id: { status: '$status', kind: '$kind' }, count: { $sum: 1 } } },
      ]),
    ]);

    const countsByStatus = {};
    for (const c of counts) {
      const s = c._id.status;
      if (!countsByStatus[s]) countsByStatus[s] = { total: 0, individual: 0, business: 0 };
      countsByStatus[s].total += c.count;
      countsByStatus[s][c._id.kind] = (countsByStatus[s][c._id.kind] || 0) + c.count;
    }

    res.json({ success: true, employers, counts: countsByStatus });
  } catch (error) {
    logger.error('Error listing crew employers', error, req);
    res.status(500).json({ message: 'Error al cargar empleadores' });
  }
});

// POST /api/superadmin/crew/employers/:id/approve
router.post('/crew/employers/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const employer = await CrewEmployer.findById(req.params.id);
    if (!employer) return res.status(404).json({ message: 'Empleador no encontrado' });
    if (employer.status === 'approved') {
      return res.status(400).json({ message: 'Ya está aprobado' });
    }
    employer.status = 'approved';
    employer.approvedAt = new Date();
    employer.approvedBy = req.user.id;
    employer.rejectionReason = null;
    await employer.save();
    res.json({ success: true, employer: { id: employer._id, status: employer.status } });
  } catch (e) {
    logger.error('Error approving crew employer', e, req);
    res.status(500).json({ message: e.message || 'Error al aprobar' });
  }
});

// POST /api/superadmin/crew/employers/:id/reject
router.post('/crew/employers/:id/reject', requireRole('admin'), async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason?.trim()) return res.status(400).json({ message: 'El motivo es obligatorio' });
    const employer = await CrewEmployer.findById(req.params.id);
    if (!employer) return res.status(404).json({ message: 'Empleador no encontrado' });
    if (employer.status === 'rejected') {
      return res.status(400).json({ message: 'Ya está rechazado' });
    }
    employer.status = 'rejected';
    employer.rejectionReason = reason.trim().slice(0, 300);
    employer.approvedAt = null;
    employer.approvedBy = null;
    await employer.save();
    res.json({ success: true, employer: { id: employer._id, status: employer.status } });
  } catch (e) {
    logger.error('Error rejecting crew employer', e, req);
    res.status(500).json({ message: e.message || 'Error al rechazar' });
  }
});

// POST /api/superadmin/crew/employers/:id/suspend
router.post('/crew/employers/:id/suspend', requireRole('admin'), async (req, res) => {
  try {
    const { reason, until } = req.body || {};
    const employer = await CrewEmployer.findById(req.params.id);
    if (!employer) return res.status(404).json({ message: 'Empleador no encontrado' });
    employer.status = 'suspended';
    employer.suspendedUntil = until ? new Date(until) : null;
    employer.rejectionReason = reason ? String(reason).slice(0, 300) : employer.rejectionReason;
    await employer.save();
    res.json({ success: true, employer: { id: employer._id, status: employer.status } });
  } catch (e) {
    logger.error('Error suspending crew employer', e, req);
    res.status(500).json({ message: e.message || 'Error al suspender' });
  }
});

// POST /api/superadmin/crew/employers/:id/restore — vuelve a approved
router.post('/crew/employers/:id/restore', requireRole('admin'), async (req, res) => {
  try {
    const employer = await CrewEmployer.findById(req.params.id);
    if (!employer) return res.status(404).json({ message: 'Empleador no encontrado' });
    employer.status = 'approved';
    employer.suspendedUntil = null;
    employer.banReason = null;
    employer.rejectionReason = null;
    employer.approvedAt = employer.approvedAt || new Date();
    employer.approvedBy = employer.approvedBy || req.user.id;
    await employer.save();
    res.json({ success: true, employer: { id: employer._id, status: employer.status } });
  } catch (e) {
    logger.error('Error restoring crew employer', e, req);
    res.status(500).json({ message: e.message || 'Error al restaurar' });
  }
});

/* ─────────────────────────────────────────────
 *  CREW — Roster unificado de personas registradas
 *  Une trabajadores + empleadores externos + negocios MenuBy con actividad Crew
 *  en una sola lista, marcando type y source para que SuperAdmin tenga una
 *  vista panorámica de todo el ecosistema.
 *
 *  Filtros:
 *    type=all|worker|crew_employer|menuby_business
 *    source=all|menuby|external
 *    search=texto (busca en nombre/teléfono/email)
 * ───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
 *  CREW — Vacantes (moderación SuperAdmin)
 *  Listado de todas las vacantes con filtros por status y ownerType.
 *  Permite cerrar manualmente vacantes que infringen políticas.
 * ───────────────────────────────────────────── */

router.get('/crew/vacancies', async (req, res) => {
  try {
    const Vacancy = require('../Models/Vacancy');
    const VacancyApplication = require('../Models/VacancyApplication');
    const { status = 'published', ownerType, limit = 80 } = req.query;
    const q = {};
    if (['draft', 'published', 'paused', 'closed', 'expired', 'all'].includes(status) && status !== 'all') {
      q.status = status;
    }
    if (['business', 'crew_employer'].includes(ownerType)) q.ownerType = ownerType;

    const [vacancies, counts, feesAgg] = await Promise.all([
      Vacancy.find(q)
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .populate('businessId', 'businessName slug logo')
        .populate('employerId', 'name kind photo')
        .lean(),
      Vacancy.aggregate([
        { $group: { _id: { status: '$status', ownerType: '$ownerType' }, count: { $sum: 1 } } },
      ]),
      Vacancy.aggregate([
        { $match: { status: { $in: ['published', 'paused', 'closed', 'expired'] } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$publishedAt' } },
          total: { $sum: '$pricePaid' },
          count: { $sum: 1 },
        } },
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ]),
    ]);

    const countsByStatus = {};
    for (const c of counts) {
      const s = c._id.status;
      if (!countsByStatus[s]) countsByStatus[s] = { total: 0, business: 0, crew_employer: 0 };
      countsByStatus[s].total += c.count;
      countsByStatus[s][c._id.ownerType || 'business'] += c.count;
    }

    res.json({ success: true, vacancies, counts: countsByStatus, feesByMonth: feesAgg });
  } catch (error) {
    logger.error('Error listing crew vacancies', error, req);
    res.status(500).json({ message: 'Error al cargar vacantes' });
  }
});

// POST /api/superadmin/crew/vacancies/:id/close — SuperAdmin cierra manualmente
router.post('/crew/vacancies/:id/close', requireRole('admin'), async (req, res) => {
  try {
    const Vacancy = require('../Models/Vacancy');
    const { reason } = req.body || {};
    if (!reason?.trim()) return res.status(400).json({ message: 'Motivo obligatorio' });
    const vacancy = await Vacancy.findById(req.params.id);
    if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });
    if (vacancy.status === 'closed') return res.status(400).json({ message: 'Ya está cerrada' });
    vacancy.status = 'closed';
    vacancy.closedAt = new Date();
    vacancy.closeReason = `[SuperAdmin] ${reason.trim().slice(0, 280)}`;
    await vacancy.save();
    res.json({ success: true, vacancy });
  } catch (e) {
    logger.error('Error closing vacancy', e, req);
    res.status(500).json({ message: e.message || 'Error al cerrar' });
  }
});

router.get('/crew/people', async (req, res) => {
  try {
    const { type = 'all', source = 'all', search = '', limit = 60 } = req.query;
    const lim = Math.min(Number(limit) || 60, 200);
    const ShiftPost = require('../Models/ShiftPost');
    const ShiftBooking = require('../Models/ShiftBooking');

    const wantWorkers = type === 'all' || type === 'worker';
    const wantExternal = (type === 'all' || type === 'crew_employer') && source !== 'menuby';
    const wantMenuBy = (type === 'all' || type === 'menuby_business') && source !== 'external';

    const searchRe = search?.trim()
      ? new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;

    // ─── Workers ───
    // Determinamos su "source" según con quién hayan trabajado:
    //   - Tienen algún booking con BusinessConfig MenuBy → 'menuby'
    //   - Solo tienen bookings con CrewEmployer externo  → 'external'
    //   - Sin bookings aún → 'new'
    let workers = [];
    if (wantWorkers) {
      const q = {};
      if (searchRe) q.$or = [{ name: searchRe }, { phone: searchRe }, { email: searchRe }];

      const list = await Worker.find(q)
        .sort({ createdAt: -1 })
        .limit(lim)
        .select('name phone email photo level xp rating stats status kyc.status createdAt lastLoginAt lastShiftAt university')
        .lean();

      const ids = list.map((w) => w._id);
      // Buscamos qué workers tienen booking con un BusinessConfig MenuBy
      // (businessId no nulo, ownerType=business o ausente para legacy).
      const menubyBookings = await ShiftBooking.aggregate([
        { $match: { workerId: { $in: ids }, businessId: { $ne: null } } },
        { $group: { _id: '$workerId' } },
      ]);
      const externalBookings = await ShiftBooking.aggregate([
        { $match: { workerId: { $in: ids }, employerId: { $ne: null } } },
        { $group: { _id: '$workerId' } },
      ]);
      const menubySet = new Set(menubyBookings.map((b) => String(b._id)));
      const externalSet = new Set(externalBookings.map((b) => String(b._id)));

      workers = list
        .map((w) => {
          const k = String(w._id);
          const hasMenuBy = menubySet.has(k);
          const hasExternal = externalSet.has(k);
          let workerSource;
          if (hasMenuBy && hasExternal) workerSource = 'mixed';
          else if (hasMenuBy) workerSource = 'menuby';
          else if (hasExternal) workerSource = 'external';
          else workerSource = 'new';
          return {
            id: String(w._id),
            type: 'worker',
            source: workerSource,
            name: w.name,
            phone: w.phone,
            email: w.email || null,
            photo: w.photo || null,
            subtitle: w.university || null,
            status: w.status || 'active',
            kycStatus: w.kyc?.status || 'none',
            level: w.level || 1,
            xp: w.xp || 0,
            rating: { avg: w.rating?.avg || 0, count: w.rating?.count || 0 },
            stats: {
              shiftsCompleted: w.stats?.shiftsCompleted || 0,
              hoursWorked: w.stats?.hoursWorked || 0,
              totalEarned: w.stats?.totalEarned || 0,
            },
            createdAt: w.createdAt,
            lastActiveAt: w.lastLoginAt || w.lastShiftAt || w.createdAt,
          };
        })
        .filter((p) => {
          if (source === 'menuby') return p.source === 'menuby' || p.source === 'mixed';
          if (source === 'external') return p.source === 'external' || p.source === 'new';
          return true;
        });
    }

    // ─── Empleadores externos (CrewEmployer) — siempre source: 'external' ───
    let externalEmployers = [];
    if (wantExternal) {
      const q = {};
      if (searchRe) q.$or = [{ name: searchRe }, { phone: searchRe }, { email: searchRe }];
      const list = await CrewEmployer.find(q)
        .sort({ createdAt: -1 })
        .limit(lim)
        .select('kind name phone email photo businessType address status createdAt lastLoginAt crewWallet stats')
        .lean();

      externalEmployers = list.map((e) => ({
        id: String(e._id),
        type: 'crew_employer',
        kind: e.kind, // 'individual' | 'business'
        source: 'external',
        name: e.name,
        phone: e.phone,
        email: e.email || null,
        photo: e.photo || null,
        subtitle: e.kind === 'business' ? (e.businessType || 'Negocio') : 'Persona',
        city: e.address?.city || null,
        status: e.status,
        stats: {
          shiftsPublished: e.stats?.shiftsPublished || 0,
          shiftsCompleted: e.stats?.shiftsCompleted || 0,
          workersHired: e.stats?.workersHired || 0,
          totalSpent: e.crewWallet?.totalSpent || 0,
        },
        createdAt: e.createdAt,
        lastActiveAt: e.lastLoginAt || e.createdAt,
      }));
    }

    // ─── Negocios MenuBy con actividad Crew — source: 'menuby' ───
    // Definición: tiene crewWallet con saldo/movimientos O ha publicado algún shift.
    let menubyEmployers = [];
    if (wantMenuBy) {
      // Negocios que han publicado al menos 1 shift como ownerType=business
      const businessIdsWithShifts = await ShiftPost.distinct('businessId', {
        ownerType: { $in: ['business', null] },
        businessId: { $ne: null },
      });
      const businessIdsWithWallet = await BusinessConfig.distinct('_id', {
        $or: [
          { 'crewWallet.balance': { $gt: 0 } },
          { 'crewWallet.pendingBalance': { $gt: 0 } },
          { 'crewWallet.totalSpent': { $gt: 0 } },
          { 'crewWallet.lastRechargeAt': { $ne: null } },
        ],
      });
      const activeIds = Array.from(new Set([
        ...businessIdsWithShifts.map(String),
        ...businessIdsWithWallet.map(String),
      ]));

      if (activeIds.length) {
        const q = { _id: { $in: activeIds.map((id) => new mongoose.Types.ObjectId(id)) } };
        if (searchRe) q.$or = [{ businessName: searchRe }, { slug: searchRe }];
        const list = await BusinessConfig.find(q)
          .sort({ 'crewWallet.lastRechargeAt': -1, createdAt: -1 })
          .limit(lim)
          .select('businessName slug logo coverImage businessType address contactPhone contactEmail crewWallet createdAt isActive')
          .lean();

        // Conteo de shifts publicados por cada uno
        const shiftCounts = await ShiftPost.aggregate([
          { $match: { businessId: { $in: list.map((b) => b._id) } } },
          { $group: { _id: '$businessId', published: { $sum: 1 } } },
        ]);
        const countsMap = shiftCounts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.published }), {});

        menubyEmployers = list.map((b) => ({
          id: String(b._id),
          type: 'menuby_business',
          kind: 'business',
          source: 'menuby',
          name: b.businessName || b.slug || '—',
          phone: b.contactPhone || null,
          email: b.contactEmail || null,
          photo: b.logo || null,
          subtitle: b.businessType || 'Negocio MenuBy',
          city: b.address?.city || null,
          slug: b.slug || null,
          status: b.isActive === false ? 'suspended' : 'approved',
          stats: {
            shiftsPublished: countsMap[String(b._id)] || 0,
            shiftsCompleted: 0,
            totalSpent: b.crewWallet?.totalSpent || 0,
          },
          createdAt: b.createdAt,
          lastActiveAt: b.crewWallet?.lastRechargeAt || b.createdAt,
        }));
      }
    }

    // ─── Combinar y ordenar por createdAt desc ───
    const people = [...workers, ...externalEmployers, ...menubyEmployers]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, lim);

    // Totales para los chips del filtro
    const [
      totalWorkers,
      totalExternalEmployers,
      totalMenuByActive,
    ] = await Promise.all([
      Worker.estimatedDocumentCount(),
      CrewEmployer.estimatedDocumentCount(),
      ShiftPost.distinct('businessId', {
        ownerType: { $in: ['business', null] },
        businessId: { $ne: null },
      }).then((ids) => ids.length),
    ]);

    res.json({
      success: true,
      people,
      counts: {
        worker: totalWorkers,
        crew_employer: totalExternalEmployers,
        menuby_business: totalMenuByActive,
        all: totalWorkers + totalExternalEmployers + totalMenuByActive,
      },
      shown: people.length,
    });
  } catch (error) {
    logger.error('Error listing crew people', error, req);
    res.status(500).json({ message: error.message || 'Error al cargar personas' });
  }
});

// ── WhatsApp status & QR ─────────────────────────────────────
router.get('/whatsapp/status', requireRole('admin'), async (req, res) => {
  try {
    const { getStatus, getRawQR } = require('../services/whatsappService');
    const currentState = getStatus();
    const rawQR = getRawQR();

    let qrDataUrl = null;
    if (rawQR) {
      const QRCode = require('qrcode');
      qrDataUrl = await QRCode.toDataURL(rawQR, { width: 300, margin: 2 });
    }

    res.json({ state: currentState, qrDataUrl });
  } catch (err) {
    res.json({ state: 'disabled', qrDataUrl: null });
  }
});

router.post('/whatsapp/logout', requireRole('admin'), async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const sessionDir = path.join(__dirname, '../../uploads/whatsapp-session');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    res.json({ success: true, message: 'Sesión eliminada. Reinicia el servidor para reconectar.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 