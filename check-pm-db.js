const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const r = await m.connection.db.collection('businessconfigs').findOne(
    { slug: 'macdonalds' },
    { projection: { paymentMethods: 1 } }
  );
  console.log(JSON.stringify(r, null, 2));
  process.exit();
});
