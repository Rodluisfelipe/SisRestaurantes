/**
 * Migration: backfill orderChannel and paymentMethod on CompletedOrders
 * 
 * Existing completed orders were created before these fields were added to the schema.
 * - orderChannel: default was 'whatsapp' in Order schema, so backfill with 'whatsapp'
 * - paymentMethod: can't recover, leave as null (dashboard will label it properly)
 */
const m = require('mongoose');

m.connect(process.env.MONGODB_URI).then(async () => {
  const CO = m.connection.collection('completedorders');

  // 1. Backfill orderChannel = 'whatsapp' where missing
  const channelResult = await CO.updateMany(
    { orderChannel: { $exists: false } },
    { $set: { orderChannel: 'whatsapp' } }
  );
  console.log(`orderChannel backfilled: ${channelResult.modifiedCount} docs updated`);

  // Also fix null values
  const channelNull = await CO.updateMany(
    { orderChannel: null },
    { $set: { orderChannel: 'whatsapp' } }
  );
  console.log(`orderChannel null->whatsapp: ${channelNull.modifiedCount} docs updated`);

  // 2. Check paymentMethod stats
  const paymentStats = await CO.aggregate([
    { $group: { _id: '$paymentMethod', count: { $sum: 1 } } }
  ]).toArray();
  console.log('paymentMethod distribution:', JSON.stringify(paymentStats));

  // 3. Verify result
  const channelStats = await CO.aggregate([
    { $group: { _id: '$orderChannel', count: { $sum: 1 } } }
  ]).toArray();
  console.log('orderChannel distribution after fix:', JSON.stringify(channelStats));

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
