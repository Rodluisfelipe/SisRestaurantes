
const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const authMiddleware = require('../middleware/authMiddleware');
const { isValidObjectId } = require('../utils/validators');
const { resolveBusinessId } = require('../utils/businessResolver');
const { SUBSCRIPTION_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { calculateSubscriptionStatus } = require('../utils/subscriptionHelper');

// Validación de entrada para crear/actualizar suscripción
const validateSubscriptionInput = (req, res, next) => {
  const errors = [];
  const { businessId, planType, startDate, endDate, price, notes, status, paymentStatus } = req.body;
  
  // Validar businessId (solo para POST)
  if (req.method === 'POST') {
    if (!businessId) {
      errors.push({ field: 'businessId', message: 'businessId es requerido' });
    } else if (!isValidObjectId(businessId)) {
      errors.push({ field: 'businessId', message: 'ID de negocio inválido' });
    }
  }
  
  // Validar planType
  if (req.method === 'POST' && !planType) {
    errors.push({ field: 'planType', message: 'planType es requerido' });
  } else if (planType !== undefined && !['monthly', 'annual'].includes(planType)) {
    errors.push({ field: 'planType', message: 'planType debe ser "monthly" o "annual"' });
  }
  
  // Validar startDate
  if (req.method === 'POST' && !startDate) {
    errors.push({ field: 'startDate', message: 'startDate es requerido' });
  } else if (startDate !== undefined && new Date(startDate).toString() === 'Invalid Date') {
    errors.push({ field: 'startDate', message: 'startDate debe ser una fecha válida' });
  }
  
  // Validar endDate
  if (req.method === 'POST' && !endDate) {
    errors.push({ field: 'endDate', message: 'endDate es requerido' });
  } else if (endDate !== undefined && new Date(endDate).toString() === 'Invalid Date') {
    errors.push({ field: 'endDate', message: 'endDate debe ser una fecha válida' });
  }
  
  // Validar price
  if (req.method === 'POST' && price === undefined) {
    errors.push({ field: 'price', message: 'price es requerido' });
  } else if (price !== undefined && (typeof price !== 'number' || isNaN(price) || price < 0)) {
    errors.push({ field: 'price', message: 'price debe ser un número >= 0' });
  }
  
  // Validar notes (opcional)
  if (notes !== undefined && typeof notes !== 'string') {
    errors.push({ field: 'notes', message: 'notes debe ser un string' });
  }
  
  // Validar status (opcional)
  if (status !== undefined && !Object.values(SUBSCRIPTION_STATUS).includes(status)) {
    errors.push({ field: 'status', message: 'status debe ser uno de: active, expired, cancelled, pending' });
  }
  
  // Validar paymentStatus (opcional)
  if (paymentStatus !== undefined && !['paid', 'pending', 'failed'].includes(paymentStatus)) {
    errors.push({ field: 'paymentStatus', message: 'paymentStatus debe ser uno de: paid, pending, failed' });
  }
  
  if (errors.length > 0) {
    return res.status(400).json(
      formatHttpError(req, 'Errores de validación en la entrada', 400, errors)
    );
  }
  
  next();
};

// GET /api/subscriptions/check/:businessId - Verificar estado de suscripción
// Public endpoint but returns limited info. Full details require auth.
router.get('/check/:businessId', async (req, res) => {
  try {
    let { businessId } = req.params;
    
    // Check if request is authenticated (optional auth)
    const authHeader = req.headers.authorization;
    const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');
    
    // Resolver businessId si es un slug (convertir a ObjectId)
    try {
      businessId = await resolveBusinessId(businessId);
    } catch (error) {
      logger.warn('Error resolving businessId in /check/:businessId', { businessId: req.params.businessId, error: error.message }, req);
      return res.status(400).json({
        success: false,
        message: 'ID de negocio inválido o no encontrado'
      });
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .populate('businessId', 'businessName slug');
    
    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasSubscription: false,
        message: 'No hay suscripción para este negocio'
      });
    }
    
    // Calcular estado usando helper centralizado
    const { status: currentStatus, periodEnd: periodEndDate, graceUntil: graceUntilDate } = calculateSubscriptionStatus(subscription);
    
    // For unauthenticated requests (public/customer), return minimal info
    if (!isAuthenticated) {
      return res.json({
        success: true,
        hasSubscription: true,
        subscription: {
          status: currentStatus,
          isActive: currentStatus === 'active',
          isInGracePeriod: currentStatus === 'grace'
        }
      });
    }
    
    // For authenticated requests (admin), return full details
    const daysRemaining = subscription.getDaysRemaining ? subscription.getDaysRemaining() : 0;
    
    res.json({
      success: true,
      hasSubscription: true,
      subscription: {
        _id: subscription._id,
        id: subscription._id,
        planType: subscription.planType,
        status: currentStatus, // active, grace, suspended
        paymentStatus: subscription.paymentStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        periodStart: subscription.periodStart || subscription.startDate,
        periodEnd: periodEndDate,
        graceUntil: graceUntilDate,
        gracePeriodEnd: graceUntilDate,
        price: subscription.price,
        notes: subscription.notes,
        isActive: currentStatus === 'active',
        isInGracePeriod: currentStatus === 'grace',
        daysRemaining: subscription.getDaysRemaining ? subscription.getDaysRemaining() : daysRemaining,
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
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error checking subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al verificar la suscripción', 500));
  }
});

// GET /api/subscriptions/me - Obtener mi suscripción (para admin autenticado)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Si es SuperAdmin, permitir pasar businessId como query param (puede ser slug u ObjectId)
    let businessId = req.user.businessId;
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin';
    
    logger.info('GET /subscriptions/me', { 
      hasBusinessId: !!businessId, 
      isSuperAdmin, 
      userRole: req.user.role,
      userId: req.user.id,
      userBusinessId: req.user.businessId,
      queryBusinessId: req.query.businessId 
    }, req);
    
    // Si no hay businessId en el token y no es superadmin, intentar obtenerlo de la base de datos
    if (!businessId && !isSuperAdmin && req.user.id) {
      try {
        logger.info('Buscando Admin en BD para obtener businessId', { userId: req.user.id }, req);
        const admin = await Admin.findById(req.user.id).select('businessId');
        if (admin) {
          logger.info('Admin encontrado', { 
            adminId: admin._id, 
            hasBusinessId: !!admin.businessId,
            businessId: admin.businessId 
          }, req);
          if (admin.businessId) {
            // Convertir a string si es ObjectId
            businessId = admin.businessId.toString();
            logger.info('BusinessId obtenido de la base de datos', { businessId }, req);
          } else {
            logger.warn('Admin encontrado pero sin businessId', { adminId: admin._id }, req);
          }
        } else {
          logger.warn('Admin no encontrado en BD', { userId: req.user.id }, req);
        }
      } catch (error) {
        logger.error('Error fetching businessId from Admin', error, req);
      }
    } else if (!req.user.id) {
      logger.warn('No se tiene userId en req.user', { user: req.user }, req);
    }
    
    // Si es SuperAdmin y tiene query param, usar ese
    if (!businessId && isSuperAdmin && req.query.businessId) {
      // Resolver el businessId (slug u ObjectId) a ObjectId
      try {
        businessId = await resolveBusinessId(req.query.businessId);
      } catch (error) {
        logger.error('Error resolving businessId', error, req);
        return res.status(400).json(formatHttpError(req, 'Negocio no encontrado: ' + error.message, 400));
      }
    }
    
    if (!businessId) {
      logger.warn('No se pudo determinar el businessId en /subscriptions/me, retornando sin suscripción', { 
        hasTokenBusinessId: !!req.user.businessId,
        isSuperAdmin,
        hasUserId: !!req.user.id,
        hasQueryBusinessId: !!req.query.businessId,
        user: {
          id: req.user.id,
          role: req.user.role,
          businessId: req.user.businessId
        }
      }, req);
      return res.json({
        success: true,
        hasSubscription: false,
        subscription: null,
        message: 'No se pudo determinar el negocio o no hay suscripción activa'
      });
    }
    
    // Asegurar que businessId sea ObjectId válido
    if (!isValidObjectId(businessId)) {
      return res.status(400).json(formatHttpError(req, 'ID de negocio inválido', 400));
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 }); // Tomar la más reciente
    
    if (!subscription) {
      return res.json({
        success: true,
        hasSubscription: false,
        subscription: null,
        message: 'No tienes una suscripción activa'
      });
    }
    
    // Usar el nuevo sistema de estados
    const currentStatus = subscription.getCurrentStatus ? subscription.getCurrentStatus() : 'active';
    const periodEndDate = subscription.periodEnd || subscription.endDate;
    const graceUntilDate = subscription.graceUntil || (subscription.calculateGraceUntil ? subscription.calculateGraceUntil() : null);
    
    res.json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription._id,
        _id: subscription._id,
        businessId: subscription.businessId,
        planType: subscription.planType,
        status: currentStatus, // active, grace, suspended
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
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching my subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la suscripción', 500));
  }
});

