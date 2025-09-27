// Script de prueba para verificar que la API de customers funciona correctamente
const mongoose = require('mongoose');
require('dotenv').config();

const Customer = require('./Models/Customer');

async function testCustomerAPI() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Datos de prueba
    const testBusinessId = '68c4a2aab447abb220e84347'; // ID de go-burger
    const testPhone = '3001234567';
    const testName = 'Cliente de Prueba';
    const testAddress = 'Calle 123 #45-67';

    console.log('\n🧪 Iniciando pruebas de Customer API...\n');

    // 1. Crear cliente de prueba
    console.log('1️⃣ Creando cliente de prueba...');
    let customer = await Customer.findOne({ businessId: testBusinessId, phone: testPhone });
    
    if (customer) {
      console.log('Cliente ya existe, actualizando...');
      customer.name = testName;
      customer.address = testAddress;
      await customer.save();
    } else {
      customer = new Customer({
        businessId: testBusinessId,
        phone: testPhone,
        name: testName,
        address: testAddress
      });
      await customer.save();
      console.log('✅ Cliente creado exitosamente');
    }

    console.log('Cliente:', {
      id: customer._id,
      businessId: customer.businessId,
      phone: customer.phone,
      name: customer.name,
      address: customer.address,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      status: customer.status,
      createdAt: customer.createdAt
    });

    // 2. Buscar cliente por teléfono
    console.log('\n2️⃣ Buscando cliente por teléfono...');
    const foundCustomer = await Customer.findOne({ 
      businessId: testBusinessId, 
      phone: testPhone 
    });
    
    if (foundCustomer) {
      console.log('✅ Cliente encontrado:', foundCustomer.name);
    } else {
      console.log('❌ Cliente no encontrado');
    }

    // 3. Actualizar estadísticas del cliente
    console.log('\n3️⃣ Actualizando estadísticas del cliente...');
    await foundCustomer.updateStats(25000); // Simular pedido de $25,000
    await foundCustomer.updateStats(15000); // Simular otro pedido de $15,000
    
    const updatedCustomer = await Customer.findById(foundCustomer._id);
    console.log('✅ Estadísticas actualizadas:', {
      totalOrders: updatedCustomer.totalOrders,
      totalSpent: updatedCustomer.totalSpent,
      lastOrderDate: updatedCustomer.lastOrderDate
    });

    // 4. Listar todos los clientes del negocio
    console.log('\n4️⃣ Listando todos los clientes del negocio...');
    const allCustomers = await Customer.find({ businessId: testBusinessId })
      .select('name phone totalOrders totalSpent lastOrderDate')
      .sort({ totalSpent: -1 })
      .limit(5);
    
    console.log('✅ Top 5 clientes por gasto total:');
    allCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name} (${customer.phone}) - $${customer.totalSpent?.toLocaleString() || 0} en ${customer.totalOrders || 0} pedidos`);
    });

    // 5. Verificar índices
    console.log('\n5️⃣ Verificando índices de la colección...');
    const indexes = await Customer.collection.getIndexes();
    console.log('✅ Índices disponibles:', Object.keys(indexes));

    console.log('\n🎉 Todas las pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar las pruebas
testCustomerAPI();
