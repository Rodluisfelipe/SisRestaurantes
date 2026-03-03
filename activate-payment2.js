process.chdir('/app');
const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const Subscription = require('./Models/Subscription');
  const schema = new mongoose.Schema({}, { strict: false, collection: 'epaycopayments' });
  const EP = mongoose.model('EP2', schema);
  
  const ref = 'SUB-05f5ad-1M-1772406891693-8860d430';
  const businessId = '68d86ada90b1fb556405f5ad';
  
  await EP.updateOne({ reference: ref }, { $set: { 
    status: 'approved', epaycoRef: '341148593', 
    epaycoTransactionId: '341148593177240693', paymentMethod: 'PSE',
    responseCode: 1, responseMessage: 'Aceptada'
  }});
  console.log('Payment updated to approved');
  
  const now = new Date();
  let subscription = await Subscription.findOne({ businessId }).sort({ createdAt: -1 });
  
  let startDate = now;
  if (subscription) {
    const currentEnd = subscription.periodEnd || subscription.endDate;
    if (currentEnd && currentEnd > now) startDate = new Date(currentEnd);
  }
  
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  const graceDate = new Date(endDate);
  graceDate.setDate(graceDate.getDate() + 1);
  
  if (subscription) {
    subscription.planType = 'monthly';
    subscription.status = 'active';
    subscription.paymentStatus = 'paid';
    subscription.isActive = true;
    subscription.startDate = subscription.startDate || startDate;
    subscription.endDate = endDate;
    subscription.periodStart = startDate;
    subscription.periodEnd = endDate;
    subscription.graceUntil = graceDate;
    subscription.price = 30000;
    subscription.paymentMethod = 'PSE';
    subscription.notes = 'ePayco - Ref: ' + ref;
    subscription.isTrialPeriod = false;
    await subscription.save();
    console.log('Subscription extended:', subscription._id);
  } else {
    subscription = new Subscription({
      businessId, planType: 'monthly', status: 'active', paymentStatus: 'paid',
      isActive: true, startDate, endDate, periodStart: startDate, periodEnd: endDate,
      graceUntil: graceDate, price: 30000, paymentMethod: 'PSE',
      notes: 'ePayco - Ref: ' + ref, isTrialPeriod: false,
    });
    await subscription.save();
    console.log('New subscription created:', subscription._id);
  }
  
  await EP.updateOne({ reference: ref }, { $set: { subscriptionId: subscription._id } });
  console.log('Active until:', endDate.toISOString(), '| Grace until:', graceDate.toISOString());
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
