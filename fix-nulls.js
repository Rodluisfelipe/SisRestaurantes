const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  // Unset referralCode where it's null so sparse index skips them
  const result = await m.connection.db.collection('businessconfigs').updateMany(
    { referralCode: null },
    { $unset: { referralCode: "" } }
  );
  console.log('Unset null referralCodes:', result.modifiedCount, 'documents');
  
  // Drop and recreate index to be safe
  try { await m.connection.db.collection('businessconfigs').dropIndex('referralCode_1'); } catch(e) {}
  await m.connection.db.collection('businessconfigs').createIndex(
    { referralCode: 1 },
    { unique: true, sparse: true }
  );
  console.log('Index recreated');
  process.exit(0);
});
