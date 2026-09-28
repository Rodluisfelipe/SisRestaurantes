const express = require('express');
const sellos = require('../services/sellos');
const router = express.Router();
const LoyaltyProgram = require('../Models/LoyaltyProgram');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const Customer = require('../Models/Customer');
const { tenantAuth } = require('../middleware/tenantAuth');
const { resolveBusinessId } = require('../utils/businessResolver');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const {
  validateUpdateProgram,
  validateRedeem,
} = require('../middleware/validators/loyaltyValidators');
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const { redimir } = require('../services/fidelizacion');
const { abreCuenta } = require('../utils/cuentaCliente');

const SIN_CUENTA = { codigo: 'SIN_CUENTA', message: 'Tu cuenta se activa en este celular con tu primer pedido.' };

// Helper: get the effective businessId for admin routes
async function getAdminBusinessId(req) {
  // Normal admin: businessId is in the JWT
  if (req.user.businessId) return req.user.businessId;
  // SuperAdmin: must pass businessId in query or body
  const raw = req.query.businessId || req.body.businessId;
  if (!raw) return null;
  return resolveBusinessId(raw);
}

async function getPlanGateInfo(businessId) {
  const { planConfig, commercialPlan } = await getSubscriptionForBusiness(businessId);
  return {
    planConfig,
    commercialPlan,
    hasLoyaltyRewards: isFeatureEnabledForPlan(planConfig, 'loyaltyRewards'),
    hasLoyaltyTiers: isFeatureEnabledForPlan(planConfig, 'loyaltyTiers')
  };
}

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }
});

// ─── ADMIN: Get loyalty program config ───
router.get('/program', tenantAuth, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
    let program = await LoyaltyProgram.findOne({ businessId }).lean();
    if (!program) {
      // Return default (not yet created)
      program = {
        businessId,
        isActive: false,
        pointsPerAmount: 1,
        amountPerPoints: 10000,
        firstOrderBonus: 0,
        referralBonus: 0,
        pointsExpiryDays: 90,
        tiersEnabled: false,
        tiers: [],
        rewards: [],
        mode: 'points',
        stampCard: { required: 10, minAmount: 0, reward: { type: 'free_product', name: '', discountValue: 0, maxDiscount: 0, productId: null, productName: '' } }
      };
    }
    res.json(program);
  } catch (error) {
    logger.error('Error fetching loyalty program:', error);
    res.status(500).json({ message: 'Error al obtener programa de fidelidad' });
  }
});

