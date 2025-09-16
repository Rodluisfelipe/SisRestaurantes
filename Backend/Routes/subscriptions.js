const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { requireSuperAdmin } = require('../Middleware/auth');
const { isValidObjectId } = require('../utils/validators');

// Middleware para verificar SuperAdmin
router.use(requireSuperAdmin);

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
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las suscripciones',
      error: error.message
    });
  }
});

// GET /api/subscriptions/:businessId - Obtener suscripción de un negocio específico
router.get('/:businessId', async (req, res) => {
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
      return res.status(404).json({
        success: false,
        message: 'No se encontró suscripción para este negocio'
      });
    }
    
    res.status(200).json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la suscripción',
      error: error.message
    });
  }
});

// POST /api/subscriptions - Crear nueva suscripción
router.post('/', async (req, res) => {
  try {
    const { businessId, planType, startDate, endDate, price, notes } = req.body;
    
    // Validaciones
    if (!businessId || !planType || !startDate || !endDate || !price) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de negocio inválido'
      });
    }
    
    if (!['monthly', 'annual'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de plan inválido'
      });
    }
    
    // Verificar que el negocio existe
    const business = await BusinessConfig.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Negocio no encontrado'
      });
    }
    
    // Verificar si ya existe una suscripción activa
    const existingSubscription = await Subscription.findOne({
      businessId,
      status: { $in: ['active', 'pending'] }
    });
    
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una suscripción activa para este negocio'
      });
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
    
    res.status(201).json({
      success: true,
      message: 'Suscripción creada exitosamente',
      subscription
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la suscripción',
      error: error.message
    });
  }
});

// PUT /api/subscriptions/:id - Actualizar suscripción
router.put('/:id', async (req, res) => {
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
      return res.status(404).json({
        success: false,
        message: 'Suscripción no encontrada'
      });
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
    
    res.status(200).json({
      success: true,
      message: 'Suscripción actualizada exitosamente',
      subscription
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la suscripción',
      error: error.message
    });
  }
});

// DELETE /api/subscriptions/:id - Eliminar suscripción
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de suscripción inválido'
      });
    }
    
    const subscription = await Subscription.findByIdAndDelete(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Suscripción no encontrada'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Suscripción eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la suscripción',
      error: error.message
    });
  }
});

// GET /api/subscriptions/check/:businessId - Verificar estado de suscripción (para el admin)
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
        message: 'No hay suscripción activa'
      });
    }
    
    const isActive = subscription.isSubscriptionActive();
    const isInGracePeriod = subscription.isInGracePeriod();
    const daysRemaining = subscription.getDaysRemaining();
    
    res.status(200).json({
      success: true,
      hasSubscription: true,
      subscription: {
        ...subscription.toObject(),
        isActive,
        isInGracePeriod,
        daysRemaining
      }
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar la suscripción',
      error: error.message
    });
  }
});

module.exports = router;
