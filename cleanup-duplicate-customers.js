const mongoose = require('mongoose');
const Customer = require('./Backend/Models/Customer');

async function cleanupDuplicateCustomers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/restaurantes');
    console.log('Conectado a MongoDB');
    
    // Buscar clientes duplicados por businessId y phone
    const duplicates = await Customer.aggregate([
      {
        $group: {
          _id: { businessId: '$businessId', phone: '$phone' },
          count: { $sum: 1 },
          customers: { $push: '$$ROOT' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    console.log(`Encontrados ${duplicates.length} grupos de clientes duplicados`);
    
    for (const group of duplicates) {
      console.log(`\nProcesando duplicados para teléfono: ${group._id.phone}`);
      console.log(`Número de duplicados: ${group.count}`);
      
      // Ordenar por fecha de creación (más reciente primero)
      const sortedCustomers = group.customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Mantener el más reciente y eliminar los demás
      const keepCustomer = sortedCustomers[0];
      const deleteCustomers = sortedCustomers.slice(1);
      
      console.log(`Manteniendo cliente: ${keepCustomer.name} (ID: ${keepCustomer._id})`);
      console.log(`Eliminando ${deleteCustomers.length} duplicados:`);
      
      for (const customer of deleteCustomers) {
        console.log(`  - ${customer.name} (ID: ${customer._id})`);
        await Customer.findByIdAndDelete(customer._id);
      }
    }
    
    console.log('\nLimpieza completada');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupDuplicateCustomers();


