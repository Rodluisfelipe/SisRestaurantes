const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');

async function migrateDatabase() {
  try {
    // Conectar a la base de datos
    await mongoose.connect('mongodb://localhost:27017/restaurantDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Conexión a la base de datos establecida para migración');
    
    // Buscar todos los documentos de configuración de negocio que no tengan el campo isOpen
    const configs = await BusinessConfig.find({ isOpen: { $exists: false } });
    
    console.log(`Encontrados ${configs.length} documentos sin el campo isOpen`);
    
    // Actualizar cada documento para agregar el campo isOpen
    for (const config of configs) {
      config.isOpen = true; // Valor predeterminado
      await config.save();
      console.log(`Documento ${config._id} actualizado con isOpen=true`);
    }
    
    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await mongoose.connection.close();
    console.log('Conexión a la base de datos cerrada');
  }
}

migrateDatabase(); 