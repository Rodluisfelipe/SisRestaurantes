const m = require('mongoose');
(async () => {
  await m.connect(process.env.MONGODB_URI);
  const db = m.connection.db;
  const stats = await db.command({ dbStats: 1 });
  console.log('DB Size:', Math.round(stats.dataSize / 1024 / 1024), 'MB');
  console.log('Storage:', Math.round(stats.storageSize / 1024 / 1024), 'MB');
  console.log('Collections:', stats.collections);
  console.log('Objects:', stats.objects);
  console.log('');
  const colls = await db.listCollections().toArray();
  for (const c of colls) {
    const count = await db.collection(c.name).countDocuments();
    console.log(' -', c.name + ':', count, 'docs');
  }
  process.exit();
})();
