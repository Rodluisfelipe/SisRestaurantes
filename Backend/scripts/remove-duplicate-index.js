const mongoose = require('mongoose');

async function removeDuplicateIndex() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    console.log('Conectado a MongoDB');

    // Obtener la colección
    const db = mongoose.connection.db;
    const collection = db.collection('toppinggroups');

    // Obtener todos los índices usando el método correcto
    console.log('Índices actuales:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Buscar el índice problemático (name + businessId)
    const problematicIndex = indexes.find(index => 
      index.key && 
      index.key.name === 1 && 
      index.key.businessId === 1 &&
      index.unique === true
    );

    if (problematicIndex) {
      console.log('Encontrado índice problemático:', problematicIndex.name);
      
      // Eliminar el índice
      await collection.dropIndex(problematicIndex.name);
      console.log('✅ Índice eliminado exitosamente');
    } else {
      console.log('No se encontró el índice problemático');
    }

    // Verificar índices después de la eliminación
    console.log('Índices después de la eliminación:');
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
}

removeDuplicateIndex();
