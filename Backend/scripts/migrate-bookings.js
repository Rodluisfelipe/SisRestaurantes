/**
 * Migration script: Move existing Order documents with isBooking=true
 * to the new Booking collection.
 *
 * Usage (inside Docker container):
 *   node scripts/migrate-bookings.js
 *
 * Or from host:
 *   docker exec backend-backend-1 node scripts/migrate-bookings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const Booking = require('../Models/Booking');

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Migrate from Order collection
  const activeBookings = await Order.find({ isBooking: true }).lean();
  console.log(`Found ${activeBookings.length} active bookings in Order collection`);

  let migratedActive = 0;
  for (const order of activeBookings) {
    // Check if already migrated
    const exists = await Booking.findOne({
      businessId: order.businessId,
      orderNumber: order.orderNumber
    });
    if (exists) {
      console.log(`  Skip #${order.orderNumber} (already exists in Booking)`);
      continue;
    }

    const bookingDoc = {
      businessId: order.businessId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone || '',
      customerEmail: order.customerEmail || '',
      customerId: order.customerId || null,
      bookingDate: order.bookingDate,
      bookingEndDate: order.bookingEndDate || new Date(new Date(order.bookingDate).getTime() + 30 * 60000),
      bookingStatus: mapStatus(order.bookingStatus || order.status),
      staffId: order.staffId || null,
      staffName: order.staffName || null,
      items: order.items || [],
      totalAmount: order.totalAmount || 0,
      discountAmount: order.discountAmount || 0,
      finalAmount: order.finalAmount || order.totalAmount || 0,
      paymentMethod: order.paymentMethod || null,
      couponCode: order.couponCode || null,
      couponId: order.couponId || null,
      orderChannel: order.orderChannel || 'inapp',
      customerToken: order.customerToken || null,
      customerNotes: order.customerNotes || '',
      statusHistory: order.statusHistory || [],
      cancelledAt: order.cancelledAt || null,
      cancellationReason: order.cancellationReason || null,
      remindersSent: order.remindersSent || [],
      completedAt: order.completedAt || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt
    };

    if (bookingDoc.recurrence) {
      bookingDoc.recurrence = order.recurrence;
    }

    await Booking.create(bookingDoc);
    await Order.deleteOne({ _id: order._id });
    migratedActive++;
    console.log(`  Migrated active booking #${order.orderNumber}`);
  }

  // 2. Migrate from CompletedOrder collection
  const completedBookings = await CompletedOrder.find({ isBooking: true }).lean();
  console.log(`Found ${completedBookings.length} completed bookings in CompletedOrder collection`);

  let migratedCompleted = 0;
  for (const order of completedBookings) {
    const exists = await Booking.findOne({
      businessId: order.businessId,
      orderNumber: order.orderNumber
    });
    if (exists) {
      console.log(`  Skip completed #${order.orderNumber} (already exists in Booking)`);
      continue;
    }

    const bookingDoc = {
      businessId: order.businessId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone || '',
      customerEmail: order.customerEmail || '',
      customerId: order.customerId || null,
      bookingDate: order.bookingDate,
      bookingEndDate: order.bookingEndDate || new Date(new Date(order.bookingDate).getTime() + 30 * 60000),
      bookingStatus: mapStatus(order.bookingStatus || order.status || 'completed'),
      staffId: order.staffId || null,
      staffName: order.staffName || null,
      items: order.items || [],
      totalAmount: order.totalAmount || 0,
      discountAmount: order.discountAmount || 0,
      finalAmount: order.finalAmount || order.totalAmount || 0,
      paymentMethod: order.paymentMethod || null,
      couponCode: order.couponCode || null,
      couponId: order.couponId || null,
      orderChannel: order.orderChannel || 'inapp',
      customerToken: order.customerToken || null,
      customerNotes: order.customerNotes || '',
      statusHistory: order.statusHistory || [],
      cancelledAt: order.cancelledAt || null,
      cancellationReason: order.cancellationReason || null,
      remindersSent: order.remindersSent || [],
      completedAt: order.completedAt || order.updatedAt || new Date(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt
    };

    await Booking.create(bookingDoc);
    await CompletedOrder.deleteOne({ _id: order._id });
    migratedCompleted++;
    console.log(`  Migrated completed booking #${order.orderNumber}`);
  }

  console.log(`\nMigration complete:`);
  console.log(`  Active bookings migrated: ${migratedActive}`);
  console.log(`  Completed bookings migrated: ${migratedCompleted}`);
  console.log(`  Total: ${migratedActive + migratedCompleted}`);

  await mongoose.disconnect();
}

function mapStatus(status) {
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  if (validStatuses.includes(status)) return status;
  // Map order statuses to booking statuses
  if (status === 'preparing' || status === 'in_progress' || status === 'ready') return 'confirmed';
  if (status === 'delivered') return 'completed';
  return 'pending';
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
