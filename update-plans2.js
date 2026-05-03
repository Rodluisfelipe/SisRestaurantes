const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Update directly via native driver to bypass Mongoose validation
  const subs = mongoose.connection.db.collection('subscriptions');

  // Fraise -> Pro
  const fraiseResult = await subs.updateOne(
    { businessId: new mongoose.Types.ObjectId('699f8ae070c6fcd1db64bb0d') },
    { $set: {
      commercialPlan: 'pro',
      billingCycle: 'annual',
      status: 'active',
      paymentStatus: 'paid',
      periodStart: now,
      periodEnd: oneYearLater,
      planType: 'annual',
      startDate: now,
      endDate: oneYearLater,
      price: 49900,
      isActive: true
    }}
  );
  console.log('Fraise -> Pro:', fraiseResult.modifiedCount > 0 ? 'UPDATED' : 'NOT FOUND');

  // Go Burger -> Starter
  const goResult = await subs.updateOne(
    { businessId: new mongoose.Types.ObjectId('68c4a2aab447abb220e84347') },
    { $set: {
      commercialPlan: 'starter',
      billingCycle: 'annual',
      status: 'active',
      paymentStatus: 'paid',
      periodStart: now,
      periodEnd: oneYearLater,
      planType: 'annual',
      startDate: now,
      endDate: oneYearLater,
      price: 34900,
      isActive: true
    }}
  );
  console.log('Go Burger -> Starter:', goResult.modifiedCount > 0 ? 'UPDATED' : 'NOT FOUND');

  // Verify
  const docs = await subs.find({
    businessId: { $in: [
      new mongoose.Types.ObjectId('699f8ae070c6fcd1db64bb0d'),
      new mongoose.Types.ObjectId('68c4a2aab447abb220e84347')
    ]}
  }).toArray();
  
  docs.forEach(d => {
    console.log(`\n${d.businessId}: commercialPlan=${d.commercialPlan}, status=${d.status}, billingCycle=${d.billingCycle}`);
  });

  await mongoose.disconnect();
  console.log('\nDone!');
}
run().catch(err => { console.error(err); process.exit(1); });
