/**
 * Audit stale orders - check orders stuck in pending states
 * Run inside Docker: docker exec sisrestaurantes-backend-1 node scripts/audit-stale-orders.js
 */
const mongoose = require('mongoose');

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = require('../Models/Order');
  
  // Count orders by status
  const byStatus = await Order.aggregate([
    { $group: { 
      _id: '$status', 
      count: { $sum: 1 },
      oldest: { $min: '$createdAt' },
      newest: { $max: '$createdAt' }
    }},
    { $sort: { count: -1 } }
  ]);
  
  console.log('\n=== ORDERS BY STATUS ===');
  byStatus.forEach(s => {
    const oldestAge = s.oldest ? Math.round((Date.now() - new Date(s.oldest).getTime()) / 3600000) : 0;
    const newestAge = s.newest ? Math.round((Date.now() - new Date(s.newest).getTime()) / 3600000) : 0;
    console.log(`  ${s._id}: ${s.count} orders (oldest: ${oldestAge}h ago, newest: ${newestAge}h ago)`);
  });
  
  // Stale orders (pending states older than 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const staleOrders = await Order.find({
    status: { $in: ['pending', 'pending_payment', 'payment_uploaded'] },
    createdAt: { $lt: twoHoursAgo }
  }).select('orderNumber status createdAt businessId customerName totalAmount').sort({ createdAt: 1 });
  
  console.log(`\n=== STALE ORDERS (>2h in pending state): ${staleOrders.length} ===`);
  staleOrders.forEach(o => {
    const ageH = Math.round((Date.now() - o.createdAt.getTime()) / 3600000);
    console.log(`  #${o.orderNumber} | ${o.status} | ${ageH}h ago | $${o.totalAmount} | ${o.customerName} | biz:${o.businessId}`);
  });
  
  // Total active orders (non-completed, non-cancelled)
  const activeCount = await Order.countDocuments({
    status: { $nin: ['completed', 'cancelled', 'delivered'] }
  });
  console.log(`\n=== TOTAL ACTIVE (non-completed) ORDERS: ${activeCount} ===`);
  
  process.exit(0);
}

audit().catch(err => { console.error(err); process.exit(1); });
