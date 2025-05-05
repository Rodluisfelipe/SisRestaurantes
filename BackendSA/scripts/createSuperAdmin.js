/**
 * Script para crear un SuperAdmin inicial
 * Para ejecutar: node scripts/createSuperAdmin.js
 */
const mongoose = require('mongoose');
const SuperAdmin = require('../Models/SuperAdmin');
require('dotenv').config();

// Datos del SuperAdmin inicial
const superAdminData = {
  email: 'admin@sistema-restaurantes.com',
  password: 'superadmin123'  // Cambiar por una contraseña segura
};

// Conexión a MongoDB
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sisrestaurantes';

async function createSuperAdmin() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Conectado a MongoDB');

    // Verificar si ya existe un SuperAdmin
    const existingSuperAdmin = await SuperAdmin.findOne({ email: superAdminData.email });
    
    if (existingSuperAdmin) {
      console.log(`SuperAdmin con email ${superAdminData.email} ya existe`);
    } else {
      // Crear nuevo SuperAdmin
      const superAdmin = new SuperAdmin(superAdminData);
      await superAdmin.save();
      console.log(`SuperAdmin creado exitosamente: ${superAdminData.email}`);
    }
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Ejecutar función
createSuperAdmin(); 