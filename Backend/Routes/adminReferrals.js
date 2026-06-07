const express = require('express');
const router = express.Router();
const ReferralConfig = require('../Models/ReferralConfig');
const Referral = require('../Models/Referral');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin, requireRole } = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { depositCredits } = require('../utils/referralHelper');
const {
  validateUpdateConfig,
  validateApproveReferral,
  validateRejectReferral
} = require('../middleware/validators/referralValidators');

router.use(protectSuperAdmin);

// PUT /config necesita admin+. Aprobar/rechazar referidos: support+. Lecturas: cualquiera.
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  if (req.path === '/config') return requireRole('admin')(req, res, next);
  return requireRole('support')(req, res, next);
});

// ─── GET /api/admin/referrals/config ─── Get referral program config
router.get('/config', async (req, res) => {
  try {
    const config = await ReferralConfig.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Error fetching referral config', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener configuración', 500));
  }
});

// ─── PUT /api/admin/referrals/config ─── Update referral program config
router.put('/config', validateUpdateConfig, async (req, res) => {
  try {
    const config = await ReferralConfig.getConfig();

    const allowed = [
      'isActive', 'referrerDiscountPercent', 'referredDiscountPercent',
      'maxCreditsPerBusiness', 'maxReferralsPerBusiness',
      'requireApproval', 'minSubscriptionMonths'
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        config[key] = req.body[key];
      }
    }

    await config.save();
    logger.info('Referral config updated', { config: config.toObject() }, req);

    res.json({ success: true, config });
  } catch (error) {
    logger.error('Error updating referral config', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar configuración', 500));
  }
});

// ─── GET /api/admin/referrals/overview ─── List all referrals with KPIs
router.get('/overview', async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .populate('referrerBusinessId', 'businessName slug')
        .populate('referredBusinessId', 'businessName slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Referral.countDocuments(query)
    ]);

    // KPIs
    const kpis = await Referral.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          qualified: { $sum: { $cond: [{ $eq: ['$status', 'qualified'] }, 1, 0] } },
          credited: { $sum: { $cond: [{ $eq: ['$status', 'credited'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          totalCreditsAwarded: { $sum: '$referrerCreditsAwarded' }
        }
      }
    ]);

    const stats = kpis[0] || {
      total: 0, pending: 0, qualified: 0, credited: 0, rejected: 0, totalCreditsAwarded: 0
    };
    stats.conversionRate = stats.total > 0
      ? Math.round((stats.credited / stats.total) * 100)
      : 0;

    res.json({
      success: true,
      referrals: referrals.map(r => ({
        id: r._id,
        referrer: r.referrerBusinessId ? {
          id: r.referrerBusinessId._id,
          name: r.referrerBusinessId.businessName,
          slug: r.referrerBusinessId.slug
        } : null,
        referred: r.referredBusinessId ? {
          id: r.referredBusinessId._id,
          name: r.referredBusinessId.businessName,
          slug: r.referredBusinessId.slug
        } : null,
        referralCode: r.referralCode,
        status: r.status,
        referrerCreditsAwarded: r.referrerCreditsAwarded,
        referredDiscountAwarded: r.referredDiscountAwarded,
        qualifiedAt: r.qualifiedAt,
        creditedAt: r.creditedAt,
        rejectedAt: r.rejectedAt,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt
      })),
      kpis: stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching referrals overview', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener referidos', 500));
  }
});

// ─── PATCH /api/admin/referrals/:id/approve ─── Approve a qualified referral
router.patch('/:id/approve', validateApproveReferral, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json(formatHttpError(req, 'Referido no encontrado', 404));
    }

    if (!['qualified', 'pending'].includes(referral.status)) {
      return res.status(400).json(formatHttpError(req,
        `No se puede aprobar un referido con estado '${referral.status}'`, 400));
    }

    // If pending (hasn't paid yet), mark as approved but don't credit yet
    if (referral.status === 'pending') {
      referral.status = 'approved';
      await referral.save();
      return res.json({
        success: true,
        message: 'Referido aprobado. Los créditos se otorgarán cuando el negocio referido pague.',
        referral
      });
    }

    // If qualified → deposit credits
    const result = await depositCredits(referral);
    if (!result.processed) {
      return res.status(500).json(formatHttpError(req, 'Error al depositar créditos', 500));
    }

    logger.info('Referral approved by superadmin', { referralId: referral._id }, req);
    res.json({
      success: true,
      message: 'Referido aprobado y créditos depositados.',
      referral: result.referral
    });
  } catch (error) {
    logger.error('Error approving referral', error, req);
    res.status(500).json(formatHttpError(req, 'Error al aprobar referido', 500));
  }
});

// ─── PATCH /api/admin/referrals/:id/reject ─── Reject a referral
router.patch('/:id/reject', validateRejectReferral, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json(formatHttpError(req, 'Referido no encontrado', 404));
    }

    if (referral.status === 'credited') {
      return res.status(400).json(formatHttpError(req,
        'No se puede rechazar un referido que ya fue acreditado', 400));
    }

    referral.status = 'rejected';
    referral.rejectedAt = new Date();
    referral.rejectionReason = req.body.reason || null;
    await referral.save();

    logger.info('Referral rejected by superadmin', { referralId: referral._id }, req);
    res.json({
      success: true,
      message: 'Referido rechazado.',
      referral
    });
  } catch (error) {
    logger.error('Error rejecting referral', error, req);
    res.status(500).json(formatHttpError(req, 'Error al rechazar referido', 500));
  }
});

// ─── GET /api/admin/referrals/top-referrers ─── Leaderboard
router.get('/top-referrers', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topReferrers = await Referral.aggregate([
      { $match: { status: 'credited' } },
      {
        $group: {
          _id: '$referrerBusinessId',
          totalReferrals: { $sum: 1 },
          totalCredits: { $sum: '$referrerCreditsAwarded' }
        }
      },
      { $sort: { totalReferrals: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'businessconfigs',
          localField: '_id',
          foreignField: '_id',
          as: 'business'
        }
      },
      { $unwind: { path: '$business', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          businessId: '$_id',
          businessName: '$business.businessName',
          slug: '$business.slug',
          totalReferrals: 1,
          totalCredits: 1,
          currentCredits: '$business.referralCredits'
        }
      }
    ]);

    res.json({ success: true, topReferrers });
  } catch (error) {
    logger.error('Error fetching top referrers', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener top referentes', 500));
  }
});

module.exports = router;
