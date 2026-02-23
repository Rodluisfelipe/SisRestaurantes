require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // Check delivery zones
  const DeliveryZone = require('../Models/DeliveryZone');
  const zones = await DeliveryZone.find({ businessId: '68d86ada90b1fb556405f5ad' }).lean();
  console.log('=== DELIVERY ZONES ===');
  zones.forEach(z => console.log(`${z.name}: fee=${z.fee}, deliveryFee=${z.deliveryFee}, price=${z.price}`));

  // Check topping groups
  const ToppingGroup = require('../Models/ToppingGroup');
  const tgs = await ToppingGroup.find({ businessId: '68d86ada90b1fb556405f5ad' }).lean();
  console.log('\n=== TOPPING GROUPS ===');
  tgs.forEach(tg => {
    console.log(`${tg.name}: basePrice=${tg.basePrice}`);
    if (tg.options) tg.options.forEach(o => console.log(`  option: ${o.name} price=${o.price}`));
    if (tg.subGroups) tg.subGroups.forEach(sg => {
      console.log(`  subGroup: ${sg.name}`);
      if (sg.options) sg.options.forEach(o => console.log(`    option: ${o.name} price=${o.price}`));
    });
  });

  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
