process.chdir('/app');
const mongoose = require('mongoose');
require('dotenv').config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
mongoose.connect(uri).then(async () => {
  const BC = require('./Models/BusinessConfig');
  const b1 = await BC.findById('699f8ae070c6fcd1db64bb0d').select('businessName slug').lean();
  const b2 = await BC.findById('68d86ada90b1fb556405f5ad').select('businessName slug').lean();
  console.log('699f8ae0... =>', JSON.stringify(b1));
  console.log('68d86ada... =>', JSON.stringify(b2));
  
  const Admin = require('./Models/Admin');
  const admins = await Admin.find({ businessId: { $in: ['699f8ae070c6fcd1db64bb0d', '68d86ada90b1fb556405f5ad'] } }).select('email businessId role').lean();
  console.log('Admins:', JSON.stringify(admins, null, 2));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
