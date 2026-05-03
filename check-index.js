const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const indexes = await m.connection.db.collection('businessconfigs').indexes();
  const refIdx = indexes.find(x => x.name === 'referralCode_1');
  console.log('Current referralCode index:', JSON.stringify(refIdx));
  
  if (refIdx && !refIdx.sparse) {
    console.log('BAD INDEX FOUND (no sparse). Fixing...');
    await m.connection.db.collection('businessconfigs').dropIndex('referralCode_1');
    await m.connection.db.collection('businessconfigs').createIndex(
      { referralCode: 1 },
      { unique: true, sparse: true }
    );
    console.log('Fixed!');
  } else if (refIdx && refIdx.sparse) {
    console.log('Index is already correct with sparse:true');
  } else {
    console.log('No referralCode index found');
  }
  
  process.exit(0);
});
