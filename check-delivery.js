const m = require('mongoose');
const Order = require('./Models/Order');
m.connect(process.env.MONGODB_URI).then(async () => {
  const o = await Order.findById('69d1547fd2976800135ad7f9').select('status orderType deliveryMode deliveryPersonId confirmationCode').lean();
  console.log('Order:', JSON.stringify(o, null, 2));
  
  // Also check what the domi query would return
  if (o) {
    const filter = {
      businessId: o.businessId,
      orderType: 'delivery',
      status: { $in: ['inProgress'] },
      deliveryMode: { $ne: null }
    };
    const all = await Order.find(filter).select('_id status orderType deliveryMode deliveryPersonId').lean();
    console.log('Domi query results:', JSON.stringify(all, null, 2));
  }
  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
