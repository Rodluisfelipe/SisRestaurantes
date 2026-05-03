const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  console.log('DB:', m.connection.db.databaseName);
  const indexes = await m.connection.db.collection('businessconfigs').indexes();
  console.log(JSON.stringify(indexes, null, 2));
  
  // Drop the bad index
  try {
    await m.connection.db.collection('businessconfigs').dropIndex('referralCode_1');
    console.log('DROPPED referralCode_1');
  } catch(e) {
    console.log('Drop failed:', e.message);
  }
  
  // Recreate with sparse
  try {
    await m.connection.db.collection('businessconfigs').createIndex(
      { referralCode: 1 },
      { unique: true, sparse: true }
    );
    console.log('RECREATED with sparse:true');
  } catch(e) {
    console.log('Create failed:', e.message);
  }
  
  // Verify
  const after = await m.connection.db.collection('businessconfigs').indexes();
  const refIdx = after.find(i => i.name === 'referralCode_1');
  console.log('Verified index:', JSON.stringify(refIdx));
  
  process.exit(0);
});
