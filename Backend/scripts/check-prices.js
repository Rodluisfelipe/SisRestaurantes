require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Product = require('../Models/Product');
  const products = await Product.find({ businessId: '68d86ada90b1fb556405f5ad' }).select('name price basePrice').lean();
  products.forEach(p => {
    console.log(`${p.name} | price: ${p.price} | basePrice: ${p.basePrice || 'N/A'}`);
  });
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
