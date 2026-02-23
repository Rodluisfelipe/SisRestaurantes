const mongoose = require('mongoose');
require('../config/jwt');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const TG = require('../Models/ToppingGroup');
  const g = await TG.findById('68d8854090b1fb5564060238');
  console.log('Group 68d8854090b1fb5564060238 exists:', !!g);
  if (g) console.log(JSON.stringify(g, null, 2));
  const all = await TG.find({ businessId: '68d86ada90b1fb556405f5ad' });
  console.log('Total groups for macdonalds:', all.length);
  all.forEach(x => console.log(' -', x._id.toString(), x.name));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
