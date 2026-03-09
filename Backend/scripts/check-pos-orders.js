const mongoose = require('mongoose');
const Order = require('../Models/Order');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const bid = '68d86ada90b1fb556405f5ad';
  
  // Check all orders for this business
  const all = await Order.find({ businessId: bid }).select('orderNumber status orderChannel createdAt');
  console.log('Total orders for macdonalds:', all.length);
  all.forEach(o => console.log(o.orderNumber, o.status, o.orderChannel, o.createdAt));
  
  // Check with the exact status filter POSActiveOrders uses
  const statuses = ['pending','pending_payment','payment_uploaded','payment_confirmed','confirmed','preparing','ready'];
  const filtered = await Order.find({ businessId: bid, status: { $in: statuses } }).select('orderNumber status orderChannel');
  console.log('\nFiltered orders (with $in):', filtered.length);
  filtered.forEach(o => console.log(o.orderNumber, o.status, o.orderChannel));
  
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
