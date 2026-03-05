const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sisrestaurantes';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Check BusinessCoupon collection
  const BusinessCoupon = require('../Models/BusinessCoupon');
  const coupons = await BusinessCoupon.find({}).lean();
  console.log('\n=== BusinessCoupons in DB ===');
  console.log('Total:', coupons.length);
  coupons.forEach(c => {
    console.log(`  Code: ${c.code} | Business: ${c.businessId} | Type: ${c.discountType} | Value: ${c.discountValue} | Active: ${c.isActive} | ValidFrom: ${c.validFrom} | ValidUntil: ${c.validUntil}`);
  });

  // Also check old Coupon model
  const Coupon = require('../Models/Coupon');
  const oldCoupons = await Coupon.find({}).lean();
  console.log('\n=== Old Subscription Coupons ===');
  console.log('Total:', oldCoupons.length);
  oldCoupons.forEach(c => {
    console.log(`  Code: ${c.code} | Months: ${c.months} | Active: ${c.isActive}`);
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
