const mongoose = require('mongoose');
const BusinessConfig = require('./Models/BusinessConfig');
const { decrypt } = require('./services/emailService');
const Order = require('./Models/Order');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Check all businesses with email settings
  const configs = await BusinessConfig.find({ 'emailSettings.enabled': true })
    .select('emailSettings businessName slug')
    .lean({ virtuals: false });
  
  console.log(`\n=== Found ${configs.length} business(es) with email enabled ===\n`);
  
  for (const c of configs) {
    console.log(`Business: ${c.businessName} (${c.slug || c._id})`);
    console.log(`  Email: ${c.emailSettings?.senderEmail || 'NOT SET'}`);
    console.log(`  Password: ${c.emailSettings?.appPassword ? `SET (${c.emailSettings.appPassword.length} chars)` : 'NOT SET'}`);
    console.log(`  Toggles: created=${c.emailSettings?.sendOnBookingCreated}, confirmed=${c.emailSettings?.sendOnBookingConfirmed}, cancelled=${c.emailSettings?.sendOnBookingCancelled}, reminder=${c.emailSettings?.sendReminder}`);
    
    // Try to decrypt
    if (c.emailSettings?.appPassword) {
      try {
        const decrypted = decrypt(c.emailSettings.appPassword);
        console.log(`  Decrypt: OK (${decrypted.length} chars)`);
      } catch (e) {
        console.log(`  Decrypt: FAILED - ${e.message}`);
      }
    }
  }

  // Check recent bookings for customerEmail
  const recentBookings = await Order.find({ isBooking: true })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('customerName customerEmail businessId createdAt')
    .lean();
  
  console.log(`\n=== Last 5 bookings ===\n`);
  for (const b of recentBookings) {
    console.log(`  ${b.customerName} | email: "${b.customerEmail || 'EMPTY'}" | business: ${b.businessId} | ${b.createdAt}`);
  }
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
