process.chdir('/app');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const payments = await mongoose.connection.db.collection('epaycopayments').find({}).sort({createdAt:-1}).limit(10).toArray();
  payments.forEach(p => {
    console.log(p.reference, '|', p.status, '|', p.createdAt);
  });
  console.log('Total:', payments.length);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
