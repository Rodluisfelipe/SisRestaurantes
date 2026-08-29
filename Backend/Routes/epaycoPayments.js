/**
 * ePayco Payments Route
 * 
 * Endpoints:
 * - GET  /api/epayco/plans          - Obtener planes disponibles con precios
 * - POST /api/epayco/create         - Crear referencia de pago (devuelve datos para checkout)
 * - POST /api/epayco/confirmation   - Webhook de confirmación de ePayco (sin auth)
 * - GET  /api/epayco/response       - URL de respuesta (redirect al frontend)
 * - GET  /api/epayco/status/:ref    - Consultar estado de un pago por referencia
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { isValidObjectId } = require('../utils/validators');
const { resolveBusinessId, requireBusinessId } = require('../utils/businessResolver');
const epaycoService = require('../services/epaycoService');
const { resolvePaymentSelection, inferLegacyPlanTypeFromMonths } = require('../utils/commercialPlans');

// Modelo para guardar referencias de pago ePayco
const epaycoPaymentSchema = new mongoose.Schema({
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
    default: 'created'
  },
  epaycoRef: { type: String, default: null },        // x_ref_payco
  epaycoTransactionId: { type: String, default: null }, // x_transaction_id
  paymentMethod: { type: String, default: null },      // x_franchise o x_business
  responseCode: { type: Number, default: null },       // x_cod_response
  responseMessage: { type: String, default: null },
  rawConfirmation: { type: mongoose.Schema.Types.Mixed, default: null },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });

epaycoPaymentSchema.index({ businessId: 1, createdAt: -1 });
epaycoPaymentSchema.index({ status: 1, createdAt: -1 });

const EpaycoPayment = mongoose.model('EpaycoPayment', epaycoPaymentSchema);

// ============================================
// GET /api/epayco/plans - Planes disponibles
// ============================================
router.get('/plans', (req, res) => {
  if (!epaycoService.isConfigured()) {
    return res.status(503).json({ success: false, message: 'Pasarela de pagos no configurada' });
  }
  
  const plans = epaycoService.getAllPlans();
  res.json({
    success: true,
    plans,
    publicKey: epaycoService.config.publicKey,
    isTest: epaycoService.config.isTest,
  });
});

// ============================================
// POST /api/epayco/create - Crear referencia de pago
// ============================================
router.post('/create', authMiddleware, async (req, res) => {
  try {
    if (!epaycoService.isConfigured()) {
      return res.status(503).json({ success: false, message: 'Pasarela de pagos no configurada' });
    }

    const {
      months,
      plan,
      commercialPlan,
      billingCycle,
      businessId: bodyBusinessId
    } = req.body;
    let businessId = req.user.businessId || bodyBusinessId || req.query.businessId;
    
    // Resolver businessId si no está en el token ni en el body
    if (!businessId && req.user.id) {
      const Admin = require('../Models/Admin');
      const admin = await Admin.findById(req.user.id).select('businessId');
      if (admin?.businessId) {
        businessId = admin.businessId.toString();
      }
    }
    
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No se pudo determinar el negocio' });
    }
    
    // Resolver si es slug
    try {
      businessId = await resolveBusinessId(businessId);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
    
    const paymentSelection = resolvePaymentSelection({
      commercialPlan: commercialPlan || plan,
      billingCycle,
      months
    });

    if (!paymentSelection || paymentSelection.commercialPlan === 'free') {
      return res.status(400).json({
        success: false,
        message: 'Plan no válido. Selecciona Starter, Pro o Pro Max con ciclo mensual o anual.'
      });
    }

    // Validar plan
    const selectedPlan = epaycoService.getPlanDetails(paymentSelection);
    if (!selectedPlan) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan no válido. Selecciona Starter, Pro o Pro Max con ciclo mensual o anual.' 
      });
    }
    
    // Verificar que el negocio existe
    const business = await BusinessConfig.findById(businessId).select('businessName slug');
    if (!business) {
      return res.status(404).json({ success: false, message: 'Negocio no encontrado' });
    }
    
    // Expirar pagos anteriores no completados para este negocio
    await EpaycoPayment.updateMany(
      { businessId, status: 'created' },
      { $set: { status: 'expired' } }
    );
    
    // Generar referencia única
    const reference = epaycoService.generatePaymentReference(businessId, paymentSelection);
    
    // Guardar en BD
    const payment = new EpaycoPayment({
      reference,
      businessId,
      months: selectedPlan.months,
      commercialPlan: paymentSelection.commercialPlan,
      billingCycle: paymentSelection.billingCycle,
      basePrice: selectedPlan.basePrice,
      totalAmount: selectedPlan.total,
      commission: selectedPlan.commission,
      createdBy: req.user.id,
    });
    await payment.save();
    
    // Datos para el checkout de ePayco
    const checkoutData = {
      // Datos del pago
      name: `Suscripción Menuby - ${selectedPlan.label}`,
      description: `Suscripción ${selectedPlan.label} para ${business.businessName}`,
      invoice: reference,
      currency: 'cop',
      amount: selectedPlan.total.toString(),
      tax_base: '0',
      tax: '0',
      tax_ico: '0',
      country: 'co',
      lang: 'es',
      
      // Tipo de checkout
      external: 'true', // true = Redirigir a página de ePayco (más confiable, evita caché del SDK)
      
      // URLs de respuesta
      confirmation: `${process.env.BACKEND_URL || 'https://157-245-125-216.nip.io'}/api/epayco/confirmation`,
      response: `${process.env.BACKEND_URL || 'https://157-245-125-216.nip.io'}/api/epayco/response`,
      
      // ePayco config
      key: epaycoService.config.publicKey,
      test: epaycoService.config.isTest,
      
      // Extra data
      extra1: businessId,
      extra2: selectedPlan.months.toString(),
      extra3: reference,
    };

    logger.info('ePayco payment created', {
      reference,
      businessId,
      commercialPlan: paymentSelection.commercialPlan,
      billingCycle: paymentSelection.billingCycle,
      months: selectedPlan.months,
      total: selectedPlan.total
    });
    
    res.json({
      success: true,
      reference,
      plan: selectedPlan,
      checkoutData,
      business: { name: business.businessName, slug: business.slug },
    });
  } catch (error) {
    logger.error('Error creating ePayco payment', error);
    res.status(500).json({ success: false, message: 'Error al crear referencia de pago' });
  }
});

// ============================================
// POST /api/epayco/confirmation - Webhook ePayco
// ============================================
router.post('/confirmation', async (req, res) => {
  try {
    // ePayco puede enviar datos en body, query, o ambos
    const data = { ...req.query, ...req.body };
    
    logger.info('ePayco confirmation received', {
      x_ref_payco: data.x_ref_payco,
      x_transaction_id: data.x_transaction_id,
      x_amount: data.x_amount,
      x_cod_response: data.x_cod_response,
      x_response: data.x_response,
      x_invoice: data.x_invoice,
      x_extra1: data.x_extra1,
      x_extra2: data.x_extra2,
      x_extra3: data.x_extra3,
    });
    
    // Validar firma
    const isValid = epaycoService.validateConfirmationSignature(data);
    if (!isValid) {
      logger.warn('ePayco invalid signature — REJECTING', { 
        x_ref_payco: data.x_ref_payco,
        x_signature: data.x_signature 
      });
      return res.status(200).send('OK'); // Return 200 (ePayco expects it) but don't process
    }
    
    const reference = data.x_extra3 || data.x_id_invoice || data.x_id_factura || data.x_invoice;
    const responseInfo = epaycoService.interpretResponseCode(data.x_cod_response);
    
    // Buscar el pago en nuestra BD (por referencia o por x_ref_payco)
    let payment = await EpaycoPayment.findOne({ reference });
    if (!payment && data.x_ref_payco) {
      payment = await EpaycoPayment.findOne({ epaycoRef: data.x_ref_payco });
    }
    if (!payment) {
      logger.error('ePayco payment not found for reference', { reference, x_ref_payco: data.x_ref_payco });
      return res.status(200).send('OK'); // Siempre 200 para ePayco
    }
    
    // Evitar procesar pagos ya aprobados (idempotencia)
    if (payment.status === 'approved') {
      logger.info('ePayco payment already approved, skipping', { reference });
      return res.status(200).send('OK');
    }
    
    // Actualizar pago
    payment.status = responseInfo.status;
    payment.epaycoRef = data.x_ref_payco;
    payment.epaycoTransactionId = data.x_transaction_id;
    payment.paymentMethod = data.x_franchise || data.x_business || data.x_type_payment;
    payment.responseCode = parseInt(data.x_cod_response);
    payment.responseMessage = data.x_response;
    payment.rawConfirmation = data;
    await payment.save();
    
    // Si el pago fue APROBADO → activar suscripción automáticamente
    if (responseInfo.status === 'approved') {
      await activateSubscription(payment);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing ePayco confirmation', error);
    res.status(200).send('OK'); // Siempre 200 para ePayco
  }
});

// ============================================
// GET /api/epayco/confirmation - ePayco a veces usa GET
// ============================================
router.get('/confirmation', async (req, res) => {
  try {
    const data = req.query;
    
    logger.info('ePayco confirmation received (GET)', {
      x_ref_payco: data.x_ref_payco,
      x_cod_response: data.x_cod_response,
      x_invoice: data.x_invoice,
      x_extra3: data.x_extra3,
    });
    
    // Validar firma (misma lógica que POST)
    const isValid = epaycoService.validateConfirmationSignature(data);
    if (!isValid) {
      logger.warn('ePayco invalid signature (GET) — REJECTING', {
        x_ref_payco: data.x_ref_payco,
        x_signature: data.x_signature
      });
      return res.status(200).send('OK');
    }
    
    const reference = data.x_extra3 || data.x_id_invoice || data.x_id_factura || data.x_invoice;
    const responseInfo = epaycoService.interpretResponseCode(data.x_cod_response);
    
    let payment = await EpaycoPayment.findOne({ reference });
    if (!payment && data.x_ref_payco) {
      payment = await EpaycoPayment.findOne({ epaycoRef: data.x_ref_payco });
    }
    if (!payment) {
      logger.error('ePayco payment not found (GET)', { reference, x_ref_payco: data.x_ref_payco });
      return res.status(200).send('OK');
    }
    
    if (payment.status === 'approved') {
      return res.status(200).send('OK');
    }
    
    payment.status = responseInfo.status;
    payment.epaycoRef = data.x_ref_payco;
    payment.epaycoTransactionId = data.x_transaction_id;
    payment.paymentMethod = data.x_franchise || data.x_business || data.x_type_payment;
    payment.responseCode = parseInt(data.x_cod_response);
    payment.responseMessage = data.x_response;
    payment.rawConfirmation = data;
    await payment.save();
    
    if (responseInfo.status === 'approved') {
      await activateSubscription(payment);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing ePayco confirmation (GET)', error);
    res.status(200).send('OK');
  }
});

// ============================================
// GET /api/epayco/response - Redirect después del pago
// ============================================
router.get('/response', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://menuby.tech';
  
  try {
    // ePayco puede enviar diferentes parámetros según el modo (standard, onpage, etc.)
    const { ref_payco, x_ref_payco, x_cod_response, x_id_invoice, x_id_factura, x_invoice, x_extra1, x_extra3 } = req.query;
    const reference = x_extra3 || x_id_invoice || x_id_factura || x_invoice;
    const epaycoRef = ref_payco || x_ref_payco;
    let businessId = x_extra1;
    let statusCode = x_cod_response;
    
    logger.info('ePayco response redirect', { ref_payco, epaycoRef, reference, businessId, statusCode, allQuery: req.query });
    
    // Si solo tenemos ref_payco, buscar el pago en nuestra BD
    let payment = null;
    if (reference) {
      payment = await EpaycoPayment.findOne({ reference });
    }
    if (!payment && epaycoRef) {
      payment = await EpaycoPayment.findOne({ epaycoRef });
    }
    // Si aún no encontramos, buscar el último pago no expirado
    if (!payment && !reference && epaycoRef) {
      // Buscar por referencia que contenga el ID del ref_payco en rawConfirmation
      payment = await EpaycoPayment.findOne({ status: { $ne: 'expired' } }).sort({ createdAt: -1 });
    }
    
    if (payment) {
      businessId = businessId || payment.businessId?.toString();
      if (!statusCode && payment.responseCode) statusCode = payment.responseCode.toString();
    }
    
    const finalRef = reference || payment?.reference || epaycoRef || '';
    
    let slug = '';
    if (businessId) {
      try {
        const business = await BusinessConfig.findById(businessId).select('slug');
        if (business?.slug) slug = business.slug;
      } catch (e) {
        logger.warn('Could not resolve slug for businessId', { businessId });
      }
    }
    
    if (slug) {
      res.redirect(`${frontendUrl}/${slug}/payment-result?ref=${encodeURIComponent(finalRef)}&status=${statusCode || ''}`);
    } else {
      res.redirect(`${frontendUrl}/?payment_ref=${encodeURIComponent(finalRef)}&status=${statusCode || ''}`);
    }
  } catch (error) {
    logger.error('Error in ePayco response redirect', error);
    res.redirect(`${frontendUrl}/?payment_error=true`);
  }
});

// ============================================
// GET /api/epayco/status/:ref - Consultar estado
// ============================================
router.get('/status/:ref', authMiddleware, async (req, res) => {
  try {
    const { ref } = req.params;
    const payment = await EpaycoPayment.findOne({ reference: ref });
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }
    
    // Verificar que pertenece al negocio del usuario
    let businessId = req.user.businessId;
    if (!businessId && req.user.id) {
      const Admin = require('../Models/Admin');
      const admin = await Admin.findById(req.user.id).select('businessId');
      if (admin?.businessId) businessId = admin.businessId.toString();
    }
    
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin';
    if (!isSuperAdmin && payment.businessId.toString() !== businessId) {
      return res.status(403).json({ success: false, message: 'Sin permisos' });
    }
    
    res.json({
      success: true,
      payment: {
        reference: payment.reference,
        status: payment.status,
        months: payment.months,
        commercialPlan: payment.commercialPlan,
        billingCycle: payment.billingCycle,
        basePrice: payment.basePrice,
        totalAmount: payment.totalAmount,
        commission: payment.commission,
        epaycoRef: payment.epaycoRef,
        paymentMethod: payment.paymentMethod,
        responseMessage: payment.responseMessage,
        subscriptionId: payment.subscriptionId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching ePayco payment status', error);
    res.status(500).json({ success: false, message: 'Error al consultar estado del pago' });
  }
});

// ============================================
// Función: Activar/Extender suscripción
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
    const { businessId, months, basePrice, reference, commercialPlan, billingCycle } = payment;
    
    const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '1');
    
    // Buscar suscripción existente
    let subscription = await Subscription.findOne({ businessId }).sort({ createdAt: -1 });
    
    const now = new Date();
    let startDate, endDate;
    
    if (subscription) {
      // Si hay suscripción activa, extender desde la fecha de fin actual
      const currentEnd = subscription.periodEnd || subscription.endDate;
      if (currentEnd && currentEnd > now) {
        // Extender desde la fecha de fin actual
        startDate = new Date(currentEnd);
      } else {
        // Suscripción expirada, empezar desde hoy
        startDate = now;
      }
    } else {
      startDate = now;
    }
    
    // Calcular fecha de fin
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    
    // Calcular gracia
    const graceUntil = new Date(endDate);
    graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);
    
    if (subscription) {
      // Actualizar suscripción existente
      subscription.planType = inferLegacyPlanTypeFromMonths(months);
      subscription.commercialPlan = commercialPlan || subscription.commercialPlan;
      subscription.billingCycle = billingCycle || subscription.billingCycle || (months >= 12 ? 'annual' : 'monthly');
      subscription.status = 'active';
      subscription.paymentStatus = 'paid';
      subscription.isActive = true;
      subscription.startDate = subscription.startDate || startDate; // Mantener fecha original
      subscription.endDate = endDate;
      subscription.periodStart = startDate;
      subscription.periodEnd = endDate;
      subscription.graceUntil = graceUntil;
      subscription.price = basePrice;
      subscription.paymentMethod = 'CARD';
      subscription.lastPaymentAt = now;
      subscription.lastMonthsPurchased = months;
      subscription.notes = `ePayco - Ref: ${reference}`;
      subscription.isTrialPeriod = false;
      
      await subscription.save();
    } else {
      // Crear nueva suscripción
      subscription = new Subscription({
        businessId,
        planType: inferLegacyPlanTypeFromMonths(months),
        commercialPlan: commercialPlan || 'pro',
        billingCycle: billingCycle || (months >= 12 ? 'annual' : 'monthly'),
        status: 'active',
        paymentStatus: 'paid',
        isActive: true,
        startDate,
        endDate,
        periodStart: startDate,
        periodEnd: endDate,
        graceUntil,
        price: basePrice,
        paymentMethod: 'CARD',
        lastPaymentAt: now,
        lastMonthsPurchased: months,
        notes: `ePayco - Ref: ${reference}`,
        isTrialPeriod: false,
      });
      
      await subscription.save();
    }
    
    // Guardar referencia de suscripción en el pago
    payment.subscriptionId = subscription._id;
    await payment.save();
    
    // Notificar por socket al admin
    try {
      const io = require('../server').app?.get('io');
      if (io) {
        io.to(`business_${businessId}`).emit('subscription_activated', {
          message: `¡Suscripción activada! ${months} mes(es) hasta ${endDate.toLocaleDateString('es-CO')}`,
          subscription: {
            id: subscription._id,
            status: 'active',
            periodEnd: endDate,
            months,
          },
        });
      }
    } catch (socketError) {
      // Socket notification is best-effort
      logger.warn('Could not send socket notification for subscription activation', { error: socketError.message });
    }
    
    logger.info('Subscription activated via ePayco', {
      businessId: businessId.toString(),
      reference,
      months,
      startDate,
      endDate,
    });

    // Process referral: credit the referrer if this referred business just paid
    try {
      const { processReferralOnPayment, applyReferralCredits } = require('../utils/referralHelper');
      await processReferralOnPayment(businessId, basePrice, months);
      // Apply referrer's own credits to this payment
      const creditResult = await applyReferralCredits(businessId, basePrice);
      if (creditResult.discountApplied > 0) {
        subscription.referralDiscountApplied = creditResult.discountApplied;
        subscription.referralDiscountSource = 'referral_credit';
        await subscription.save();
      }
    } catch (refErr) {
      logger.warn('Non-blocking referral processing error (ePayco)', { error: refErr.message });
    }
    
    return subscription;
  } catch (error) {
    logger.error('Error activating subscription from ePayco payment', error);
    throw error;
  } finally {
    _activationLocks.delete(lockKey);
    releaseLock();
  }
}

// ============================================
// GET /api/epayco/history - Historial de pagos del negocio
// ============================================
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const businessId = await requireBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId requerido' });
    }

    const payments = await EpaycoPayment.find({
      businessId,
      status: { $ne: 'expired' } // No mostrar los expirados (son intentos descartados)
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('reference months commercialPlan billingCycle basePrice totalAmount commission status paymentMethod responseMessage epaycoRef createdAt updatedAt')
    .lean();

    res.json({ success: true, payments });
  } catch (error) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
});

module.exports = router;
