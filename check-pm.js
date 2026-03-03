const mongoose = require('mongoose');
const BC = require('./Backend/Models/BusinessConfig');
const dotenv = require('dotenv');
dotenv.config({ path: './Backend/.env' });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sisrestaurantes').then(async () => {
  const b = await BC.findOne({ slug: 'macdonalds' });
  console.log('orderingMode:', b.orderingMode);
  console.log('paymentMethods:', JSON.stringify(b.paymentMethods, null, 2));
  console.log('paymentInfo.nequi:', b.paymentInfo?.nequi);
  console.log('paymentInfo.daviplata:', b.paymentInfo?.daviplata);
  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
