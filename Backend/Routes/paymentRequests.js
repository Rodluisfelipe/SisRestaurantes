const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const PaymentRequest = require('../Models/PaymentRequest');
const Subscription = require('../Models/Subscription');
const Admin = require('../Models/Admin');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const authMiddleware = require('../middleware/authMiddleware');
const { isValidObjectId } = require('../utils/validators');
const { resolveBusinessId } = require('../utils/businessResolver');
const { PAYMENT_REQUEST_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const socketService = require('../services/socketService');
const { calculateSubscriptionStatus, GRACE_DAYS } = require('../utils/subscriptionHelper');
const sanitizeUpload = require('../middleware/sanitizeUpload');
const {
  resolvePaymentSelection,
  getCyclePrice,
  getCycleMonths,
  getPlanConfig,
  inferLegacyPlanTypeFromMonths,
  resolveSubscriptionCommercialPlan,
  resolveSubscriptionBillingCycle
} = require('../utils/commercialPlans');
const { getBusinessResourceUsage, mapUsageWithLimits } = require('../utils/subscriptionUsage');

// Configurar multer para subida de comprobantes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/proofs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG) o PDF'));
    }
  }
});

// GET /api/subscription/me - Obtener estado de suscripción actual (para admin autenticado)
router.get('/subscription/me', authMiddleware, async (req, res) => {
  try {
    let businessId = req.user.businessId;
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin';
    
    // Si no hay businessId en el token y no es superadmin, intentar obtenerlo de la base de datos
    if (!businessId && !isSuperAdmin && req.user.id) {
      try {
        const admin = await Admin.findById(req.user.id).select('businessId');
        if (admin && admin.businessId) {
          businessId = admin.businessId.toString();
        }
      } catch (error) {
        logger.error('Error fetching businessId from Admin', error, req);
      }
    }
    
    // Si es SuperAdmin y tiene query param, usar ese
    if (!businessId && isSuperAdmin && req.query.businessId) {
      businessId = req.query.businessId;
    }
    
    if (!businessId) {
      return res.json({
        success: true,
        hasSubscription: false,
        subscription: null,
        message: 'No se pudo determinar el negocio o no hay suscripción activa'
      });
    }
    
    if (!isValidObjectId(businessId)) {
      return res.status(400).json(formatHttpError(req, 'ID de negocio inválido', 400));
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 });
    
    if (!subscription) {
      return res.json({
        success: true,
        hasSubscription: false,
        subscription: null,
        message: 'No tienes una suscripción activa'
      });
    }
    
    const { status: currentStatus, periodEnd: periodEndDate, graceUntil: graceUntilDate } = calculateSubscriptionStatus(subscription);
    const resolvedCommercialPlan = resolveSubscriptionCommercialPlan(subscription);
    const resolvedBillingCycle = resolveSubscriptionBillingCycle(subscription);
    const planConfig = getPlanConfig(resolvedCommercialPlan);
    const usageValues = await getBusinessResourceUsage(businessId);
    const usage = mapUsageWithLimits(planConfig, usageValues);
    
    res.json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription._id,
        _id: subscription._id,
        businessId: subscription.businessId,
        planType: subscription.planType,
        commercialPlan: resolvedCommercialPlan,
        billingCycle: resolvedBillingCycle,
        usage,
        status: currentStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        periodStart: subscription.periodStart || subscription.startDate,
        periodEnd: periodEndDate,
        graceUntil: graceUntilDate,
        price: subscription.price,
        paymentStatus: subscription.paymentStatus,
        gracePeriodEnd: graceUntilDate,
        isInGracePeriod: currentStatus === 'grace',
        daysRemaining: subscription.getDaysRemaining ? subscription.getDaysRemaining() : 
          (periodEndDate ? Math.ceil((new Date(periodEndDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0),
        graceDaysRemaining: subscription.getGraceDaysRemaining ? subscription.getGraceDaysRemaining() : 
          (graceUntilDate ? (() => {
            const now = new Date();
            const graceDate = new Date(graceUntilDate);
            const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const graceNormalized = new Date(graceDate.getFullYear(), graceDate.getMonth(), graceDate.getDate());
            const diffTime = graceNormalized - nowNormalized;
            const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return Math.max(0, daysDiff);
          })() : 0),
        isActive: subscription.isActive || (currentStatus === 'active'),
        isTrialPeriod: subscription.isTrialPeriod,
        lastPaymentAt: subscription.lastPaymentAt,
        lastMonthsPurchased: subscription.lastMonthsPurchased,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la suscripción', 500));
  }
});

// POST /api/payments/manual/request - Crear solicitud de pago manual
router.post('/payments/manual/request', authMiddleware, upload.single('proof'), sanitizeUpload({ maxWidth: 1600, quality: 90 }), async (req, res) => {
  try {
    const {
      monthsPurchased,
      amount,
      paymentMethod,
      commercialPlan,
      plan,
      billingCycle,
      cycle,
      businessId: bodyBusinessId
    } = req.body;

    const paymentSelection = resolvePaymentSelection({
      commercialPlan: commercialPlan || plan,
      billingCycle: billingCycle || cycle,
      months: monthsPurchased
    });
    
    let businessId = req.user.businessId;
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin';
    
    logger.info('POST /payments/manual/request', {
      hasTokenBusinessId: !!businessId,
      isSuperAdmin,
      userId: req.user.id,
      userRole: req.user.role,
      bodyBusinessId: bodyBusinessId,
      bodyKeys: Object.keys(req.body || {}),
      hasBody: !!req.body
    }, req);
    
    // Si no hay businessId en el token y no es superadmin, intentar obtenerlo de la base de datos
    if (!businessId && !isSuperAdmin && req.user.id) {
      try {
        const admin = await Admin.findById(req.user.id).select('businessId');
        if (admin && admin.businessId) {
          businessId = admin.businessId.toString();
        }
      } catch (error) {
        logger.error('Error fetching businessId from Admin', error, req);
      }
    }
    
    // Si es SuperAdmin, puede pasar businessId en el body
    if (!businessId && isSuperAdmin && bodyBusinessId) {
      businessId = bodyBusinessId;
    }
    
    // Si tenemos un businessId (del token, Admin, o body), intentar resolverlo (puede ser slug o ObjectId)
    if (businessId) {
      try {
        // Resolver businessId si es un slug (convertir a ObjectId)
        businessId = await resolveBusinessId(businessId);
      } catch (error) {
        logger.warn('Error resolving businessId in /payments/manual/request', { 
          originalBusinessId: businessId, 
          error: error.message 
        }, req);
        // Si hay un archivo subido, eliminarlo
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            logger.error('Error deleting uploaded file', unlinkError, req);
          }
        }
        return res.status(400).json(formatHttpError(req, 'ID de negocio inválido o no encontrado', 400));
      }
    }
    
    if (!businessId) {
      // Si hay un archivo subido, eliminarlo
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file', unlinkError, req);
        }
      }
      return res.status(400).json(formatHttpError(req, 'No se pudo determinar el negocio. Por favor, contacta al administrador.', 400));
    }
    
    // Validar que el businessId resuelto sea un ObjectId válido
    if (!isValidObjectId(businessId)) {
      // Si hay un archivo subido, eliminarlo
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting uploaded file', unlinkError, req);
        }
      }
      return res.status(400).json(formatHttpError(req, 'ID de negocio inválido', 400));
    }
    
    if (!req.file) {
      return res.status(400).json(formatHttpError(req, 'Comprobante de pago requerido', 400));
    }
    
    if (!paymentSelection || paymentSelection.commercialPlan === 'free' || !paymentMethod) {
      // Eliminar archivo si faltan datos
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error deleting uploaded file', unlinkError, req);
      }
      return res.status(400).json(formatHttpError(req, 'Debes seleccionar plan (Starter, Pro o Pro Max), ciclo y método de pago', 400));
    }

    const expectedAmount = getCyclePrice(paymentSelection.commercialPlan, paymentSelection.billingCycle);
    const parsedAmount = Number.parseFloat(amount);
    const normalizedAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : expectedAmount;

    // Evita manipulación del monto en la solicitud manual.
    if (Math.abs(normalizedAmount - expectedAmount) > 500) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error deleting uploaded file', unlinkError, req);
      }
      return res.status(400).json(formatHttpError(req, 'El monto no coincide con el plan seleccionado', 400));
    }
    
    // Verificar si ya hay una solicitud pendiente
    const hasPending = await PaymentRequest.hasPendingRequest(businessId);
    if (hasPending) {
      // Eliminar archivo si ya hay una solicitud pendiente
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error deleting uploaded file', unlinkError, req);
      }
      return res.status(400).json(formatHttpError(req, 'Ya tienes una solicitud de pago pendiente. Por favor, espera a que sea revisada.', 400));
    }
    
    const proofUrl = `/uploads/proofs/${req.file.filename}`;
    
    const paymentRequest = new PaymentRequest({
      businessId,
      amount: normalizedAmount,
      commercialPlan: paymentSelection.commercialPlan,
      billingCycle: paymentSelection.billingCycle,
      monthsPurchased: paymentSelection.months,
      paymentMethod,
      proofUrl,
      status: PAYMENT_REQUEST_STATUS.PENDING
    });
    
    await paymentRequest.save();
    
    logger.info('Payment request created', { 
      requestId: paymentRequest._id, 
      businessId,
      amount: paymentRequest.amount,
      monthsPurchased: paymentRequest.monthsPurchased,
      commercialPlan: paymentRequest.commercialPlan,
      billingCycle: paymentRequest.billingCycle
    }, req);
    
    res.status(201).json({
      success: true,
      message: 'Solicitud de pago creada exitosamente. Será revisada por el administrador.',
      request: {
        id: paymentRequest._id,
        amount: paymentRequest.amount,
        monthsPurchased: paymentRequest.monthsPurchased,
        commercialPlan: paymentRequest.commercialPlan,
        billingCycle: paymentRequest.billingCycle,
        paymentMethod: paymentRequest.paymentMethod,
        status: paymentRequest.status,
        createdAt: paymentRequest.createdAt
      }
    });
  } catch (error) {
    // Eliminar archivo en caso de error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Error deleting uploaded file', unlinkError, req);
      }
    }
    logger.error('Error creating payment request', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear solicitud de pago', 500));
  }
});

