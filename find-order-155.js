const mongoose = require('mongoose');
const Order = require('./Models/Order');
const CompletedOrder = require('./Models/CompletedOrder');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const active = await Order.find({ orderNumber: 155 }).lean();
  const completed = await CompletedOrder.find({ orderNumber: 155 }).lean();
  
  const all = [...active.map(o => ({...o, _source: 'Order'})), ...completed.map(o => ({...o, _source: 'CompletedOrder'}))];
  console.log('Total encontrados:', all.length);
  all.forEach((o, i) => {
    console.log(`\n--- #${i+1} (${o._source}) ---`);
    console.log('Business:', o.businessId);
    console.log('Cliente:', o.customerName);
    console.log('Estado:', o.status);
    console.log('Canal:', o.orderChannel);
    console.log('Creado:', o.createdAt);
    console.log('Items:', (o.items||[]).map(it => it.name).join(', '));
    console.log('Total:', o.finalAmount || o.totalAmount);
  });
  process.exit();
}
run();
