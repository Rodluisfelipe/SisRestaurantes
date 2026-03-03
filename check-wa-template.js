const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection;
  // List all collections
  const collections = await db.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name).join(', '));
  
  // Try the whatsapptemplates collection
  const templates = await db.collection('whatsapptemplates').find({}).toArray();
  templates.forEach(t => {
    console.log('\n=== RAW DOC ===');
    console.log(JSON.stringify(t, null, 2));
  });
  process.exit(0);
});
