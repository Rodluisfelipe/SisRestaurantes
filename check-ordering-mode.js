const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  console.log('Collections:', cols.map(c => c.name));
  // Try multiple possible collection names
  for (const name of ['businesses', 'businessconfigs', 'businessConfig', 'businessconfig']) {
    const docs = await db.collection(name).find({}).project({name:1, businessName:1, orderingMode:1}).toArray();
    if (docs.length > 0) {
      console.log('Found in:', name);
      console.log(JSON.stringify(docs, null, 2));
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