// ─── ADMIN: Create or update loyalty program ───
router.put('/program', tenantAuth, validateUpdateProgram, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
    const {
      isActive, pointsPerAmount, amountPerPoints,
      firstOrderBonus, referralBonus, pointsExpiryDays,
      tiersEnabled, tiers, rewards, mode, stampCard
    } = req.body;

    const planGate = await getPlanGateInfo(businessId);

    /* Solo se bloquea si se quieren ENCENDER los niveles. Antes bastaba con que
       vinieran niveles en la lista (quedan ahí al prender y apagar el
       interruptor) para que un plan sin niveles no pudiera guardar nada. */
    const requestedTiersEnabled = tiersEnabled === true || tiersEnabled === 'true';
    if (requestedTiersEnabled) {
      if (!planGate.hasLoyaltyTiers) {
        return res.status(403).json({
          message: 'Tu plan actual no incluye niveles de lealtad (tiers).',
          code: 'PLAN_FEATURE_NOT_AVAILABLE',
          feature: 'loyaltyTiers',
          plan: planGate.commercialPlan
        });
      }
    }

    // La tarjeta de sellos siempre entrega un premio: va con el mismo permiso del plan
    const wantsRewards = (Array.isArray(rewards) && rewards.length > 0) || mode === 'stamps';
    if (wantsRewards && !planGate.hasLoyaltyRewards) {
      return res.status(403).json({
        message: 'Tu plan actual no incluye recompensas canjeables.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'loyaltyRewards',
        plan: planGate.commercialPlan
      });
    }

    const update = {
      isActive: !!isActive,
      pointsPerAmount: Math.max(1, Number(pointsPerAmount) || 1),
      amountPerPoints: Math.max(1, Number(amountPerPoints) || 10000),
      firstOrderBonus: Math.max(0, Number(firstOrderBonus) || 0),
      referralBonus: Math.max(0, Number(referralBonus) || 0),
      pointsExpiryDays: Math.max(0, Number(pointsExpiryDays) || 0),
      tiersEnabled: !!tiersEnabled
    };

    if (mode === 'points' || mode === 'stamps') update.mode = mode;
    if (stampCard && typeof stampCard === 'object') {
      const premio = stampCard.reward || {};
      const tipos = ['free_product', 'discount_fixed', 'discount_percent'];
      update.stampCard = {
        required: Math.min(Math.max(parseInt(stampCard.required, 10) || 10, 2), 30),
        minAmount: Math.max(0, Number(stampCard.minAmount) || 0),
        reward: {
          type: tipos.includes(premio.type) ? premio.type : 'free_product',
          name: String(premio.name || '').trim().slice(0, 100),
          discountValue: Math.max(0, Number(premio.discountValue) || 0),
          maxDiscount: Math.max(0, Number(premio.maxDiscount) || 0),
          productId: premio.productId && String(premio.productId).length === 24 ? premio.productId : null,
          productName: String(premio.productName || '').slice(0, 100),
        },
      };
      if (update.stampCard.reward.type === 'discount_percent') {
        update.stampCard.reward.discountValue = Math.min(update.stampCard.reward.discountValue, 100);
      }
    }
    // Con sellos, la tarjeta tiene que decir qué se gana
    const tarjetaFinal = update.stampCard;
    if ((update.mode === 'stamps') && tarjetaFinal) {
      const r = tarjetaFinal.reward;
      if (r.type === 'free_product' && !r.productId) {
        return res.status(400).json({ message: 'Elige el producto que se gana al llenar la tarjeta.' });
      }
      if (r.type !== 'free_product' && !r.discountValue) {
        return res.status(400).json({ message: 'Escribe el valor del descuento que se gana al llenar la tarjeta.' });
      }
    }

    if (Array.isArray(tiers) && (planGate.hasLoyaltyTiers || tiers.length === 0)) {
      update.tiers = tiers.map(t => ({
        name: String(t.name || '').slice(0, 50),
        minPoints: Math.max(0, Number(t.minPoints) || 0),
        multiplier: Math.max(1, Number(t.multiplier) || 1),
        color: String(t.color || '#94a3b8').slice(0, 7),
        icon: String(t.icon || 'star').slice(0, 20),
        benefits: Array.isArray(t.benefits) ? t.benefits.map(b => String(b).slice(0, 100)) : []
      }));
    }

    if (Array.isArray(rewards)) {
      update.rewards = rewards.map(r => {
        const reward = {
          name: String(r.name || '').slice(0, 100),
          description: String(r.description || '').slice(0, 200),
          type: ['free_product', 'discount_percent', 'discount_fixed', 'free_delivery'].includes(r.type) ? r.type : 'discount_fixed',
          discountValue: Math.max(0, Number(r.discountValue) || 0),
          maxDiscount: Math.max(0, Number(r.maxDiscount) || 0),
          pointsCost: Math.max(1, Number(r.pointsCost) || 1),
          isActive: r.isActive !== false,
          timesRedeemed: r.timesRedeemed || 0,
          // "Aplica para" (mesa, llevar, domicilio): antes no se guardaba y el premio valía para todo
          applicableOrderModes: Array.isArray(r.applicableOrderModes)
            ? [...new Set(r.applicableOrderModes.filter(m => ['inSite', 'takeaway', 'delivery'].includes(m)))]
            : []
        };
        // Only include _id if it's a valid ObjectId (not temp_*)
        if (r._id && !String(r._id).startsWith('temp_')) {
          reward._id = r._id;
        }
        // Only include productId if it's a valid value
        if (r.productId && String(r.productId).length === 24) {
          reward.productId = r.productId;
        }
        if (r.productName) {
          reward.productName = String(r.productName).slice(0, 100);
        }
        return reward;
      });
    }

    const program = await LoyaltyProgram.findOneAndUpdate(
      { businessId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(program);
  } catch (error) {
    logger.error('Error updating loyalty program:', error);
    res.status(500).json({ message: 'Error al guardar programa de fidelidad' });
  }
});

