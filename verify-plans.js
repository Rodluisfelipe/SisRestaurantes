const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await mongoose.connection.db.collection('subscriptions').find({
    businessId: { $in: [
      new mongoose.Types.ObjectId('699f8ae070c6fcd1db64bb0d'),
      new mongoose.Types.ObjectId('68c4a2aab447abb220e84347')
    ]}
  }).toArray();
  docs.forEach(d => {
    console.log(`ID: ${d.businessId}`);
    console.log(`  commercialPlan: ${d.commercialPlan}`);
    console.log(`  status: ${d.status}`);
    console.log(`  billingCycle: ${d.billingCycle}`);
    console.log(`  periodEnd: ${d.periodEnd}`);
    console.log('---');
  });
  await mongoose.disconnect();
}
run().catch(console.error);
