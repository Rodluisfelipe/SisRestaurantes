const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const BC = m.model('BusinessConfig', new m.Schema({}, { strict: false }));
  const CO = m.model('CompletedOrder', new m.Schema({}, { strict: false }));
  const O = m.model('Order', new m.Schema({}, { strict: false }));

  // Find Fraise business
  const b = await BC.findOne({ slug: 'fraise' }).select('_id businessName slug').lean();
  console.log('BUSINESS:', JSON.stringify(b));

  if (!b) { console.log('NOT FOUND'); process.exit(1); }
  const bid = b._id;

  // Count orders in each collection
  const activeCount = await O.countDocuments({ businessId: bid });
  const completedCount = await CO.countDocuments({ businessId: bid });
  console.log('Active orders:', activeCount, '| Completed orders:', completedCount);

  // Last 7 days completed orders with daily totals
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const weekly = await CO.aggregate([
    { $match: { businessId: bid, completedAt: { $gte: weekAgo } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: 'America/Bogota' } },
      orders: { $sum: 1 },
      revenue: { $sum: '$totalAmount' }
    }},
    { $sort: { _id: 1 } }
  ]);
  console.log('WEEKLY (CompletedOrder by completedAt):', JSON.stringify(weekly));

  // Also check by createdAt in case completedAt is wrong
  const weeklyByCreated = await CO.aggregate([
    { $match: { businessId: bid, createdAt: { $gte: weekAgo } } },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'America/Bogota' } },
      orders: { $sum: 1 },
      revenue: { $sum: '$totalAmount' }
    }},
    { $sort: { _id: 1 } }
  ]);
  console.log('WEEKLY (CompletedOrder by createdAt):', JSON.stringify(weeklyByCreated));

  // Show last 5 completed orders with key fields
  const recent = await CO.find({ businessId: bid }).sort({ completedAt: -1 }).limit(5)
    .select('orderNumber customerName totalAmount completedAt createdAt items').lean();
  console.log('RECENT COMPLETED:');
  recent.forEach(o => {
    console.log(`  #${o.orderNumber} ${o.customerName} $${o.totalAmount} completedAt:${o.completedAt?.toISOString()} createdAt:${o.createdAt?.toISOString()} items:${o.items?.length}`);
  });

  // Show last 5 active orders
  const activeRecent = await O.find({ businessId: bid }).sort({ createdAt: -1 }).limit(5)
    .select('orderNumber customerName totalAmount status createdAt items').lean();
  console.log('RECENT ACTIVE:');
  activeRecent.forEach(o => {
    console.log(`  #${o.orderNumber} ${o.customerName} $${o.totalAmount} status:${o.status} createdAt:${o.createdAt?.toISOString()} items:${o.items?.length}`);
  });

  // Total revenue all time from CompletedOrders
  const allTime = await CO.aggregate([
    { $match: { businessId: bid } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
  ]);
  console.log('ALL TIME COMPLETED:', JSON.stringify(allTime));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
