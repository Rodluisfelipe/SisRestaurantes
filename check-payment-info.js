const mongoose = require('mongoose');
const BusinessConfig = require('./Models/BusinessConfig');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/restaurant').then(async () => {
  const configs = await BusinessConfig.find({}, 'businessName paymentInfo paymentMethods').lean();
  configs.forEach(c => {
    console.log('=== ' + c.businessName + ' ===');
    console.log('paymentInfo:', JSON.stringify(c.paymentInfo, null, 2));
    console.log('paymentMethods:', JSON.stringify(c.paymentMethods, null, 2));
  });
  process.exit(0);
});
