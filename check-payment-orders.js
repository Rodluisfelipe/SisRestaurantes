const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrders() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Check recent active orders
  const orders = await db.collection('orders')
    .find({}, { projection: { orderNumber: 1, paymentMethod: 1, orderType: 1, customerName: 1, status: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log('=== RECENT ACTIVE ORDERS ===');
  orders.forEach(o => {
    console.log(`#${o.orderNumber} | ${o.customerName} | ${o.orderType} | status: ${o.status} | paymentMethod: ${JSON.stringify(o.paymentMethod)}`);
  });

  // Check recent completed orders too
  const completed = await db.collection('completedorders')
    .find({}, { projection: { orderNumber: 1, paymentMethod: 1, orderType: 1, customerName: 1, status: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log('\n=== RECENT COMPLETED ORDERS ===');
  completed.forEach(o => {
    console.log(`#${o.orderNumber} | ${o.customerName} | ${o.orderType} | status: ${o.status} | paymentMethod: ${JSON.stringify(o.paymentMethod)}`);
  });

  // Check business config paymentMethods
  const configs = await db.collection('businessconfigs')
    .find({}, { projection: { businessName: 1, paymentMethods: 1, paymentInfo: 1 } })
    .toArray();

  console.log('\n=== BUSINESS CONFIGS - PAYMENT METHODS ===');
  configs.forEach(c => {
    console.log(`\n${c.businessName}:`);
    console.log('  paymentMethods:', JSON.stringify(c.paymentMethods || 'NOT SET'));
    const pi = c.paymentInfo || {};
    console.log('  paymentInfo:', JSON.stringify({ nequi: pi.nequi, daviplata: pi.daviplata, bank: pi.bankAccountNumber }));
  });

  await mongoose.disconnect();
}

checkOrders().catch(e => { console.error(e); process.exit(1); });