// Middleware para verificar SuperAdmin (aplica a todas las rutas siguientes)
router.use(protectSuperAdmin);

// GET /api/subscriptions - Obtener todas las suscripciones
router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('businessId', 'businessName slug')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      subscriptions
    });
  } catch (error) {
    logger.error('Error fetching subscriptions', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener las suscripciones', 500));
  }
});

// GET /api/subscriptions/:businessId - Obtener suscripción de un negocio específico
router.get('/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    if (!isValidObjectId(businessId)) {
      return res.status(400).json(formatHttpError(req, 'ID de negocio inválido', 400));
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .populate('businessId', 'businessName slug');
    
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'No se encontró suscripción para este negocio', 404));
    }
    
    res.status(200).json({
      success: true,
      subscription
    });
  } catch (error) {
    logger.error('Error fetching subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la suscripción', 500));
  }
});

// POST /api/subscriptions - Crear nueva suscripción
router.post('/', validateSubscriptionInput, async (req, res) => {
  try {
    const { businessId, planType, startDate, endDate, price, notes } = req.body;
    
    // Verificar que el negocio existe
    const business = await BusinessConfig.findById(businessId);
    if (!business) {
      return res.status(404).json(formatHttpError(req, 'Negocio no encontrado', 404));
    }
    
    // Verificar si ya existe una suscripción activa (solo si la nueva suscripción es activa)
    // Permitir crear suscripciones pasadas incluso si hay una activa
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);
    const currentDate = new Date();
    
    // Solo verificar suscripciones activas si la nueva suscripción se superpone con el presente/futuro
    if (newEndDate >= currentDate || newStartDate >= currentDate) {
      const existingSubscription = await Subscription.findOne({
        businessId,
        status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PENDING] },
        $or: [
          { startDate: { $lte: newEndDate }, endDate: { $gte: newStartDate } }, // Se superpone
          { endDate: { $gte: currentDate } } // Aún activa
        ]
      });
      
      if (existingSubscription) {
        return res.status(400).json(formatHttpError(req, 'Ya existe una suscripción activa o que se superpone con las fechas especificadas', 400));
      }
    }
    
    // Calcular período de gracia (1 día después de la expiración)
    const gracePeriodEnd = new Date(endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
    
    // Determinar el estado basado en las fechas
    const endDateObj = new Date(endDate);
    let subscriptionStatus = 'active';
    
    if (endDateObj < currentDate) {
      // Si la fecha de fin es pasada, la suscripción está expirada
      subscriptionStatus = 'expired';
    }
    
    // Calcular graceUntil basado en GRACE_DAYS (1 día)
    const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || 1);
    const graceUntilDate = new Date(endDate);
    graceUntilDate.setDate(graceUntilDate.getDate() + GRACE_DAYS);
    
    const subscription = new Subscription({
      businessId,
      planType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      periodStart: new Date(startDate), // Establecer periodStart igual que startDate
      periodEnd: new Date(endDate), // Establecer periodEnd igual que endDate
      graceUntil: graceUntilDate, // Calcular graceUntil
      price,
      gracePeriodEnd, // Mantener por compatibilidad
      notes: notes || '',
      status: subscriptionStatus,
      paymentStatus: 'paid',
      isActive: subscriptionStatus === 'active'
    });
    
    await subscription.save();
    
    // Poblar la información del negocio
    await subscription.populate('businessId', 'businessName slug');
    
    logger.info('Subscription created', { businessId, planType }, req);
    res.status(201).json({
      success: true,
      message: 'Suscripción creada exitosamente',
      subscription
    });
  } catch (error) {
    logger.error('Error creating subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear la suscripción', 500));
  }
});

