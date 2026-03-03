process.chdir('/app');
const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
mongoose.connect(uri).then(async () => {
  const schema = new mongoose.Schema({}, { strict: false, collection: 'epaycopayments' });
  const EpaycoPayment = mongoose.model('EpaycoPayment', schema);
  const result = await EpaycoPayment.updateMany(
    { status: 'created' },
    { $set: { status: 'expired' } }
  );
  console.log('Expired:', result.modifiedCount, 'records');
  const remaining = await EpaycoPayment.find({}).select('reference status createdAt').lean();
  remaining.forEach(p => console.log(p.reference, '|', p.status, '|', p.createdAt));
  console.log('Total:', remaining.length);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
