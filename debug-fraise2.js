const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const Admin = m.model('Admin', new m.Schema({}, { strict: false }));
  const BC = m.model('BusinessConfig', new m.Schema({}, { strict: false }));
  const CO = m.model('CompletedOrder', new m.Schema({}, { strict: false }));

  // Find Fraise business
  const fraise = await BC.findOne({ slug: 'fraise' }).select('_id businessName slug').lean();
  console.log('FRAISE BUSINESS:', JSON.stringify(fraise));

  // Find ALL admin accounts associated with Fraise
  const admins = await Admin.find({ businessId: fraise._id }).select('_id email businessId role').lean();
  console.log('FRAISE ADMINS:', JSON.stringify(admins));

  // Also find admins whose email might match fraise
  const allAdmins = await Admin.find({}).select('_id email businessId role').lean();
  console.log('\nALL ADMINS:');
  for (const a of allAdmins) {
    const bc = await BC.findById(a.businessId).select('businessName slug').lean();
    console.log(`  ${a.email} -> businessId: ${a.businessId} -> ${bc?.businessName || 'NO BUSINESS'} (${bc?.slug || 'no slug'})`);
  }

  // Find which business has ~$104,800 in completed orders this week
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const allBusinesses = await BC.find({}).select('_id businessName slug').lean();
  console.log('\nWEEKLY REVENUE PER BUSINESS:');
  for (const b of allBusinesses) {
    const stats = await CO.aggregate([
      { $match: { businessId: b._id, completedAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);
    const s = stats[0] || { total: 0, count: 0 };
    if (s.count > 0) {
      console.log(`  ${b.businessName} (${b._id}): $${s.total} / ${s.count} orders`);
    }
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
