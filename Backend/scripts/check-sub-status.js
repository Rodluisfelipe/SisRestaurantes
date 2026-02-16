const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Subscription = require('../Models/Subscription');
  
  const subs = await Subscription.find({}).sort({ createdAt: -1 });
  
  for (const s of subs) {
    console.log('---');
    console.log('BusinessId:', s.businessId);
    console.log('DB periodEnd:', s.periodEnd);
    console.log('DB graceUntil:', s.graceUntil);
    console.log('Model calculateGraceUntil():', s.calculateGraceUntil());
    console.log('Model getCurrentStatus():', s.getCurrentStatus());
    console.log('Model getGraceDaysRemaining():', s.getGraceDaysRemaining());
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