// GET /api/payments/manual/my-requests - Obtener mis solicitudes de pago (para admin autenticado)
router.get('/payments/manual/my-requests', authMiddleware, async (req, res) => {
  try {
    let businessId = req.user.businessId;
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin';
    
    // Si no hay businessId en el token y no es superadmin, intentar obtenerlo de la base de datos
    if (!businessId && !isSuperAdmin && req.user.id) {
      try {
        const admin = await Admin.findById(req.user.id).select('businessId');
        if (admin && admin.businessId) {
          businessId = admin.businessId.toString();
        }
      } catch (error) {
        logger.error('Error fetching businessId from Admin', error, req);
      }
    }
    
    // Si es SuperAdmin y tiene query param, usar ese
    if (!businessId && isSuperAdmin && req.query.businessId) {
      businessId = req.query.businessId;
    }
    
    if (!businessId) {
      return res.json({
        success: true,
        requests: []
      });
    }
    
    if (!isValidObjectId(businessId)) {
      return res.status(400).json(formatHttpError(req, 'ID de negocio inválido', 400));
    }
    
    const requests = await PaymentRequest.find({ businessId })
      .sort({ createdAt: -1 })
      .populate('businessId', 'businessName slug');
    
    res.json({
      success: true,
      requests: requests.map(req => ({
        id: req._id,
        _id: req._id,
        amount: req.amount,
        monthsPurchased: req.monthsPurchased,
        commercialPlan: req.commercialPlan,
        billingCycle: req.billingCycle,
        paymentMethod: req.paymentMethod,
        proofUrl: req.proofUrl,
        status: req.status,
        reviewedAt: req.reviewedAt,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching payment requests', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener solicitudes de pago', 500));
  }
});

// ========== RUTAS DE SUPERADMIN ==========

// GET /api/admin/payment-requests - Obtener todas las solicitudes de pago (SuperAdmin)
router.get('/admin/payment-requests', protectSuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    if (status && [PAYMENT_REQUEST_STATUS.PENDING, PAYMENT_REQUEST_STATUS.APPROVED, PAYMENT_REQUEST_STATUS.REJECTED].includes(status)) {
      query.status = status;
    }
    
    const requests = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('businessId', 'businessName slug')
      .populate('reviewedBy', 'username email');
    
    res.json({
      success: true,
      requests: requests.map(req => {
        const requestObj = req.toObject ? req.toObject() : req;
        return {
          id: requestObj._id?.toString() || requestObj.id,
          _id: requestObj._id?.toString() || requestObj.id,
          businessId: requestObj.businessId,
          businessName: requestObj.businessId?.businessName || (typeof requestObj.businessId === 'object' && requestObj.businessId?.toString()) || requestObj.businessId?.toString() || 'N/A',
          amount: requestObj.amount,
          monthsPurchased: requestObj.monthsPurchased,
          commercialPlan: requestObj.commercialPlan,
          billingCycle: requestObj.billingCycle,
          paymentMethod: requestObj.paymentMethod,
          proofUrl: requestObj.proofUrl,
          proof: requestObj.proofUrl, // Alias para compatibilidad
          status: requestObj.status,
          reviewedBy: requestObj.reviewedBy,
          reviewedAt: requestObj.reviewedAt,
          rejectionReason: requestObj.rejectionReason,
          notes: requestObj.notes,
          createdAt: requestObj.createdAt,
          updatedAt: requestObj.updatedAt
        };
      })
    });
  } catch (error) {
    logger.error('Error fetching payment requests (admin)', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener solicitudes de pago', 500));
  }
});

// POST /api/admin/payment-requests/:id/approve - Aprobar solicitud de pago (SuperAdmin)
router.post('/admin/payment-requests/:id/approve', protectSuperAdmin, async (req, res) => {
  let paymentRequest = null; // Declarar fuera del try para acceso en catch
  
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'ID de solicitud inválido', 400));
    }
    
    paymentRequest = await PaymentRequest.findById(id);
    if (!paymentRequest) {
      return res.status(404).json(formatHttpError(req, 'Solicitud de pago no encontrada', 404));
    }
    
    if (paymentRequest.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      return res.status(400).json(formatHttpError(req, 'Esta solicitud ya ha sido procesada', 400));
    }
    
    const businessId = paymentRequest.businessId;
    const now = new Date();
    const purchasedMonths = paymentRequest.monthsPurchased || getCycleMonths(paymentRequest.billingCycle);
    const selectedCommercialPlan = paymentRequest.commercialPlan || 'pro';
    const selectedBillingCycle = paymentRequest.billingCycle || (purchasedMonths >= 12 ? 'annual' : 'monthly');
    
    // Asegurar que businessId es ObjectId (convertir si es necesario)
    let businessObjectId = businessId;
    if (typeof businessId === 'string') {
      // Ya es string, usarlo directamente
      businessObjectId = businessId;
    } else if (businessId && businessId.toString) {
      businessObjectId = businessId.toString();
    } else {
      businessObjectId = String(businessId);
    }
    
    // Buscar o crear suscripción
    // Usar mongoose.Types.ObjectId si es necesario para la búsqueda
    let subscription;
    
    try {
      // Intentar buscar con ObjectId si es posible
      if (mongoose.Types.ObjectId.isValid(businessObjectId)) {
        subscription = await Subscription.findOne({ 
          businessId: new mongoose.Types.ObjectId(businessObjectId)
        }).sort({ createdAt: -1 });
      } else {
        subscription = await Subscription.findOne({ businessId: businessObjectId })
          .sort({ createdAt: -1 });
      }
    } catch (findError) {
      logger.error('Error finding subscription', { error: findError.message, businessId: businessObjectId }, req);
      // Continuar para crear nueva suscripción si no se encuentra
      subscription = null;
    }
    
    if (subscription) {
      // ACTUALIZAR suscripción existente con datos del PAGO (prioridad sobre manual)
      // Si hay una suscripción manual, se actualiza con los datos del pago real
      const currentPeriodEnd = subscription.periodEnd || subscription.endDate;
      
      let newPeriodEnd;
      let newPeriodStart;
      
      // Si hay una fecha de vencimiento existente Y aún está activa/en gracia, extender desde ahí
      // Si ya está vencida, empezar desde hoy
      if (currentPeriodEnd && now <= currentPeriodEnd) {
        // Aún está activa, extender desde periodEnd
        newPeriodEnd = new Date(currentPeriodEnd);
        const targetMonth = newPeriodEnd.getMonth() + purchasedMonths;
        const targetYear = newPeriodEnd.getFullYear() + Math.floor(targetMonth / 12);
        const finalMonth = targetMonth % 12;
        newPeriodEnd = new Date(targetYear, finalMonth, newPeriodEnd.getDate());
        // Mantener el startDate original si existe, pero usar el del pago si no
        newPeriodStart = subscription.periodStart || subscription.startDate || now;
      } else if (currentPeriodEnd) {
        // Está vencida pero puede estar en gracia - verificar
        let currentGraceUntil = subscription.graceUntil;
        if (!currentGraceUntil && currentPeriodEnd) {
          try {
            if (subscription.calculateGraceUntil) {
              currentGraceUntil = subscription.calculateGraceUntil();
            } else {
              currentGraceUntil = new Date(currentPeriodEnd);
              currentGraceUntil.setDate(currentGraceUntil.getDate() + GRACE_DAYS);
            }
          } catch (error) {
            currentGraceUntil = new Date(currentPeriodEnd);
            currentGraceUntil.setDate(currentGraceUntil.getDate() + GRACE_DAYS);
          }
        }
        
        if (currentGraceUntil && now <= currentGraceUntil) {
          // Está en gracia, extender desde periodEnd original
          newPeriodEnd = new Date(currentPeriodEnd);
          const targetMonth = newPeriodEnd.getMonth() + purchasedMonths;
          const targetYear = newPeriodEnd.getFullYear() + Math.floor(targetMonth / 12);
          const finalMonth = targetMonth % 12;
          newPeriodEnd = new Date(targetYear, finalMonth, newPeriodEnd.getDate());
          newPeriodStart = subscription.periodStart || subscription.startDate || now;
        } else {
          // Ya pasó la gracia, empezar desde hoy con el pago
          newPeriodEnd = new Date(now);
          const targetMonth = newPeriodEnd.getMonth() + purchasedMonths;
          const targetYear = newPeriodEnd.getFullYear() + Math.floor(targetMonth / 12);
          const finalMonth = targetMonth % 12;
          newPeriodEnd = new Date(targetYear, finalMonth, newPeriodEnd.getDate());
          newPeriodStart = now;
        }
      } else {
        // No hay periodEnd definido, empezar desde hoy
        newPeriodEnd = new Date(now);
        const targetMonth = newPeriodEnd.getMonth() + purchasedMonths;
        const targetYear = newPeriodEnd.getFullYear() + Math.floor(targetMonth / 12);
        const finalMonth = targetMonth % 12;
        newPeriodEnd = new Date(targetYear, finalMonth, newPeriodEnd.getDate());
        newPeriodStart = now;
      }
      
      // ACTUALIZAR suscripción con datos del PAGO (reemplaza datos manuales)
      subscription.periodStart = newPeriodStart;
      subscription.periodEnd = newPeriodEnd;
      subscription.endDate = newPeriodEnd;
      subscription.startDate = newPeriodStart; // Sincronizar también startDate
      subscription.status = 'active';
      subscription.paymentStatus = 'paid';
      subscription.lastPaymentAt = now;
      subscription.lastMonthsPurchased = purchasedMonths;
      subscription.commercialPlan = selectedCommercialPlan;
      subscription.billingCycle = selectedBillingCycle;
      
      // Mapear paymentMethod de PaymentRequest al formato de Subscription
      const paymentMethodMap = {
        'Nequi': 'NEQUI',
        'Daviplata': 'OTHER',
        'Transferencia': 'OTHER',
        'CASH': 'CASH',
        'OTHER': 'OTHER'
      };
      subscription.paymentMethod = paymentMethodMap[paymentRequest.paymentMethod] || paymentRequest.paymentMethod?.toUpperCase() || 'OTHER';
      
      // ACTUALIZAR con datos del pago (prioridad sobre manual)
      subscription.planType = inferLegacyPlanTypeFromMonths(purchasedMonths);
      subscription.price = paymentRequest.amount; // Usar el precio del pago
      subscription.isActive = true;
      
      // Calcular graceUntil
      const newGraceUntil = new Date(newPeriodEnd);
      newGraceUntil.setDate(newGraceUntil.getDate() + GRACE_DAYS);
      subscription.graceUntil = newGraceUntil;
    } else {
      // Crear nueva suscripción
      const newPeriodEnd = new Date(now);
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + purchasedMonths);
      
      // Calcular graceUntil
      const newGraceUntil = new Date(newPeriodEnd);
      newGraceUntil.setDate(newGraceUntil.getDate() + GRACE_DAYS);
      
      subscription = new Subscription({
        businessId: mongoose.Types.ObjectId.isValid(businessObjectId) 
          ? new mongoose.Types.ObjectId(businessObjectId) 
          : businessObjectId,
        planType: inferLegacyPlanTypeFromMonths(purchasedMonths),
        commercialPlan: selectedCommercialPlan,
        billingCycle: selectedBillingCycle,
        startDate: now,
        endDate: newPeriodEnd,
        periodStart: now,
        periodEnd: newPeriodEnd,
        graceUntil: newGraceUntil,
        price: paymentRequest.amount,
        paymentStatus: 'paid',
        status: 'active',
        lastPaymentAt: now,
        lastMonthsPurchased: purchasedMonths,
        // Mapear paymentMethod de PaymentRequest al formato de Subscription
        paymentMethod: (() => {
          const paymentMethodMap = {
            'Nequi': 'NEQUI',
            'Daviplata': 'OTHER',
            'Transferencia': 'OTHER',
            'CASH': 'CASH',
            'OTHER': 'OTHER'
          };
          return paymentMethodMap[paymentRequest.paymentMethod] || paymentRequest.paymentMethod?.toUpperCase() || 'OTHER';
        })(),
        isActive: true
      });
    }
    
    // Guardar suscripción
    await subscription.save();
    
    // Recargar desde la base de datos para asegurar que tenemos todos los campos
    const savedSubscription = await Subscription.findById(subscription._id);
    if (!savedSubscription) {
      throw new Error('Error al guardar la suscripción');
    }
    
    // Marcar solicitud como aprobada
    paymentRequest.status = PAYMENT_REQUEST_STATUS.APPROVED;
    paymentRequest.reviewedBy = req.user.id;
    paymentRequest.reviewedAt = now;
    await paymentRequest.save();
    
    // Emitir evento de socket para activación inmediata
    const businessIdStr = businessObjectId.toString();
    try {
      socketService.emitToBusiness(businessIdStr, 'subscription_activated', {
        subscription: {
          id: savedSubscription._id.toString(),
          _id: savedSubscription._id.toString(),
          status: savedSubscription.status,
          periodEnd: savedSubscription.periodEnd,
          periodStart: savedSubscription.periodStart,
          graceUntil: savedSubscription.graceUntil,
          isActive: savedSubscription.isActive,
          paymentStatus: savedSubscription.paymentStatus,
          lastPaymentAt: savedSubscription.lastPaymentAt,
          lastMonthsPurchased: savedSubscription.lastMonthsPurchased,
          commercialPlan: savedSubscription.commercialPlan,
          billingCycle: savedSubscription.billingCycle,
          businessId: savedSubscription.businessId.toString()
        },
        message: `Pago aprobado. Tu suscripción está activa hasta el ${new Date(savedSubscription.periodEnd).toLocaleDateString('es-CO')}`,
        activated: true,
        timestamp: now.toISOString()
      });
      
      // También emitir evento global para refrescar el estado en todos los clientes
      socketService.emitToBusiness(businessIdStr, 'subscription_updated', {
        subscription: savedSubscription.toObject ? savedSubscription.toObject() : savedSubscription,
        action: 'activated',
        timestamp: now.toISOString()
      });
    } catch (socketError) {
      logger.error('Error emitting socket event', socketError, req);
      // No fallar la aprobación si el socket falla
    }
    
    logger.info('Payment request approved - subscription activated', { 
      requestId: id, 
      businessId: businessIdStr,
      subscriptionId: savedSubscription._id.toString(),
      periodEnd: savedSubscription.periodEnd,
      graceUntil: savedSubscription.graceUntil,
      status: savedSubscription.status,
      isActive: savedSubscription.isActive
    }, req);
    
    res.json({
      success: true,
      message: 'Solicitud de pago aprobada exitosamente. El menú se ha activado inmediatamente.',
      subscription: {
        id: savedSubscription._id.toString(),
        _id: savedSubscription._id.toString(),
        businessId: businessIdStr,
        status: savedSubscription.status,
        periodStart: savedSubscription.periodStart,
        periodEnd: savedSubscription.periodEnd,
        graceUntil: savedSubscription.graceUntil,
        isActive: savedSubscription.isActive,
        paymentStatus: savedSubscription.paymentStatus,
        lastPaymentAt: savedSubscription.lastPaymentAt,
        lastMonthsPurchased: savedSubscription.lastMonthsPurchased,
        commercialPlan: savedSubscription.commercialPlan,
        billingCycle: savedSubscription.billingCycle
      },
      activated: true,
      timestamp: now.toISOString()
    });
  } catch (error) {
    // Obtener paymentRequest de forma segura si está disponible
    let businessIdForError = 'unknown';
    try {
      if (paymentRequest && paymentRequest.businessId) {
        businessIdForError = paymentRequest.businessId.toString();
      } else if (req.params.id) {
        // Intentar obtener el paymentRequest desde la base de datos
        const paymentReq = await PaymentRequest.findById(req.params.id).catch(() => null);
        if (paymentReq && paymentReq.businessId) {
          businessIdForError = paymentReq.businessId.toString();
        }
      }
    } catch (innerError) {
      // Ignorar errores al obtener businessId para el log
    }
    
    logger.error('Error approving payment request', {
      error: error.message,
      stack: error.stack,
      requestId: req.params.id,
      businessId: businessIdForError,
      errorDetails: error
    }, req);
    
    // Devolver mensaje de error más detallado en desarrollo
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Error al aprobar solicitud de pago' 
      : `Error al aprobar solicitud de pago: ${error.message}`;
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// POST /api/admin/payment-requests/:id/reject - Rechazar solicitud de pago (SuperAdmin)
router.post('/admin/payment-requests/:id/reject', protectSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'ID de solicitud inválido', 400));
    }
    
    const paymentRequest = await PaymentRequest.findById(id);
    if (!paymentRequest) {
      return res.status(404).json(formatHttpError(req, 'Solicitud de pago no encontrada', 404));
    }
    
    if (paymentRequest.status !== PAYMENT_REQUEST_STATUS.PENDING) {
      return res.status(400).json(formatHttpError(req, 'Esta solicitud ya ha sido procesada', 400));
    }
    
    // Marcar como rechazada
    paymentRequest.status = PAYMENT_REQUEST_STATUS.REJECTED;
    paymentRequest.reviewedBy = req.user.id;
    paymentRequest.reviewedAt = new Date();
    paymentRequest.rejectionReason = rejectionReason || 'Sin motivo especificado';
    
    await paymentRequest.save();
    
    // Emitir evento de socket
    socketService.emitToBusiness(paymentRequest.businessId.toString(), 'payment_request_rejected', {
      requestId: paymentRequest._id,
      rejectionReason: paymentRequest.rejectionReason,
      reviewedAt: paymentRequest.reviewedAt
    });
    
    logger.info('Payment request rejected', { 
      requestId: id, 
      businessId: paymentRequest.businessId.toString(),
      rejectionReason: paymentRequest.rejectionReason
    }, req);
    
    res.json({
      success: true,
      message: 'Solicitud de pago rechazada exitosamente'
    });
  } catch (error) {
    logger.error('Error rejecting payment request', error, req);
    res.status(500).json(formatHttpError(req, 'Error al rechazar solicitud de pago', 500));
  }
});

module.exports = router;
