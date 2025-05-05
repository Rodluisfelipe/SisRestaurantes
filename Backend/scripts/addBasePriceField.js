const mongoose = require('mongoose');
const ToppingGroup = require('../Models/ToppingGroup');
require('dotenv').config();

async function addBasePriceField() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');
    
    // Encontrar todos los grupos de toppings
    const groups = await ToppingGroup.find({});
    console.log(`Se encontraron ${groups.length} grupos de toppings`);
    
    // Actualizar todos los documentos que no tienen basePrice
    const result = await ToppingGroup.updateMany(
      { basePrice: { $exists: false } },
      { $set: { basePrice: 0 } }
    );
    
    console.log(`Actualizados ${result.modifiedCount} documentos`);
    
    // Verificar la actualización
    const updatedGroups = await ToppingGroup.find({});
    updatedGroups.forEach(group => {
      console.log(`Grupo: ${group.name}, basePrice: ${group.basePrice}`);
    });
    
    console.log('Migración completada');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

addBasePriceField();
