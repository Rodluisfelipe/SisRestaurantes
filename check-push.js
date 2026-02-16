// Check VAPID and web-push
console.log('VAPID_PUBLIC:', process.env.VAPID_PUBLIC ? 'SET (' + process.env.VAPID_PUBLIC.substring(0, 20) + '...)' : 'NOT SET');
console.log('VAPID_PRIVATE:', process.env.VAPID_PRIVATE ? 'SET' : 'NOT SET');
try {
  require('web-push');
  console.log('web-push: INSTALLED');
} catch(e) {
  console.log('web-push: MISSING');
}

// Check push subscriptions
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const subs = await db.collection('pushsubscriptions').find({}).toArray();
  console.log('Push subscriptions count:', subs.length);
  subs.forEach(s => {
    console.log(`  - role: ${s.role}, active: ${s.isActive}, customerToken: ${s.customerToken ? 'yes' : 'no'}, endpoint: ${s.endpoint?.substring(0, 60)}...`);
  });
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
