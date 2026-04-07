const m = require('mongoose');
const BC = require('./Models/BusinessConfig');
const P = require('./Models/Product');

m.connect(process.env.MONGODB_URI).then(async () => {
  const b = await BC.findOne({ businessName: { $regex: 'frai', $options: 'i' } }).lean();
  if (!b) { console.log('Negocio no encontrado'); process.exit(); }
  
  console.log('Business:', b.businessName, 'ID:', b._id);
  
  const prods = await P.find({ businessId: b._id }).select('name active createdAt updatedAt').sort({ updatedAt: -1 }).lean();
  console.log('\nTotal productos activos:', prods.filter(p => p.active !== false).length);
  console.log('Total productos inactivos:', prods.filter(p => p.active === false).length);
  console.log('\nProductos:');
  prods.forEach(p => {
    const status = p.active === false ? 'INACTIVO' : 'activo';
    console.log(`  - ${p.name} | ${status} | updated: ${p.updatedAt}`);
  });
  
  process.exit();
}).catch(e => { console.error(e); process.exit(1); });
