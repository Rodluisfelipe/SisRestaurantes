const mongoose = require('mongoose');

async function checkUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sisrestaurantes');
    const Admin = require('./Backend/Models/Admin');
    const admins = await Admin.find({});
    console.log('=== USUARIOS ENCONTRADOS ===');
    if (admins.length === 0) {
      console.log('❌ No hay usuarios admin en la base de datos');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. Usuario: ${admin.username}`);
        console.log(`   Creado: ${admin.createdAt}`);
        console.log(`   BusinessId: ${admin.businessId || 'No definido'}`);
        console.log('');
      });
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
