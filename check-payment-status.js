process.chdir('/app');
const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(uri).then(async () => {
  const EpaycoPayment = require('./Routes/epaycoPayments');
  // We can't easily import the inline model, so use a generic schema
  const schema = new mongoose.Schema({}, { strict: false, collection: 'epaycopayments' });
  let EP;
  try { EP = mongoose.model('EpaycoPaymentQuery'); } catch(e) { EP = mongoose.model('EpaycoPaymentQuery', schema); }
  
  // Find the payment with reference SUB-05f5ad-1M-1772406891693-8860d430
  const payment = await EP.findOne({ reference: 'SUB-05f5ad-1M-1772406891693-8860d430' }).lean();
  console.log('Payment:', JSON.stringify(payment, null, 2));
  
  // Check all recent payments
  const all = await EP.find({}).sort({ createdAt: -1 }).limit(5).lean();
  all.forEach(p => console.log(p.reference, '|', p.status, '|', p.epaycoRef));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
