// Quick script to delete all cancelled orders
const mongoose = require('mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = require('../Models/Order');
  const cancelled = await Order.find({ status: 'cancelled' }).select('orderNumber status createdAt');
  console.log('Found cancelled:', cancelled.length);
  cancelled.forEach(o => console.log(`  #${o.orderNumber} - ${o.status}`));
  const result = await Order.deleteMany({ status: 'cancelled' });
  console.log('Deleted:', result.deletedCount);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
