const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const now = new Date();
  const result = await mongoose.connection.db.collection('completedorders').insertOne({
    businessId: new mongoose.Types.ObjectId('68c4a2aab447abb220e84347'),
    orderNumber: '1',
    customerName: 'Katherine Gutierrez',
    phone: '3008707980',
    orderType: 'delivery',
    status: 'completed',
    address: 'Calle 21 #5-33, interior 9, casa 6, manzana e, Barrio: sector Maderos',
    items: [],
    totalAmount: 103500,
    createdAt: now,
    completedAt: now,
    includedInReport: false,
    __v: 0
  });
  console.log('Inserted:', result.insertedId);
  await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
