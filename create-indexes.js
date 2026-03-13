/**
 * Create missing MongoDB indexes for performance optimization.
 * Run inside Docker container: docker exec sisrestaurantes-backend-1 node create-indexes.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const db = mongoose.connection.db;

    // Orders indexes
    console.log('Creating indexes on orders...');
    await db.collection('orders').createIndex({ businessId: 1, phone: 1 });
    await db.collection('orders').createIndex({ businessId: 1, status: 1, createdAt: -1 });
    console.log('  ✓ orders indexes created');

    // CompletedOrders indexes
    console.log('Creating indexes on completedorders...');
    await db.collection('completedorders').createIndex({ businessId: 1, completedAt: -1 });
    await db.collection('completedorders').createIndex({ businessId: 1, orderNumber: -1 });
    await db.collection('completedorders').createIndex({ businessId: 1, phone: 1 });
    console.log('  ✓ completedorders indexes created');

    // Customers indexes
    console.log('Creating indexes on customers...');
    await db.collection('customers').createIndex({ businessId: 1, status: 1 });
    await db.collection('customers').createIndex({ businessId: 1, phone: 1 });
    console.log('  ✓ customers indexes created');

    // Products indexes
    console.log('Creating indexes on products...');
    await db.collection('products').createIndex({ businessId: 1, isActive: 1 });
    console.log('  ✓ products indexes created');

    // List all indexes for verification
    for (const col of ['orders', 'completedorders', 'customers', 'products']) {
      const indexes = await db.collection(col).indexes();
      console.log(`\n${col} indexes:`, indexes.map(i => i.key));
    }

    console.log('\nAll indexes created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

createIndexes();
