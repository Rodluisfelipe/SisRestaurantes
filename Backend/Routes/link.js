const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const Brand = require('../Models/Brand');
const Product = require('../Models/Product');
const Review = require('../Models/Review');
const mongoose = require('mongoose');

const { estaAbiertoAhora } = require('../utils/marketplace');

const BIZ_FIELDS = 'businessName tagline description logo coverImage slug address googleMapsUrl whatsappNumber socialMedia extraLink theme businessHours isOpen menuStatus branchLabel isMainBranch brandId location';

// GET /api/link/:slug — public link page data
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Try Brand first (multi-branch)
    const brand = await Brand.findOne({ slug }).lean();
    if (brand) {
      const branches = await BusinessConfig.find(
        { brandId: brand._id, isActive: { $ne: false } },
        BIZ_FIELDS
      ).lean();

      // Use main branch for featured products and reviews
      const mainBranch = branches.find(b => b.isMainBranch) || branches[0];

      const [featuredProducts, reviewStats] = await Promise.all([
        mainBranch ? Product.find({ businessId: mainBranch._id, isFeatured: true, active: true })
          .select('name price image description').limit(8).sort({ featuredOrder: 1 }).lean() : [],
        mainBranch ? Review.aggregate([
          { $match: { businessId: new mongoose.Types.ObjectId(String(mainBranch._id)) } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]) : []
      ]);

      return res.json({
        type: 'brand',
        brand: { name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl },
        mainBranch: mainBranch ? {
          ...mainBranch,
          isCurrentlyOpen: estaAbiertoAhora(mainBranch),
        } : null,
        branches: branches.map(b => ({
          ...b,
          isCurrentlyOpen: estaAbiertoAhora(b),
        })),
        featuredProducts,
        avgRating: reviewStats[0]?.avg ? Math.round(reviewStats[0].avg * 10) / 10 : null,
        reviewCount: reviewStats[0]?.count || 0,
      });
    }

    // Try single business
    const biz = await BusinessConfig.findOne({ slug, isActive: { $ne: false } }, BIZ_FIELDS).lean();
    if (!biz) return res.status(404).json({ message: 'No encontrado' });

    const [featuredProducts, reviewStats] = await Promise.all([
      Product.find({ businessId: biz._id, isFeatured: true, active: true })
        .select('name price image description').limit(8).sort({ featuredOrder: 1 }).lean(),
      Review.aggregate([
        { $match: { businessId: new mongoose.Types.ObjectId(String(biz._id)) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      type: 'single',
      business: { ...biz, isCurrentlyOpen: estaAbiertoAhora(biz) },
      featuredProducts,
      avgRating: reviewStats[0]?.avg ? Math.round(reviewStats[0].avg * 10) / 10 : null,
      reviewCount: reviewStats[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
