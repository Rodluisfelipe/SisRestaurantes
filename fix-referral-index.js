const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  try {
    await db.collection('businessconfigs').dropIndex('referralCode_1');
    console.log('Index dropped successfully');
  } catch(e) {
    console.log('Drop error (may not exist):', e.message);
  }
  try {
    await db.collection('businessconfigs').createIndex(
      { referralCode: 1 },
      { unique: true, sparse: true }
    );
    console.log('Index recreated with sparse:true');
  } catch(e) {
    console.log('Create error:', e.message);
  }
  process.exit(0);
});
