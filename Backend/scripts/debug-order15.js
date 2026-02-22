const mongoose = require('mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = require('../Models/Order');
  
  // Find order #15
  const order = await Order.findOne({ orderNumber: '15' });
  if (!order) {
    console.log('Order #15 not found in active orders');
    // Check completed orders
    const CompletedOrder = require('../Models/CompletedOrder');
    const co = await CompletedOrder.findOne({ orderNumber: '15' });
    if (co) {
      console.log('Found in CompletedOrder:');
      console.log('  phone:', JSON.stringify(co.phone));
      console.log('  customerPhone:', JSON.stringify(co.customerPhone));
    } else {
      console.log('Not found in CompletedOrder either');
    }
  } else {
    console.log('Order #15 found in active orders:');
    console.log('  phone:', JSON.stringify(order.phone));
    console.log('  customerName:', order.customerName);
    console.log('  status:', order.status);
    console.log('  businessId:', order.businessId.toString());
    console.log('  orderChannel:', order.orderChannel);
    console.log('  customerToken:', order.customerToken ? order.customerToken.substring(0, 10) + '...' : 'null');
  }

  // Also show what completed orders exist for phone 3028181520
  const CompletedOrder = require('../Models/CompletedOrder');
  const completedForPhone = await CompletedOrder.find({ phone: '3028181520' }).select('orderNumber phone status').limit(5);
  console.log('\nCompleted orders for 3028181520:', completedForPhone.length);
  completedForPhone.forEach(o => console.log('  #' + o.orderNumber, o.phone, o.status));

  // Check active orders for same phone
  const activeForPhone = await Order.find({ phone: '3028181520' }).select('orderNumber phone status');
  console.log('\nActive orders for 3028181520:', activeForPhone.length);
  activeForPhone.forEach(o => console.log('  #' + o.orderNumber, JSON.stringify(o.phone), o.status));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
