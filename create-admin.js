const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function createAdmin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sisrestaurantes');
    
    // Importar el modelo Admin
    const Admin = require('./Backend/Models/Admin');
    
    // Verificar si el usuario ya existe
    const existingAdmin = await Admin.findOne({ username: 'pipe95141007@gmail.com' });
    if (existingAdmin) {
      console.log('✅ El usuario pipe95141007@gmail.com ya existe');
      process.exit(0);
    }
    
    // Crear el nuevo admin
    const hashedPassword = await bcrypt.hash('Pipe9514.', 10);
    
    const admin = new Admin({
      username: 'pipe95141007@gmail.com',
      password: hashedPassword,
      businessId: 'go-burger' // o el ID de tu negocio
    });
    
    await admin.save();
    console.log('✅ Usuario creado exitosamente:');
    console.log('   Email: pipe95141007@gmail.com');
    console.log('   Password: Pipe9514.');
    console.log('   BusinessId: go-burger');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
