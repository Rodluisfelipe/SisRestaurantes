const mongoose = require('mongoose');
const Customer = require('../Models/Customer');
const CompletedOrder = require('../Models/CompletedOrder');
require('dotenv').config({ path: '../../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function recalculateCustomerStats() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Obtener todos los clientes
    const customers = await Customer.find({});
    console.log(`Encontrados ${customers.length} clientes`);

    for (const customer of customers) {
      console.log(`\nProcesando cliente: ${customer.name} (${customer.phone})`);
      
      // Buscar todas las órdenes completadas de este cliente
      const orders = await CompletedOrder.find({
        businessId: customer.businessId,
        phone: customer.phone
      }).sort({ completedAt: 1 });

      console.log(`  Encontradas ${orders.length} órdenes completadas`);

      // Calcular estadísticas
      let totalOrders = 0;
      let totalSpent = 0;
      let lastOrderDate = null;

      for (const order of orders) {
        totalOrders += 1;
        
        // Calcular total de la orden
        let orderTotal = 0;
        if (order.items && order.items.length > 0) {
          orderTotal = order.items.reduce((sum, item) => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            return sum + itemTotal;
          }, 0);
        }
        
        totalSpent += orderTotal;
        lastOrderDate = order.completedAt || order.createdAt;
        
        console.log(`    Orden ${order.orderNumber}: $${orderTotal} - ${lastOrderDate}`);
      }

      // Actualizar estadísticas del cliente
      customer.totalOrders = totalOrders;
      customer.totalSpent = totalSpent;
      customer.lastOrderDate = lastOrderDate;
      
      await customer.save();
      
      console.log(`  ✅ Actualizado: ${totalOrders} pedidos, $${totalSpent}, último: ${lastOrderDate}`);
    }

    console.log('\n✅ Recalculación de estadísticas completada');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

recalculateCustomerStats();

