const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const O = m.model('Order', new m.Schema({}, { strict: false }));
  const all = await O.find({ businessId: new m.Types.ObjectId('68c4a2aab447abb220e84347') })
    .select('status orderNumber createdAt')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  console.log(JSON.stringify(all.map(o => ({ s: o.status, n: o.orderNumber })), null, 2));
  m.disconnect();
});
