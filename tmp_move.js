const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const ObjectId = mongoose.Types.ObjectId;
  const orderId = new ObjectId('699e3f9d70c6fcd1db6499a6');
  
  // Get the order
  const order = await mongoose.connection.db.collection('orders').findOne({ _id: orderId });
  if (!order) { console.log('Order not found'); process.exit(0); }
  console.log('Order found:', order.customerName, '| Status:', order.status);
  
  // Insert into completedorders
  const completedOrder = { ...order, completedAt: new Date() };
  await mongoose.connection.db.collection('completedorders').insertOne(completedOrder);
  console.log('Moved to completedorders');
  
  // Remove from orders
  await mongoose.connection.db.collection('orders').deleteOne({ _id: orderId });
  console.log('Removed from active orders');
  
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
