const mongoose = require('mongoose');
const { sendBookingCreatedEmail, sendTestEmail } = require('./services/emailService');
const BusinessConfig = require('./Models/BusinessConfig');
const Order = require('./Models/Order');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Get the latest booking
  const booking = await Order.findOne({ isBooking: true, customerEmail: { $ne: '' } })
    .sort({ createdAt: -1 })
    .lean();
  
  if (!booking) {
    console.log('No booking with email found');
    process.exit(1);
  }

  console.log('Testing with booking:', {
    id: booking._id,
    customer: booking.customerName,
    email: booking.customerEmail,
    businessId: booking.businessId,
    date: booking.bookingDate
  });

  // Try sending
  console.log('\n--- Attempting to send email ---');
  try {
    const result = await sendBookingCreatedEmail(booking.businessId.toString(), booking);
    console.log('Result:', result);
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
  }

  process.exit(0);
}

test().catch(e => { console.error('FATAL:', e); process.exit(1); });
