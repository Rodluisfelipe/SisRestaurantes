require('dotenv').config({ path: '.env.development' });

const mongoose = require('mongoose');
const Admin = require('../Models/Admin');

async function initAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Verificar si ya existe un admin
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (adminExists) {
      console.log('El usuario admin ya existe');
      return;
    }

    // Crear admin inicial
    const admin = new Admin({
      username: 'admin',
      password: 'admin' // Se hasheará automáticamente
    });

    await admin.save();
    console.log('Usuario admin creado exitosamente');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

initAdmin(); 