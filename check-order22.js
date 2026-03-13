const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Check the specific order that was assigned
  const id = '69b41d533317ecf20463b8f5';
  const o = await mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(id) });
  if (o) {
    console.log('Order found:', {
      orderNumber: o.orderNumber,
      status: o.status,
      orderType: o.orderType,
      deliveryToken: o.deliveryToken,
      deliveryMode: o.deliveryMode,
      confirmationCode: o.confirmationCode,
      deliveryAssignedAt: o.deliveryAssignedAt
    });
  } else {
    console.log('Order not found by ID');
    // Try completed orders
    const c = await mongoose.connection.db.collection('completedorders').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (c) console.log('Found in completedorders:', { orderNumber: c.orderNumber, status: c.status, deliveryToken: c.deliveryToken });
    else console.log('Not found in completedorders either');
  }
  process.exit();
});
