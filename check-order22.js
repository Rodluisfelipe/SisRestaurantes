const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  let o = await mongoose.connection.db.collection('orders').findOne({ orderNumber: 22 });
  if (!o) o = await mongoose.connection.db.collection('orders').findOne({ orderNumber: '22' });
  if (!o) {
    const all = await mongoose.connection.db.collection('orders').find({}).project({ orderNumber: 1, status: 1, orderType: 1 }).toArray();
    console.log('All orders:', JSON.stringify(all, null, 2));
    process.exit();
    return;
  }
  console.log(JSON.stringify({
    orderNumber: o.orderNumber,
    status: o.status,
    orderType: o.orderType,
    deliveryToken: o.deliveryToken || null,
    deliveryPersonId: o.deliveryPersonId || null,
    confirmationCode: o.confirmationCode || null,
    deliveryMode: o.deliveryMode || null
  }, null, 2));
  process.exit();
});
