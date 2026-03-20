require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const products = await mongoose.connection.db.collection('products').find({ image: { $exists: true, $ne: null } }).limit(5).toArray();
  products.forEach(p => console.log(`Product: ${p.name} => ${p.image}`));
  const configs = await mongoose.connection.db.collection('businessconfigs').find({ logo: { $exists: true, $ne: null } }).limit(3).toArray();
  configs.forEach(c => console.log(`Config: ${c.businessName} logo => ${c.logo}`));
  await mongoose.disconnect();
});
