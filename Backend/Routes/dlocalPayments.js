/**
 * dLocal Go Payments Route
 * API docs: https://docs.dlocalgo.com/integration-api
 * 
 * Endpoints:
 * - GET  /api/dlocal/plans         - Planes disponibles con precios dLocal Go
 * - POST /api/dlocal/create        - Crear pago (redirect a dLocal Go checkout)
 * - POST /api/dlocal/webhook       - Webhook notification de dLocal Go (recibe {payment_id})
 * - GET  /api/dlocal/status/:ref   - Consultar estado de un pago
 * - GET  /api/dlocal/history       - Historial de pagos del negocio
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { resolveBusinessId, requireBusinessId } = require('../utils/businessResolver');
const dlocalService = require('../services/dlocalService');
const { resolvePaymentSelection, inferLegacyPlanTypeFromMonths } = require('../utils/commercialPlans');

// Modelo para guardar referencias de pago dLocal Go
const dlocalPaymentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessConfig', required: true },
  months: { type: Number, required: true },
  commercialPlan: { type: String, enum: ['starter', 'pro', 'pro_max'], required: true },
  billingCycle: { type: String, enum: ['monthly', 'annual'], required: true },
  basePrice: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  commission: { type: Number, required: true },
  status: {
    type: String,
    enum: ['created', 'approved', 'rejected', 'pending', 'failed', 'reversed', 'cancelled', 'expired'],
    default: 'created',
  },
  dlocalPaymentId: { type: String, default: null },
  paymentMethod: { type: String, default: null },
  redirectUrl: { type: String, default: null },
  responseMessage: { type: String, default: null },
  rawNotification: { type: mongoose.Schema.Types.Mixed, default: null },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  slug: { type: String, default: null },
}, { timestamps: true });

dlocalPaymentSchema.index({ businessId: 1, createdAt: -1 });
dlocalPaymentSchema.index({ status: 1, createdAt: -1 });
dlocalPaymentSchema.index({ dlocalPaymentId: 1 });

const DlocalPayment = mongoose.model('DlocalPayment', dlocalPaymentSchema);

// ============================================
// GET /api/dlocal/plans
// ============================================
router.get('/plans', (req, res) => {
  if (!dlocalService.isConfigured()) {
    return res.status(503).json({ success: false, message: 'dLocal Go no está configurado' });
  }
  const plans = dlocalService.getPlans();
  res.json({
    success: true,
    plans,
    smartFieldsKey: dlocalService.config.smartFieldsKey,
    isTest: dlocalService.config.isTest,
    gateway: 'dlocal',
  });
});

// ============================================
// POST /api/dlocal/create
// ============================================
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { months, plan, commercialPlan, billingCycle } = req.body;
    const businessId = await requireBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId requerido' });
    }
    const paymentSelection = resolvePaymentSelection({
      commercialPlan: commercialPlan || plan,
      billingCycle,
      months
    });
    if (!paymentSelection || paymentSelection.commercialPlan === 'free') {
      return res.status(400).json({ success: false, message: 'Plan o ciclo inválido' });
    }

    // Expirar pagos viejos en estado "created" (más de 30 min)
    await DlocalPayment.updateMany(
      { businessId, status: 'created', createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } },
      { status: 'expired' }
    );

    const selectedPlan = dlocalService.getPlanDetails(paymentSelection);
    if (!selectedPlan) {
      return res.status(400).json({ success: false, message: 'Plan no encontrado' });
    }

    const reference = dlocalService.generatePaymentReference(businessId, paymentSelection);

    // Info del negocio
    const business = await BusinessConfig.findById(businessId);
    const slug = business?.slug || businessId.toString();

    const BACKEND_URL = process.env.BACKEND_URL || 'https://157-245-125-216.nip.io';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menuby.tech';

    // Crear registro en BD
    const payment = new DlocalPayment({
      reference,
      businessId,
      months: selectedPlan.months,
      commercialPlan: paymentSelection.commercialPlan,
      billingCycle: paymentSelection.billingCycle,
      basePrice: selectedPlan.basePrice,
      totalAmount: selectedPlan.total,
      commission: selectedPlan.commission,
      createdBy: req.user?._id,
      slug,
    });
    await payment.save();

    // dLocal Go API: POST /v1/payments
    // Auth: Bearer API_KEY:SECRET_KEY
    const paymentBody = {
      amount: selectedPlan.total,
      currency: 'COP',
      country: 'CO',
      order_id: reference,
      description: `Suscripción ${selectedPlan.label} - ${business?.businessName || slug}`,
      notification_url: `${BACKEND_URL}/api/dlocal/webhook`,
      success_url: `${FRONTEND_URL}/${slug}/payment-result?ref=${reference}&gw=dlocal&status=1`,
      back_url: `${FRONTEND_URL}/${slug}/payment-result?ref=${reference}&gw=dlocal&status=2`,
    };

    const headers = dlocalService.generateAuthHeaders();

    logger.info('dLocal Go: Creating payment', {
      reference,
      amount: selectedPlan.total,
      url: `${dlocalService.config.baseUrl}/v1/payments`
    });

    const dlocalRes = await axios.post(
      `${dlocalService.config.baseUrl}/v1/payments`,
      paymentBody,
      { headers, timeout: 15000 }
    );

    const dlocalData = dlocalRes.data;

    // Actualizar registro con respuesta de dLocal Go
    payment.dlocalPaymentId = dlocalData.id;
    payment.redirectUrl = dlocalData.redirect_url;
    await payment.save();

    logger.info('dLocal Go payment created', {
      reference,
      dlocalId: dlocalData.id,
      commercialPlan: paymentSelection.commercialPlan,
      billingCycle: paymentSelection.billingCycle,
      months: selectedPlan.months,
      total: selectedPlan.total,
      redirectUrl: dlocalData.redirect_url ? 'yes' : 'no',
    });

    res.json({
      success: true,
      reference,
      redirectUrl: dlocalData.redirect_url,
      gateway: 'dlocal',
    });

  } catch (error) {
    const respData = error.response?.data;
    const errMsg = (typeof respData === 'object' && respData !== null)
      ? (respData.message || respData.description || respData.error || JSON.stringify(respData).substring(0, 300))
      : (typeof respData === 'string' ? respData.substring(0, 300) : error.message);
    logger.error('Error creating dLocal Go payment:', {
      status: error.response?.status,
      message: errMsg,
    });
    res.status(500).json({
      success: false,
      message: `Error al crear pago con dLocal: ${errMsg}`,
    });
  }
});

// ============================================
// POST /api/dlocal/webhook - Notificación de dLocal Go
// dLocal Go envía: { "payment_id": "DP-xxx" }
// Debemos consultar GET /v1/payments/:id para obtener el estado
// ============================================
router.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    const authHeader = req.headers['authorization'] || '';

    logger.info('dLocal Go webhook received', { body: JSON.stringify(data).substring(0, 200) });

    // Verificar firma HMAC (Authorization header) — OBLIGATORIA
    if (!authHeader) {
      logger.warn('dLocal Go webhook: missing Authorization header — REJECTING');
      return res.status(200).json({ ok: true });
    }
    
    const signaturePart = authHeader.replace('V2-HMAC-SHA256, Signature: ', '').trim();
    if (!signaturePart || signaturePart === authHeader) {
      logger.warn('dLocal Go webhook: malformed Authorization header — REJECTING');
      return res.status(200).json({ ok: true });
    }
    
    const bodyStr = JSON.stringify(data);
    if (!dlocalService.verifyWebhookSignature(bodyStr, signaturePart)) {
      logger.warn('dLocal Go webhook: firma inválida — REJECTING');
      return res.status(200).json({ ok: true });
    }

    const paymentId = data.payment_id;
    if (!paymentId) {
      logger.warn('dLocal Go webhook: sin payment_id', { body: data });
      return res.status(200).json({ ok: true });
    }

    // Buscar pago por dlocalPaymentId
    let payment = await DlocalPayment.findOne({ dlocalPaymentId: paymentId });
    if (!payment) {
      logger.warn('dLocal Go webhook: pago no encontrado por dlocalPaymentId, buscando por order_id...', { paymentId });
      // Intentar buscando en la API de dLocal Go para obtener el order_id
    }

    // Consultar estado completo del pago en dLocal Go: GET /v1/payments/:id
    let paymentDetails = null;
    try {
      const headers = dlocalService.generateAuthHeaders();
      const statusRes = await axios.get(
        `${dlocalService.config.baseUrl}/v1/payments/${paymentId}`,
        { headers, timeout: 10000 }
      );
      paymentDetails = statusRes.data;
      logger.info('dLocal Go webhook: payment details', {
        id: paymentDetails.id,
        status: paymentDetails.status,
        order_id: paymentDetails.order_id,
      });
    } catch (e) {
      logger.error('dLocal Go webhook: error fetching payment details', { paymentId, error: e.message });
    }

    // Si no lo encontramos por dlocalPaymentId, buscar por order_id (reference)
    if (!payment && paymentDetails?.order_id) {
      payment = await DlocalPayment.findOne({ reference: paymentDetails.order_id });
    }

    if (!payment) {
      logger.warn('dLocal Go webhook: pago no encontrado en BD', { paymentId });
      return res.status(200).json({ ok: true });
    }

    // Mapear estados de dLocal Go → nuestros estados
    const STATUS_MAP = {
      'PAID': 'approved',
      'COMPLETED': 'approved',
      'AUTHORIZED': 'approved',
      'VERIFIED': 'approved',
      'PENDING': 'pending',
      'REJECTED': 'rejected',
      'CANCELLED': 'cancelled',
      'EXPIRED': 'expired',
      'REFUNDED': 'reversed',
    };

    if (paymentDetails) {
      const newStatus = STATUS_MAP[paymentDetails.status] || 'pending';
      const wasAlreadyApproved = payment.status === 'approved';

      payment.status = newStatus;
      payment.dlocalPaymentId = paymentDetails.id || payment.dlocalPaymentId;
      payment.paymentMethod = paymentDetails.payment_method_type || payment.paymentMethod;
      payment.responseMessage = paymentDetails.status;
      payment.rawNotification = paymentDetails;
      await payment.save();

      // Activar suscripción si aprobado y no se ha activado
      if (newStatus === 'approved' && !wasAlreadyApproved && !payment.subscriptionId) {
        try {
          await activateSubscription(payment);
          logger.info('Subscription activated via dLocal Go webhook', { reference: payment.reference });
        } catch (err) {
          logger.error('Error activating subscription from dLocal Go webhook:', err.message);
        }
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('dLocal Go webhook error:', error.message);
    res.status(200).json({ ok: true }); // Siempre acknowledge
  }
});

// ============================================
// GET /api/dlocal/status/:ref
// ============================================
router.get('/status/:ref', authMiddleware, async (req, res) => {
  try {
    const payment = await DlocalPayment.findOne({ reference: req.params.ref });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }

    // Si sigue en created y tenemos dlocalPaymentId, consultar API
    if (payment.dlocalPaymentId && (payment.status === 'created' || payment.status === 'pending')) {
      try {
        const headers = dlocalService.generateAuthHeaders();
        const statusRes = await axios.get(
          `${dlocalService.config.baseUrl}/v1/payments/${payment.dlocalPaymentId}`,
          { headers, timeout: 10000 }
        );

        const STATUS_MAP = {
          'PAID': 'approved', 'COMPLETED': 'approved', 'AUTHORIZED': 'approved',
          'VERIFIED': 'approved', 'PENDING': 'pending', 'REJECTED': 'rejected',
          'CANCELLED': 'cancelled', 'EXPIRED': 'expired',
        };
        const newStatus = STATUS_MAP[statusRes.data.status] || payment.status;
        if (newStatus !== payment.status) {
          payment.status = newStatus;
          payment.paymentMethod = statusRes.data.payment_method_type || payment.paymentMethod;
          payment.responseMessage = statusRes.data.status;
          await payment.save();

          if (newStatus === 'approved' && !payment.subscriptionId) {
            await activateSubscription(payment);
          }
        }
      } catch (e) {
        logger.warn('Could not check dLocal Go payment status:', e.message);
      }
    }

    res.json({
      success: true,
      payment: {
        reference: payment.reference,
        months: payment.months,
        commercialPlan: payment.commercialPlan,
        billingCycle: payment.billingCycle,
        status: payment.status,
        totalAmount: payment.totalAmount,
        paymentMethod: payment.paymentMethod,
        responseMessage: payment.responseMessage,
        createdAt: payment.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error consultando pago' });
  }
});

// ============================================
// GET /api/dlocal/history
// ============================================
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const businessId = await requireBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId requerido' });
    }

    const payments = await DlocalPayment.find({
      businessId,
      status: { $ne: 'expired' },
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('reference months commercialPlan billingCycle basePrice totalAmount commission status paymentMethod dlocalPaymentId responseMessage createdAt updatedAt')
    .lean();

    res.json({ success: true, payments, gateway: 'dlocal' });
  } catch (error) {
    logger.error('Error fetching dLocal payment history:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
});

// ============================================
// Activar suscripción (misma lógica que ePayco)
// Per-businessId lock prevents race conditions from concurrent webhooks
// ============================================
const _activationLocks = new Map();

async function activateSubscription(payment) {
  const lockKey = payment.businessId.toString();
  
  // Wait for any ongoing activation for this business
  while (_activationLocks.has(lockKey)) {
    await _activationLocks.get(lockKey);
  }
  
  let releaseLock;
  const lockPromise = new Promise(r => { releaseLock = r; });
  _activationLocks.set(lockKey, lockPromise);
  
  try {
  const { businessId, months, reference, totalAmount, commercialPlan, billingCycle } = payment;

  const now = new Date();
  let sub = await Subscription.findOne({ businessId });

  // Si ya existe y tiene vigencia futura, extender desde esa fecha
  const startDate = (sub?.periodEnd && new Date(sub.periodEnd) > now)
    ? new Date(sub.periodEnd)
    : now;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '1');
  const graceUntil = new Date(endDate);
  graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);

  if (sub) {
    sub.status = 'active';
    sub.planType = inferLegacyPlanTypeFromMonths(months);
    sub.commercialPlan = commercialPlan || sub.commercialPlan;
    sub.billingCycle = billingCycle || sub.billingCycle || (months >= 12 ? 'annual' : 'monthly');
    sub.startDate = sub.startDate || now;
    sub.endDate = endDate;
    sub.periodStart = startDate;
    sub.periodEnd = endDate;
    sub.graceUntil = graceUntil;
    sub.price = totalAmount;
    sub.paymentMethod = 'OTHER'; // dLocal Go
    sub.paymentStatus = 'paid';
    sub.isActive = true;
    sub.lastPaymentAt = now;
    sub.lastMonthsPurchased = months;
    await sub.save();
  } else {
    sub = new Subscription({
      businessId,
      planType: inferLegacyPlanTypeFromMonths(months),
      commercialPlan: commercialPlan || 'pro',
      billingCycle: billingCycle || (months >= 12 ? 'annual' : 'monthly'),
      status: 'active',
      startDate: now,
      endDate,
      periodStart: now,
      periodEnd: endDate,
      graceUntil,
      price: totalAmount,
      paymentMethod: 'OTHER',
      paymentStatus: 'paid',
      isActive: true,
      lastPaymentAt: now,
      lastMonthsPurchased: months,
    });
    await sub.save();
  }

  payment.subscriptionId = sub._id;
  await payment.save();

  // Notificación por socket
  try {
    const io = require('../server').io;
    if (io) {
      io.to(`business_${businessId}`).emit('subscription_activated', {
        message: `¡Suscripción de ${months} mes(es) activada con dLocal Go!`,
        subscription: {
          id: sub._id,
          status: 'active',
          periodEnd: endDate,
          months,
        },
      });
    }
  } catch (socketError) {
    logger.warn('Socket notification failed for dLocal activation', { error: socketError.message });
  }

  logger.info('Subscription activated via dLocal Go', {
    businessId: businessId.toString(),
    reference,
    months,
    startDate,
    endDate,
  });

  // Process referral: credit the referrer if this referred business just paid
  try {
    const { processReferralOnPayment, applyReferralCredits } = require('../utils/referralHelper');
    await processReferralOnPayment(businessId, totalAmount, months);
    // Apply referrer's own credits to this payment
    const creditResult = await applyReferralCredits(businessId, totalAmount);
    if (creditResult.discountApplied > 0) {
      sub.referralDiscountApplied = creditResult.discountApplied;
      sub.referralDiscountSource = 'referral_credit';
      await sub.save();
    }
  } catch (refErr) {
    logger.warn('Non-blocking referral processing error (dLocal)', { error: refErr.message });
  }

  return sub;
  } finally {
    _activationLocks.delete(lockKey);
    releaseLock();
  }
}

module.exports = router;
