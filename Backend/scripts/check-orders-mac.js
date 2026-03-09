const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const BC = m.model('BusinessConfig', new m.Schema({}, { strict: false }));
  const biz = await BC.findOne({ slug: 'macdonalds' }).select('_id slug businessName').lean();
  if (!biz) { console.log('No business found with slug macdonalds'); m.disconnect(); return; }
  console.log('Business:', JSON.stringify(biz));
  const O = m.model('Order', new m.Schema({}, { strict: false }));
  const all = await O.find({ businessId: biz._id })
    .select('status orderNumber orderChannel createdAt')
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();
  console.log('Orders:', JSON.stringify(all.map(o => ({ s: o.status, n: o.orderNumber, ch: o.orderChannel })), null, 2));
  const active = all.filter(o => ['pending','confirmed','preparing','ready'].includes(o.status));
  console.log('Active count:', active.length);
  m.disconnect();
});
