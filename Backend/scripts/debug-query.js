const m = require('mongoose');
const Order = require('../Models/Order');

m.connect(process.env.MONGODB_URI).then(async () => {
  // Test with string businessId (what createBusinessFilter returns)
  const count1 = await Order.countDocuments({
    businessId: '68d86ada90b1fb556405f5ad',
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
  });
  console.log('String businessId:', count1);

  // Test with ObjectId
  const count2 = await Order.countDocuments({
    businessId: new m.Types.ObjectId('68d86ada90b1fb556405f5ad'),
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
  });
  console.log('ObjectId businessId:', count2);

  // Test with slug resolution via createBusinessFilter
  const { createBusinessFilter } = require('../utils/businessValidator');
  try {
    const filter = await createBusinessFilter('macdonalds');
    console.log('createBusinessFilter result:', JSON.stringify(filter));
    filter.status = { $in: ['pending', 'confirmed', 'preparing', 'ready'] };
    const count3 = await Order.countDocuments(filter);
    console.log('Via createBusinessFilter:', count3);
  } catch (e) {
    console.log('createBusinessFilter error:', e.message);
  }

  // Test exact same query the route does
  const filter2 = await createBusinessFilter('68d86ada90b1fb556405f5ad');
  console.log('createBusinessFilter with ObjectId string:', JSON.stringify(filter2));
  filter2.status = { $in: ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'ready'] };
  const orders = await Order.find(filter2).sort({ createdAt: -1 });
  console.log('Orders found:', orders.length, orders.map(o => ({ s: o.status, n: o.orderNumber })));

  m.disconnect();
});
