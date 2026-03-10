const mongoose = require('mongoose');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
require('dotenv').config();

const orderNum = process.argv[2] || '144';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  let order = await Order.findOne({ orderNumber: orderNum }).lean();
  let source = 'active';
  if (!order) {
    order = await CompletedOrder.findOne({ orderNumber: orderNum }).lean();
    source = 'completed';
  }
  if (order) {
    console.log(`\n=== Order #${orderNum} (${source}) ===`);
    console.log(`Customer: ${order.customerName}`);
    console.log(`Phone: ${order.phone || 'N/A'}`);
    console.log(`Status: ${order.status}`);
    console.log(`Type: ${order.orderType}`);
    console.log(`Table: ${order.tableNumber || 'N/A'}`);
    console.log(`Channel: ${order.orderChannel || 'N/A'}`);
    console.log(`Payment: ${order.paymentMethod || 'N/A'}`);
    console.log(`Created: ${order.createdAt}`);
    console.log(`Total: $${order.totalAmount}`);
    console.log(`Delivery Fee: $${order.deliveryFee || 0}`);
    console.log(`Discount: $${order.discountAmount || 0}`);
    console.log(`Final: $${order.finalAmount || order.totalAmount}`);
    console.log(`\n--- Items (${order.items?.length || 0}) ---`);
    if (order.items) {
      order.items.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.name} x${item.quantity} - $${item.price}`);
        if (item.selectedToppings && item.selectedToppings.length > 0) {
          item.selectedToppings.forEach(t => {
            console.log(`     + ${JSON.stringify(t)}`);
          });
        }
        if (item.notes) console.log(`     Nota: ${item.notes}`);
      });
    }
    if (order.notes) console.log(`\nOrder notes: ${order.notes}`);
    if (order.address) console.log(`Address: ${order.address}`);
  } else {
    console.log(`Order #${orderNum} not found in active or completed orders`);
  }
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
