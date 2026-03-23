const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const BusinessConfig = require('../Models/BusinessConfig');
const Referral = require('../Models/Referral');
const ReferralConfig = require('../Models/ReferralConfig');
const { resolveBusinessId } = require('../utils/businessResolver');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { validateReferralCode } = require('../middleware/validators/referralValidators');

// Helper: get the effective businessId for admin routes
async function getAdminBusinessId(req) {
  if (req.user.businessId) return req.user.businessId;
  const raw = req.query.businessId || req.body.businessId;
  if (!raw) return null;
  return resolveBusinessId(raw);
}

// Rate limiter for public validation endpoint
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { valid: false, reason: 'Demasiadas solicitudes, intenta más tarde.' }
});

// Charset for code generation (same as Coupon model — no I, O, 0, 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateUniqueCode() {
  let code;
  let exists = true;
  while (exists) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    const existing = await BusinessConfig.findOne({ referralCode: code });
    exists = !!existing;
  }
  return code;
}

// ─── GET /api/referrals/my-code ─── Get or generate referral code
router.get('/my-code', authMiddleware, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const config = await ReferralConfig.getConfig();
    if (!config.isActive) {
      return res.status(400).json({ message: 'El programa de referidos no está activo.' });
    }

    let business = await BusinessConfig.findById(businessId).select('referralCode referralCredits businessName');
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    // Generate code if doesn't exist yet
    if (!business.referralCode) {
      const code = await generateUniqueCode();
      business.referralCode = code;
      await business.save();
    }

    // Count existing referrals
    const referralCount = await Referral.countDocuments({ referrerBusinessId: businessId });

    const frontendUrl = process.env.FRONTEND_URL || 'https://www.menuby.tech';
    res.json({
      success: true,
      referralCode: business.referralCode,
      referralCredits: business.referralCredits || 0,
      referralCount,
      maxReferrals: config.maxReferralsPerBusiness,
      shareUrl: `${frontendUrl}/register?ref=${business.referralCode}`,
      config: {
        referrerDiscountPercent: config.referrerDiscountPercent,
        referredDiscountPercent: config.referredDiscountPercent
      }
    });
  } catch (error) {
    logger.error('Error getting referral code', error, req);
    res.status(500).json({ message: 'Error al obtener código de referido' });
  }
});

// ─── GET /api/referrals/my-referrals ─── List referrals made by this business
router.get('/my-referrals', authMiddleware, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [referrals, total] = await Promise.all([
      Referral.find({ referrerBusinessId: businessId })
        .populate('referredBusinessId', 'businessName slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Referral.countDocuments({ referrerBusinessId: businessId })
    ]);

    // Stats
    const stats = await Referral.aggregate([
      { $match: { referrerBusinessId: require('mongoose').Types.ObjectId.createFromHexString(businessId.toString()) } },
      {
        $group: {
          _id: null,
          totalReferred: { $sum: 1 },
          totalCredited: { $sum: { $cond: [{ $eq: ['$status', 'credited'] }, 1, 0] } },
          totalCredits: { $sum: '$referrerCreditsAwarded' }
        }
      }
    ]);

    res.json({
      success: true,
      referrals: referrals.map(r => ({
        id: r._id,
        referredBusiness: r.referredBusinessId ? {
          name: r.referredBusinessId.businessName,
          slug: r.referredBusinessId.slug
        } : null,
        status: r.status,
        creditsAwarded: r.referrerCreditsAwarded,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        creditedAt: r.creditedAt
      })),
      stats: stats[0] || { totalReferred: 0, totalCredited: 0, totalCredits: 0 },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching referrals', error, req);
    res.status(500).json({ message: 'Error al obtener referidos' });
  }
});

// ─── GET /api/referrals/my-credits ─── Credit balance + history
router.get('/my-credits', authMiddleware, async (req, res) => {
  try {
    const businessId = await getAdminBusinessId(req);
    if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

    const business = await BusinessConfig.findById(businessId).select('referralCredits');
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    const creditedReferrals = await Referral.find({
      referrerBusinessId: businessId,
      status: 'credited'
    })
      .populate('referredBusinessId', 'businessName')
      .sort({ creditedAt: -1 })
      .limit(50);

    res.json({
      success: true,
      credits: business.referralCredits || 0,
      history: creditedReferrals.map(r => ({
        referredBusiness: r.referredBusinessId?.businessName || 'N/A',
        amount: r.referrerCreditsAwarded,
        date: r.creditedAt
      }))
    });
  } catch (error) {
    logger.error('Error fetching referral credits', error, req);
    res.status(500).json({ message: 'Error al obtener créditos' });
  }
});

// ─── GET /api/referrals/validate/:code ─── Public: validate a referral code
router.get('/validate/:code', validateLimiter, validateReferralCode, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();

    const config = await ReferralConfig.getConfig();
    if (!config.isActive) {
      return res.json({ valid: false, reason: 'Programa de referidos no disponible.' });
    }

    const business = await BusinessConfig.findOne({ referralCode: code }).select('businessName');
    if (!business) {
      return res.json({ valid: false, reason: 'Código no encontrado.' });
    }

    res.json({
      valid: true,
      referrerName: business.businessName
    });
  } catch (error) {
    logger.error('Error validating referral code', error, req);
    res.status(500).json({ valid: false, reason: 'Error al validar código.' });
  }
});

module.exports = router;
