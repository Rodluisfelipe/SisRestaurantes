const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const BusinessConfig = require('./Models/BusinessConfig');
  const Subscription = require('./Models/Subscription');

  // Find businesses
  const allBiz = await BusinessConfig.find({}, 'businessName slug').lean();
  console.log('\n=== All Businesses ===');
  allBiz.forEach(b => console.log(`  ${b._id} | ${b.slug} | ${b.businessName}`));

  // Find Fraise
  const fraise = allBiz.find(b => /fraise/i.test(b.businessName) || /fraise/i.test(b.slug));
  // Find Go Burger
  const goBurger = allBiz.find(b => /go.?burger/i.test(b.businessName) || /go.?burger/i.test(b.slug));

  if (!fraise) { console.error('ERROR: Fraise not found!'); }
  else { console.log(`\nFraise: ${fraise._id} (${fraise.businessName} / ${fraise.slug})`); }

  if (!goBurger) { console.error('ERROR: Go Burger not found!'); }
  else { console.log(`Go Burger: ${goBurger._id} (${goBurger.businessName} / ${goBurger.slug})`); }

  if (!fraise || !goBurger) {
    await mongoose.disconnect();
    process.exit(1);
  }

  // Show current subscriptions
  const fraiseSub = await Subscription.findOne({ businessId: fraise._id }).lean();
  const goBurgerSub = await Subscription.findOne({ businessId: goBurger._id }).lean();
  console.log('\n=== Current Subscriptions ===');
  console.log('Fraise:', fraiseSub ? `plan=${fraiseSub.commercialPlan}, status=${fraiseSub.status}` : 'NO SUBSCRIPTION');
  console.log('Go Burger:', goBurgerSub ? `plan=${goBurgerSub.commercialPlan}, status=${goBurgerSub.status}` : 'NO SUBSCRIPTION');

  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Update Fraise to Pro
  const fraiseResult = await Subscription.findOneAndUpdate(
    { businessId: fraise._id },
    {
      $set: {
        commercialPlan: 'pro',
        status: 'active',
        paymentStatus: 'paid',
        periodStart: now,
        periodEnd: oneYearLater,
        billingCycle: 'annual'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`\nFraise updated to PRO: plan=${fraiseResult.commercialPlan}, status=${fraiseResult.status}`);

  // Update Go Burger to Starter
  const goBurgerResult = await Subscription.findOneAndUpdate(
    { businessId: goBurger._id },
    {
      $set: {
        commercialPlan: 'starter',
        status: 'active',
        paymentStatus: 'paid',
        periodStart: now,
        periodEnd: oneYearLater,
        billingCycle: 'annual'
      }
    },
    { upsert: true, new: true }
  );
  console.log(`Go Burger updated to STARTER: plan=${goBurgerResult.commercialPlan}, status=${goBurgerResult.status}`);

  console.log('\nDone!');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
