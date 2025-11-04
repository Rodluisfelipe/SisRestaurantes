const Subscription = require('../Models/Subscription');
const { resolveBusinessId } = require('../utils/businessResolver');
const logger = require('../utils/logger');

/**
 * Middleware para verificar el estado de la suscripción
 * Bloquea acciones críticas si está suspendida
 * Permite operaciones en gracia pero con advertencia
 */
const checkSubscription = (options = {}) => {
  const { allowGrace = true, requireActive = false } = options;
  
  return async (req, res, next) => {
    try {
      // Obtener businessId
      let businessId = req.user?.businessId;
      
      if (!businessId && req.user?.id) {
        const Admin = require('../Models/Admin');
        const admin = await Admin.findById(req.user.id).select('businessId');
        if (admin && admin.businessId) {
          businessId = admin.businessId.toString();
        }
      }
      
      if (!businessId) {
        return res.status(403).json({
          success: false,
          message: 'No se pudo determinar el negocio'
        });
      }
      
      // Obtener suscripción
      const subscription = await Subscription.findOne({ businessId }).sort({ createdAt: -1 });
      
      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No tienes una suscripción activa',
          subscriptionStatus: 'no_subscription'
        });
      }
      
      // Obtener estado actual
      const status = subscription.getCurrentStatus();
      
      // Agregar información de suscripción al request
      req.subscription = subscription;
      req.subscriptionStatus = status;
      
      // Verificar permisos según estado
      if (status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Tu suscripción está suspendida. Por favor renueva para continuar.',
          subscriptionStatus: 'suspended',
          graceDaysRemaining: 0,
          periodEnd: subscription.periodEnd || subscription.endDate
        });
      }
      
      if (status === 'grace' && !allowGrace) {
        return res.status(403).json({
          success: false,
          message: 'Tu suscripción venció. Estás en período de gracia. Por favor renueva.',
          subscriptionStatus: 'grace',
          graceDaysRemaining: subscription.getGraceDaysRemaining(),
          periodEnd: subscription.periodEnd || subscription.endDate
        });
      }
      
      if (requireActive && status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Esta acción requiere una suscripción activa',
          subscriptionStatus: status,
          graceDaysRemaining: subscription.getGraceDaysRemaining(),
          periodEnd: subscription.periodEnd || subscription.endDate
        });
      }
      
      // Agregar headers informativos para el frontend
      res.set('X-Subscription-Status', status);
      if (status === 'grace') {
        res.set('X-Grace-Days-Remaining', subscription.getGraceDaysRemaining().toString());
      }
      
      next();
    } catch (error) {
      logger.error('Error in checkSubscription middleware', error, req);
      next(error);
    }
  };
};

/**
 * Helper para obtener información de suscripción sin bloquear
 */
const getSubscriptionInfo = async (req) => {
  try {
    let businessId = req.user?.businessId;
    
    if (!businessId && req.user?.id) {
      const Admin = require('../Models/Admin');
      const admin = await Admin.findById(req.user.id).select('businessId');
      if (admin && admin.businessId) {
        businessId = admin.businessId.toString();
      }
    }
    
    if (!businessId) return null;
    
    const subscription = await Subscription.findOne({ businessId }).sort({ createdAt: -1 });
    if (!subscription) return null;
    
    return {
      subscription,
      status: subscription.getCurrentStatus(),
      daysRemaining: subscription.getDaysRemaining(),
      graceDaysRemaining: subscription.getGraceDaysRemaining(),
      periodEnd: subscription.periodEnd || subscription.endDate,
      graceUntil: subscription.graceUntil || subscription.calculateGraceUntil()
    };
  } catch (error) {
    logger.error('Error getting subscription info', error, req);
    return null;
  }
};

module.exports = {
  checkSubscription,
  getSubscriptionInfo
};

