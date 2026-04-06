const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const subs = await m.connection.db.collection('subscriptions').find({}).project({
    businessId: 1, status: 1, paymentStatus: 1, periodStart: 1, periodEnd: 1, graceUntil: 1, planType: 1
  }).toArray();
  const now = new Date();
  subs.forEach(s => {
    const pe = s.periodEnd ? new Date(s.periodEnd) : null;
    const gu = s.graceUntil ? new Date(s.graceUntil) : null;
    let computed = 'active';
    if (pe && now > pe) {
      if (gu && now <= gu) computed = 'grace';
      else computed = 'suspended';
    }
    console.log(`${s._id} | stored=${s.status} | computed=${computed} | periodEnd=${pe ? pe.toISOString().slice(0,10) : 'null'} | graceUntil=${gu ? gu.toISOString().slice(0,10) : 'null'}`);
  });
  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
