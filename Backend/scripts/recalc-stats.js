/**
 * Force recalculate review stats for all businesses
 * Run: node scripts/recalc-stats.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Review = require('../Models/Review');
  const BusinessConfig = require('../Models/BusinessConfig');

  const configs = await BusinessConfig.find({}).select('_id businessName');
  console.log(`Found ${configs.length} business(es)`);

  for (const c of configs) {
    const bid = c._id;

    const stats = await Review.aggregate([
      { $match: { businessId: bid, isVisible: { $ne: false } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          r1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          r2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          r3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          r4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          r5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          thumbsUp: { $sum: { $cond: [{ $eq: ['$thumbsUp', true] }, 1, 0] } },
          thumbsDown: { $sum: { $cond: [{ $eq: ['$thumbsUp', false] }, 1, 0] } },
          thumbsTotal: { $sum: { $cond: [{ $ne: ['$thumbsUp', null] }, 1, 0] } }
        }
      }
    ]);

    const d = stats[0] || {};
    const reviewStats = {
      averageRating: Math.round((d.averageRating || 0) * 10) / 10,
      totalReviews: d.totalReviews || 0,
      ratingBreakdown: { 1: d.r1 || 0, 2: d.r2 || 0, 3: d.r3 || 0, 4: d.r4 || 0, 5: d.r5 || 0 },
      thumbsFeedback: { thumbsUp: d.thumbsUp || 0, thumbsDown: d.thumbsDown || 0, total: d.thumbsTotal || 0 },
      favoriteProductIds: []
    };

    await BusinessConfig.findByIdAndUpdate(bid, { reviewStats });
    console.log(`${c.businessName}: ${reviewStats.totalReviews} reviews, avg ${reviewStats.averageRating}, thumbsUp: ${reviewStats.thumbsFeedback.thumbsUp}`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(e => { console.error(e); process.exit(1); });