// ─── ADMIN: Get loyalty dashboard stats ───
router.get('/stats', tenantAuth, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
    const [totalMembers, aggregation] = await Promise.all([
      CustomerLoyalty.countDocuments({ businessId }),
      CustomerLoyalty.aggregate([
        { $match: { businessId: require('mongoose').Types.ObjectId.createFromHexString(businessId.toString()) } },
        { $group: {
          _id: null,
          totalPointsIssued: { $sum: '$totalEarned' },
          totalPointsRedeemed: { $sum: '$totalRedeemed' },
          totalPointsActive: { $sum: '$points' },
          avgPointsPerMember: { $avg: '$points' }
        }}
      ])
    ]);

    const stats = aggregation[0] || { totalPointsIssued: 0, totalPointsRedeemed: 0, totalPointsActive: 0, avgPointsPerMember: 0 };
    res.json({ totalMembers, ...stats });
  } catch (error) {
    logger.error('Error fetching loyalty stats:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// ─── ADMIN: Get top loyal customers ───
router.get('/top-customers', tenantAuth, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const search = req.query.search ? String(req.query.search).trim() : '';

    let query = { businessId };
    if (search) {
      // Escapado: un "(" o "+" en la búsqueda rompía la consulta
      query.phone = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const [customers, total] = await Promise.all([
      CustomerLoyalty.find(query)
        .sort({ totalEarned: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name phone')
        .lean(),
      CustomerLoyalty.countDocuments(query)
    ]);

    // Get program rewards to calculate claimable rewards per customer
    const { hasLoyaltyRewards } = await getPlanGateInfo(businessId);
    const program = await LoyaltyProgram.findOne({ businessId }).lean();
    const activeRewards = hasLoyaltyRewards
      ? (program?.rewards || []).filter(r => r.isActive)
      : [];

    const enriched = customers.map(c => ({
      ...c,
      claimableRewards: activeRewards.filter(r => c.points >= r.pointsCost)
    }));

    res.json({ customers: enriched, total, hasMore: skip + limit < total });
  } catch (error) {
    logger.error('Error fetching top customers:', error);
    res.status(500).json({ message: 'Error al obtener clientes top' });
  }
});

// ─── ADMIN: la tarjeta de sellos de un cliente (pedido rápido y caja) ───
router.get('/sellos', tenantAuth, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    const phone = String(req.query.phone || '').trim();
    if (!businessId || !phone) return res.status(400).json({ message: 'businessId y phone son requeridos' });
    const program = await sellos.programaDeSellos(businessId);
    if (!program) return res.json({ active: false });
    const loyalty = await CustomerLoyalty.findOne({ businessId, phone }).lean();
    res.json({ active: true, tarjeta: sellos.estadoTarjeta(program, loyalty) });
  } catch (error) {
    logger.error('Error consultando la tarjeta de sellos:', error);
    res.status(500).json({ message: 'Error al consultar la tarjeta' });
  }
});

// ─── PUBLIC: la tarjeta de sellos del negocio (sin datos de nadie) ───
// Para que quien aún no ha pedido vea que existe y qué se gana.
router.get('/tarjeta', publicLimiter, async (req, res) => {
  try {
    let businessId;
    try { businessId = await resolveBusinessId(req.query.businessId); } catch { return res.json({ active: false }); }
    const program = await sellos.programaDeSellos(businessId);
    if (!program) return res.json({ active: false });
    const t = sellos.estadoTarjeta(program, null);
    res.json({ active: true, tarjeta: { requeridos: t.requeridos, montoMinimo: t.montoMinimo, premio: t.premio, sellos: 0, premiosDisponibles: 0 } });
  } catch (error) {
    logger.error('Error consultando la tarjeta pública:', error);
    res.status(500).json({ message: 'Error al consultar la tarjeta' });
  }
});

// ─── PUBLIC: Get customer loyalty balance (by phone + businessId) ───
router.get('/balance', publicLimiter, async (req, res) => {
  try {
    const { businessId: rawBizId, phone } = req.query;
    if (!rawBizId || !phone) {
      return res.status(400).json({ message: 'businessId y phone son requeridos' });
    }

    // Resolve businessId (could be slug or ObjectId)
    let businessId;
    try {
      businessId = await resolveBusinessId(rawBizId);
    } catch {
      return res.json({ active: false });
    }
    // Los puntos de alguien solo con la llave de su cuenta.
    if (!abreCuenta(req, businessId, phone)) return res.status(401).json(SIN_CUENTA);

    // Check if loyalty program is active
    const program = await LoyaltyProgram.findOne({ businessId, isActive: true }).lean();
    if (!program) {
      return res.json({ active: false });
    }

    const { hasLoyaltyRewards } = await getPlanGateInfo(businessId);

    const loyalty = await CustomerLoyalty.findOne({ businessId, phone }).lean();
    if (program.mode === 'stamps') {
      return res.json({
        active: true,
        mode: 'stamps',
        tarjeta: sellos.estadoTarjeta(program, loyalty),
      });
    }
    if (!loyalty) {
      return res.json({
        active: true,
        points: 0,
        currentTier: program.tiers?.[0]?.name || '',
        rewards: hasLoyaltyRewards ? program.rewards.filter(r => r.isActive) : [],
        tiers: program.tiersEnabled ? program.tiers : [],
        totalEarned: 0,
        pointsPerAmount: program.pointsPerAmount,
        amountPerPoints: program.amountPerPoints
      });
    }

    res.json({
      active: true,
      points: loyalty.points,
      totalEarned: loyalty.totalEarned,
      currentTier: loyalty.currentTier,
      rewards: hasLoyaltyRewards ? program.rewards.filter(r => r.isActive) : [],
      tiers: program.tiersEnabled ? program.tiers : [],
      pointsPerAmount: program.pointsPerAmount,
      amountPerPoints: program.amountPerPoints,
      recentTransactions: (loyalty.transactions || []).slice(-10).reverse()
    });
  } catch (error) {
    logger.error('Error fetching loyalty balance:', error);
    res.status(500).json({ message: 'Error al consultar puntos' });
  }
});

// ─── PUBLIC: Redeem a reward ───
router.post('/redeem', publicLimiter, validateRedeem, async (req, res) => {
  try {
    const { businessId: rawBizId, phone, rewardId } = req.body;
    if (!rawBizId || !phone || !rewardId) {
      return res.status(400).json({ message: 'businessId, phone y rewardId son requeridos' });
    }

    let businessId;
    try {
      businessId = await resolveBusinessId(rawBizId);
    } catch {
      return res.status(404).json({ message: 'Negocio no encontrado' });
    }
    // Canjear puntos es gastar lo de alguien: solo con la llave de su cuenta.
    if (!abreCuenta(req, businessId, phone)) return res.status(401).json(SIN_CUENTA);

    /* El canje en sí lo hace `services/fidelizacion`, que es el mismo que usa
       la caja. Aquí solo queda lo propio de esta puerta: que el cliente redime
       lo suyo desde el menú, sin cajero de por medio y sin venta a la cual
       atarlo. */
    const salida = await redimir({
      businessId,
      telefono: phone,
      rewardId,
      origen: 'menu',
    });

    return res.status(salida.estado).json(salida.cuerpo);
  } catch (error) {
    if (error.message === 'Puntos insuficientes') {
      return res.status(400).json({ message: error.message });
    }
    logger.error('Error redeeming reward:', error);
    res.status(500).json({ message: 'Error al canjear recompensa' });
  }
});

module.exports = router;
