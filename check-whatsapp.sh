#!/bin/bash
docker exec backend-backend-1 node -e "
const mongoose = require('mongoose');
const BusinessConfig = require('./Models/BusinessConfig');
async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const configs = await BusinessConfig.find({}).select('businessName whatsappNumber address socialMedia._id').lean();
  configs.forEach(c => {
    console.log(JSON.stringify({
      id: c._id,
      name: c.businessName,
      whatsapp: c.whatsappNumber || '(vacío)',
      address: c.address || '(vacío)'
    }));
  });
  process.exit(0);
}
check();
"
