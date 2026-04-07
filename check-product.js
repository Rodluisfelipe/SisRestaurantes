const m = require('mongoose');
const BC = require('./Models/BusinessConfig');
const P = require('./Models/Product');

m.connect(process.env.MONGODB_URI).then(async () => {
  const b = await BC.findOne({ businessName: { $regex: 'frai', $options: 'i' } }).lean();
  if (!b) { console.log('No encontrado'); process.exit(); }

  const prod = await P.findOne({ businessId: b._id, name: { $regex: 'ensalada mediana', $options: 'i' } }).lean();
  if (!prod) { console.log('Producto no encontrado'); process.exit(); }

  console.log(JSON.stringify(prod, null, 2));
  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