// PUT /api/subscriptions/:id - Actualizar suscripción
router.put('/:id', validateSubscriptionInput, async (req, res) => {
  try {
    const { id } = req.params;
    const { planType, startDate, endDate, price, status, paymentStatus, notes } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de suscripción inválido'
      });
    }
    
    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'Suscripción no encontrada', 404));
    }
    
    // Calcular graceUntil basado en GRACE_DAYS (1 día)
    const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || 1);
    
    // Actualizar campos - SINCRONIZAR periodStart y periodEnd con startDate y endDate
    if (planType) subscription.planType = planType;
    if (startDate) {
      subscription.startDate = new Date(startDate);
      subscription.periodStart = new Date(startDate); // Sincronizar periodStart
    }
    if (endDate) {
      subscription.endDate = new Date(endDate);
      subscription.periodEnd = new Date(endDate); // Sincronizar periodEnd
      // Recalcular período de gracia
      const graceUntilDate = new Date(endDate);
      graceUntilDate.setDate(graceUntilDate.getDate() + GRACE_DAYS);
      subscription.graceUntil = graceUntilDate;
      subscription.gracePeriodEnd = new Date(endDate);
      subscription.gracePeriodEnd.setDate(subscription.gracePeriodEnd.getDate() + 1); // Mantener por compatibilidad
    }
    if (price) subscription.price = price;
    if (status) {
      subscription.status = status;
      subscription.isActive = status === 'active';
    }
    if (paymentStatus) subscription.paymentStatus = paymentStatus;
    if (notes !== undefined) subscription.notes = notes;
    
    await subscription.save();
    await subscription.populate('businessId', 'businessName slug');
    
    logger.info('Subscription updated', { id }, req);
    res.status(200).json({
      success: true,
      message: 'Suscripción actualizada exitosamente',
      subscription
    });
  } catch (error) {
    logger.error('Error updating subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar la suscripción', 500));
  }
});

// DELETE /api/subscriptions/:id - Eliminar suscripción
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json(formatHttpError(req, 'ID de suscripción inválido', 400));
    }
    
    const subscription = await Subscription.findByIdAndDelete(id);
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'Suscripción no encontrada', 404));
    }
    
    logger.info('Subscription deleted', { id }, req);
    res.status(200).json({
      success: true,
      message: 'Suscripción eliminada exitosamente'
    });
  } catch (error) {
    logger.error('Error deleting subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al eliminar la suscripción', 500));
  }
});


module.exports = router;
