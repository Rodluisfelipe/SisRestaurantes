const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

router.use(protectSuperAdmin); // Todas las rutas requieren SuperAdmin

// GET /api/admin/subscriptions/overview
router.get('/overview', async (req, res) => {
  try {
    const { range = '30d', status = 'all', page = 1, limit = 20 } = req.query;
    
    // Calcular fecha de inicio según range
    const startDate = new Date();
    if (range === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (range === '90d') startDate.setDate(startDate.getDate() - 90);
    else startDate.setDate(startDate.getDate() - 30);
    
    // Query base
    let query = {};
    if (status !== 'all') {
      // Mapear estados frontend a estados backend
      const statusMap = {
        'past_due': 'expired', // past_due usa 'expired' en BD
        'grace': 'expired', // grace también es 'expired' en BD
        'suspended': 'cancelled',
        'canceled': 'cancelled'
      };
      query.status = statusMap[status] || status;
    }
    
    // Obtener todas las suscripciones con negocio
    const subscriptions = await Subscription.find(query)
      .populate('businessId', 'businessName slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) * 10); // Temporalmente más para calcular KPIs
    
    // Agrupar por businessId (solo la más reciente)
    const businessMap = new Map();
    subscriptions.forEach(sub => {
      if (!businessMap.has(sub.businessId._id.toString())) {
        businessMap.set(sub.businessId._id.toString(), sub);
      }
    });
    
    const allBusinesses = Array.from(businessMap.values());
    
    // Calcular KPIs
    const now = new Date();
    const kpis = {
      totalBusinesses: allBusinesses.length,
      active: allBusinesses.filter(b => {
        return b.status === 'active' && b.paymentStatus === 'paid' && b.endDate > now;
      }).length,
      pastDue: allBusinesses.filter(b => {
        return (b.status === 'active' || b.status === 'expired') && b.endDate < now && !b.isInGracePeriod();
      }).length,
      grace: allBusinesses.filter(b => b.isInGracePeriod()).length,
      suspended: allBusinesses.filter(b => b.status === 'cancelled').length,
      churn30d: 0, // TODO: Calcular basado en fechas de cancelación
      mrr30d: 0 // TODO: Calcular MRR aprobado (Monthly Recurring Revenue)
    };
    
    // Calcular MRR simple (ingresos mensuales recurrentes)
    kpis.mrr30d = allBusinesses
      .filter(b => b.status === 'active' && b.paymentStatus === 'paid' && b.endDate > now)
      .reduce((sum, b) => sum + b.price, 0);
    
    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedBusinesses = allBusinesses.slice(skip, skip + parseInt(limit));
    
    // Formatear respuesta
    const businesses = paginatedBusinesses.map(sub => {
      // Determinar status real
      let displayStatus = sub.status;
      if (sub.status === 'active' && sub.endDate < now) {
        displayStatus = 'past_due';
      } else if (sub.status === 'expired' && sub.isInGracePeriod()) {
        displayStatus = 'grace';
      }
      
      return {
        businessId: sub.businessId._id,
        slug: sub.businessId.slug,
        name: sub.businessId.businessName,
        status: displayStatus,
        plan: sub.planType,
        periodEnd: sub.endDate,
        graceUntil: sub.gracePeriodEnd,
        nextDueDate: sub.endDate,
        lastPayment: sub.paymentStatus === 'paid' ? {
          date: sub.updatedAt,
          amount: sub.price,
          currency: 'COP',
          status: 'APPROVED',
          externalId: sub.wompiTransactionId
        } : null
      };
    });
    
    res.json({
      success: true,
      kpis,
      businesses,
      pagination: {
        total: allBusinesses.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allBusinesses.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching subscriptions overview', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener overview', 500));
  }
});

// GET /api/admin/subscriptions/:businessId/transactions
router.get('/:businessId/transactions', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { range = '30d' } = req.query;
    
    // Calcular fecha según range
    const startDate = new Date();
    if (range === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (range === '90d') startDate.setDate(startDate.getDate() - 90);
    else startDate.setDate(startDate.getDate() - 30);
    
    // Obtener todas las suscripciones del negocio
    const subscriptions = await Subscription.find({ businessId })
      .sort({ createdAt: -1 });
    
    const transactions = subscriptions.map(sub => ({
      id: sub._id,
      date: sub.updatedAt,
      amount: sub.price,
      currency: 'COP',
      method: sub.paymentMethod || 'CARD',
      status: sub.paymentStatus === 'paid' ? 'APPROVED' : 
              sub.paymentStatus === 'failed' ? 'DECLINED' : 'PENDING',
      reference: sub.wompiReference || sub.wompiTransactionId,
      planType: sub.planType,
      periodStart: sub.startDate,
      periodEnd: sub.endDate
    }));
    
    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    logger.error('Error fetching transactions', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener transacciones', 500));
  }
});

module.exports = router;

