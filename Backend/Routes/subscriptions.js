
const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const authMiddleware = require('../middleware/authMiddleware');
const { isValidObjectId } = require('../utils/validators');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

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
  } else if (startDate !== undefined && !(new Date(startDate).toString() !== 'Invalid Date')) {
    errors.push({ field: 'startDate', message: 'startDate debe ser una fecha válida' });
  }
  
  // Validar endDate
  if (req.method === 'POST' && !endDate) {
    errors.push({ field: 'endDate', message: 'endDate es requerido' });
  } else if (endDate !== undefined && !(new Date(endDate).toString() !== 'Invalid Date')) {
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
  if (status !== undefined && !['active', 'expired', 'cancelled', 'pending'].includes(status)) {
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

// GET /api/subscriptions/check/:businessId - Verificar estado de suscripción (para el admin regular)
router.get('/check/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de negocio inválido'
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
    
    // Calcular días restantes
    const now = new Date();
    const isActive = subscription.isSubscriptionActive();
    const isInGracePeriod = subscription.isInGracePeriod();
    const daysRemaining = subscription.getDaysRemaining();
    
    res.json({
      success: true,
      hasSubscription: true,
      subscription: {
        _id: subscription._id,
        planType: subscription.planType,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        gracePeriodEnd: subscription.gracePeriodEnd,
        price: subscription.price,
        notes: subscription.notes,
        isActive,
        isInGracePeriod,
        daysRemaining,
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
    const businessId = req.user.businessId;
    
    if (!businessId) {
      return res.status(403).json(formatHttpError(req, 'No se pudo determinar el negocio', 403));
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 }) // Tomar la más reciente
      .populate('businessId', 'businessName slug');
    
    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasSubscription: false,
        message: 'No hay suscripción activa'
      });
    }
    
    // Calcular nextDueDate dinámicamente
    const now = new Date();
    const nextDueDate = subscription.endDate > now ? subscription.endDate : null;
    
    // Determinar status (considerar grace period automáticamente)
    let status = subscription.status;
    const isInGracePeriod = subscription.isInGracePeriod();
    
    if (status === 'active' && subscription.endDate < now) {
      status = 'past_due';
    }
    if (status === 'expired' && isInGracePeriod) {
      status = 'grace';
    }
    
    // Construir respuesta del último pago (si existe)
    const lastPayment = subscription.paymentStatus === 'paid' ? {
      date: subscription.updatedAt,
      amount: subscription.price,
      currency: 'COP',
      method: subscription.paymentMethod || 'CARD',
      status: subscription.paymentStatus === 'paid' ? 'APPROVED' : 
              subscription.paymentStatus === 'failed' ? 'DECLINED' : 'PENDING',
      externalId: subscription.wompiTransactionId || null
    } : null;
    
    res.json({
      success: true,
      subscription: {
        plan: subscription.planType,
        status,
        periodStart: subscription.startDate,
        periodEnd: subscription.endDate,
        graceUntil: subscription.gracePeriodEnd,
        nextDueDate,
        price: subscription.price,
        currency: 'COP',
        lastPayment,
        isInGracePeriod: isInGracePeriod,
        daysRemaining: subscription.getDaysRemaining()
      }
    });
  } catch (error) {
    logger.error('Error fetching my subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la suscripción', 500));
  }
});

// POST /api/subscriptions/checkout - Crear checkout Wompi
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { planType } = req.body;
    
    if (!businessId) {
      return res.status(403).json(formatHttpError(req, 'No se pudo determinar el negocio', 403));
    }
    
    // Buscar suscripción actual
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 });
    
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'No tienes una suscripción', 404));
    }
    
    // Obtener business para email
    const business = await BusinessConfig.findById(businessId);
    
    // Precio según plan
    const price = planType === 'annual' ? 
      (process.env.SUBSCRIPTION_ANNUAL_PRICE || 500000) : 
      (process.env.SUBSCRIPTION_MONTHLY_PRICE || 50000);
    
    // Importar wompiService (dinámicamente para evitar errores si no está configurado)
    let wompiService;
    try {
      wompiService = require('../services/wompiService');
    } catch (error) {
      return res.status(503).json(formatHttpError(req, 'Servicio de pagos no disponible', 503));
    }
    
    if (!wompiService.isConfigured()) {
      return res.status(503).json(formatHttpError(req, 'Servicio de pagos no configurado', 503));
    }
    
    // Crear checkout en Wompi
    const checkout = await wompiService.createCheckout({
      amountInCents: price,
      currency: 'COP',
      reference: `SUB_${subscription._id}_${Date.now()}`,
      customerEmail: business.adminEmail || req.user.email || 'noreply@menuby.tech',
      customerName: business.businessName,
      redirectUrl: `${process.env.FRONTEND_URL || 'https://www.menuby.tech'}/${business.slug}/payment-callback`,
      businessId: business._id.toString(),
      subscriptionId: subscription._id.toString()
    });
    
    // Actualizar suscripción con datos del checkout
    subscription.wompiTransactionId = checkout.id;
    subscription.checkoutLink = checkout.link;
    subscription.lastPaymentAttempt = new Date();
    subscription.wompiReference = checkout.reference;
    await subscription.save();
    
    logger.info('Checkout created for subscription', { 
      subscriptionId: subscription._id, 
      transactionId: checkout.id 
    }, req);
    
    res.json({
      success: true,
      checkoutLink: checkout.link,
      transactionId: checkout.id
    });
  } catch (error) {
    logger.error('Error creating checkout', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear checkout de pago: ' + error.message, 500));
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
    
    // Verificar si ya existe una suscripción activa
    const existingSubscription = await Subscription.findOne({
      businessId,
      status: { $in: ['active', 'pending'] }
    });
    
    if (existingSubscription) {
      return res.status(400).json(formatHttpError(req, 'Ya existe una suscripción activa para este negocio', 400));
    }
    
    // Calcular período de gracia (1 día después de la expiración)
    const gracePeriodEnd = new Date(endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
    
    const subscription = new Subscription({
      businessId,
      planType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      price,
      gracePeriodEnd,
      notes: notes || '',
      status: 'active',
      paymentStatus: 'paid'
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
    
    // Actualizar campos
    if (planType) subscription.planType = planType;
    if (startDate) subscription.startDate = new Date(startDate);
    if (endDate) {
      subscription.endDate = new Date(endDate);
      // Recalcular período de gracia
      subscription.gracePeriodEnd = new Date(endDate);
      subscription.gracePeriodEnd.setDate(subscription.gracePeriodEnd.getDate() + 1);
    }
    if (price) subscription.price = price;
    if (status) subscription.status = status;
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
