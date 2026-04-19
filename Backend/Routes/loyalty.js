const express = require('express');
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
        rewards: []
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
      tiersEnabled, tiers, rewards
    } = req.body;

    const planGate = await getPlanGateInfo(businessId);

    const requestedTiersEnabled = tiersEnabled === true || tiersEnabled === 'true';
    const hasTierPayload = Array.isArray(tiers) && tiers.length > 0;
    if (requestedTiersEnabled || hasTierPayload) {
      if (!planGate.hasLoyaltyTiers) {
        return res.status(403).json({
          message: 'Tu plan actual no incluye niveles de lealtad (tiers).',
          code: 'PLAN_FEATURE_NOT_AVAILABLE',
          feature: 'loyaltyTiers',
          plan: planGate.commercialPlan
        });
      }
    }

    const wantsRewards = Array.isArray(rewards) && rewards.length > 0;
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

    if (Array.isArray(tiers)) {
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
          timesRedeemed: r.timesRedeemed || 0
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
      query.phone = { $regex: search, $options: 'i' };
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

    // Check if loyalty program is active
    const program = await LoyaltyProgram.findOne({ businessId, isActive: true }).lean();
    if (!program) {
      return res.json({ active: false });
    }

    const { hasLoyaltyRewards } = await getPlanGateInfo(businessId);

    const loyalty = await CustomerLoyalty.findOne({ businessId, phone }).lean();
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

    const program = await LoyaltyProgram.findOne({ businessId, isActive: true });
    if (!program) {
      return res.status(404).json({ message: 'Programa de fidelidad no disponible' });
    }

    const { hasLoyaltyRewards, commercialPlan } = await getPlanGateInfo(businessId);
    if (!hasLoyaltyRewards) {
      return res.status(403).json({
        message: 'Tu plan actual no incluye recompensas canjeables.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'loyaltyRewards',
        plan: commercialPlan
      });
    }

    const reward = program.rewards.id(rewardId);
    if (!reward || !reward.isActive) {
      return res.status(404).json({ message: 'Recompensa no encontrada o inactiva' });
    }

    // Atomic deduction: only succeeds if points >= cost (prevents race conditions)
    const loyalty = await CustomerLoyalty.findOneAndUpdate(
      { businessId, phone, points: { $gte: reward.pointsCost } },
      {
        $inc: { points: -reward.pointsCost, totalRedeemed: reward.pointsCost },
        $set: { lastActivityAt: new Date() },
        $push: {
          transactions: {
            type: 'redeem',
            points: -reward.pointsCost,
            description: `Canjeo: ${reward.name}`,
            rewardId: reward._id,
            rewardName: reward.name,
            createdAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!loyalty) {
      // Check if customer exists at all
      const exists = await CustomerLoyalty.findOne({ businessId, phone });
      if (!exists) {
        return res.status(404).json({ message: 'No tienes puntos acumulados' });
      }
      return res.status(400).json({
        message: 'Puntos insuficientes',
        required: reward.pointsCost,
        available: exists.points
      });
    }

    // Update tier after atomic deduction
    if (program.tiersEnabled && program.tiers.length) {
      loyalty.computeTier(program.tiers);
      await loyalty.save();
    }

    // Increment reward counter
    reward.timesRedeemed = (reward.timesRedeemed || 0) + 1;
    await program.save();

    // Build the discount info to return
    const redemptionResult = {
      success: true,
      pointsSpent: reward.pointsCost,
      remainingPoints: loyalty.points,
      reward: {
        name: reward.name,
        type: reward.type,
        discountValue: reward.discountValue,
        maxDiscount: reward.maxDiscount,
        productId: reward.productId,
        productName: reward.productName
      }
    };

    res.json(redemptionResult);
  } catch (error) {
    if (error.message === 'Puntos insuficientes') {
      return res.status(400).json({ message: error.message });
    }
    logger.error('Error redeeming reward:', error);
    res.status(500).json({ message: 'Error al canjear recompensa' });
  }
});

module.exports = router;
