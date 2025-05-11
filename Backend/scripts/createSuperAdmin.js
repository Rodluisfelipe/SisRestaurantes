/**
 * Script para crear un usuario SuperAdmin por defecto
 * 
 * Este script crea un usuario SuperAdmin con credenciales predefinidas
 * si no existe ninguno en la base de datos.
 */

const mongoose = require('mongoose');
const SuperAdmin = require('../Models/SuperAdmin');
require('dotenv').config();

// Credenciales por defecto
const DEFAULT_EMAIL = 'admin@sistema.com';
const DEFAULT_PASSWORD = 'Admin123!';

// Conectar a la base de datos
const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB conectado para crear SuperAdmin');
    return true;
  } catch (err) {
    console.error('Error conectando a MongoDB:', err.message);
    return false;
  }
};

// Crear SuperAdmin
const createSuperAdmin = async () => {
  try {
    // Verificar si ya existe un SuperAdmin
    const existingSuperAdmin = await SuperAdmin.findOne({ email: DEFAULT_EMAIL });
    
    if (existingSuperAdmin) {
      console.log('Ya existe un SuperAdmin con el email:', DEFAULT_EMAIL);
      return;
    }
    
    // Crear nuevo SuperAdmin
    const superAdmin = new SuperAdmin({
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD
    });
    
    await superAdmin.save();
    console.log('SuperAdmin creado exitosamente con email:', DEFAULT_EMAIL);
    console.log('Credenciales por defecto:');
    console.log(`- Email: ${DEFAULT_EMAIL}`);
    console.log(`- Password: ${DEFAULT_PASSWORD}`);
    console.log('(Recuerda cambiar estas credenciales en un entorno de producción)');
  } catch (err) {
    console.error('Error creando SuperAdmin:', err.message);
  }
};

// Ejecutar el script
(async () => {
  if (await connectDB()) {
    await createSuperAdmin();
    mongoose.disconnect();
    console.log('Script finalizado');
  }
})(); 