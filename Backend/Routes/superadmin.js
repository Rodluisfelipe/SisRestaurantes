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

// Eliminar negocio — solo admin+ (destructivo)
router.delete('/business/:id', requireRole('admin'), superadmin.eliminarNegocio);

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

// GET /api/superadmin/crew/recharges?status=pending — cola de recargas con comprobante
router.get('/crew/recharges', async (req, res) => {
  try {
    const { status = 'pending', limit = 100 } = req.query;
    const q = {};
    if (['pending', 'approved', 'rejected'].includes(status)) q.status = status;
    const [requests, counts] = await Promise.all([
      CrewRechargeRequest.find(q)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit), 200))
        .populate('businessId', 'businessName slug crewWallet')
        .populate('reviewedBy', 'email name')
        .lean(),
      CrewRechargeRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);
    const countsByStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: { count: c.count, total: c.total } }), {});
    res.json({ success: true, requests, counts: countsByStatus });
  } catch (error) {
    logger.error('Error listing crew recharges', error, req);
    res.status(500).json({ message: 'Error al cargar recargas' });
  }
});

// POST /api/superadmin/crew/recharges/:id/approve — acredita y deja trace en ledger
router.post('/crew/recharges/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const reqDoc = await CrewRechargeRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'Solicitud no encontrada' });
    if (reqDoc.status !== 'pending') {
      return res.status(400).json({ message: `Solicitud en estado ${reqDoc.status}` });
    }

    // Idempotencia: si se hace doble click, no duplicamos el crédito.
    const result = await crewLedger.depositBusinessWallet({
      businessId: reqDoc.businessId,
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
      io.to(String(reqDoc.businessId)).emit('crew-wallet-updated', { wallet: result.wallet });
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

module.exports = router; 