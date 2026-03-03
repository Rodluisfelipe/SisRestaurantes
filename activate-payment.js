process.chdir('/app');
const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const Subscription = require('./Models/Subscription');
  
  const schema = new mongoose.Schema({}, { strict: false, collection: 'epaycopayments' });
  const EP = mongoose.model('EP', schema);
  
  const ref = 'SUB-05f5ad-1M-1772406891693-8860d430';
  const businessId = '68d86ada90b1fb556405f5ad';
  
  // Update payment to approved
  await EP.updateOne({ reference: ref }, { 
    $set: { 
      status: 'approved',
      epaycoRef: '341148593',
      epaycoTransactionId: '341148593177240693',
      paymentMethod: 'PSE',
      responseCode: 1,
      responseMessage: 'Aceptada'
    }
  });
  console.log('Payment updated to approved');
  
  // Activate subscription
  const GRACE_DAYS = 1;
  const now = new Date();
  const months = 1;
  
  let subscription = await Subscription.findOne({ businessId }).sort({ createdAt: -1 });
  
  let startDate = now;
  if (subscription) {
    const currentEnd = subscription.periodEnd || subscription.endDate;
    if (currentEnd && currentEnd > now) {
      startDate = new Date(currentEnd);
    }
  }
  
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  
  const graceDate = new Date(endDate);
  graceDate.setDate(graceDate.getDate() + GRACE_DAYS);
  
  if (subscription) {
    subscription.status = 'active';
    subscription.periodStart = startDate;
    subscription.periodEnd = endDate;
    subscription.graceUntil = graceDate;
    subscription.price = 30000;
    subscription.paymentMethod = 'epayco';
    subscription.lastPaymentAt = now;
    subscription.lastMonthsPurchased = months;
    await subscription.save();
    console.log('Subscription extended:', subscription._id);
  } else {
    subscription = new Subscription({
      businessId,
      planType: months === 1 ? 'monthly' : months === 3 ? 'quarterly' : months === 6 ? 'biannual' : 'annual',
      status: 'active',
      periodStart: startDate,
      periodEnd: endDate,
      graceUntil: graceDate,
      price: 30000,
      paymentMethod: 'epayco',
      lastPaymentAt: now,
      lastMonthsPurchased: months,
    });
    await subscription.save();
    console.log('New subscription created:', subscription._id);
  }
  
  // Update payment with subscription ID
  await EP.updateOne({ reference: ref }, { $set: { subscriptionId: subscription._id } });
  
  console.log('Done! Subscription active until:', endDate.toISOString());
  console.log('Grace until:', graceDate.toISOString());
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
