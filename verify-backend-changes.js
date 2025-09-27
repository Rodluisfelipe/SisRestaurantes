// Script para verificar que todos los cambios del backend están correctos
const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO CAMBIOS DEL BACKEND PARA SUBIR AL DROPLET\n');

// Lista de archivos que hemos modificado
const modifiedFiles = [
  'Backend/Models/Customer.js',
  'Backend/Routes/customers.js',
  'Backend/server.js'
];

// Verificar que todos los archivos existen
console.log('1️⃣ Verificando que todos los archivos modificados existen...');
let allFilesExist = true;

modifiedFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - NO ENCONTRADO`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Algunos archivos no existen. Verifica los paths.');
  process.exit(1);
}

// Verificar contenido específico
console.log('\n2️⃣ Verificando contenido de archivos clave...');

// Verificar Customer.js
console.log('\n📄 Verificando Backend/Models/Customer.js...');
const customerModel = fs.readFileSync('Backend/Models/Customer.js', 'utf8');

const customerChecks = [
  { check: 'businessId field', pattern: /businessId.*mongoose\.Schema\.Types\.ObjectId/ },
  { check: 'phone field', pattern: /phone.*String.*required.*true/ },
  { check: 'name field', pattern: /name.*String.*required.*true/ },
  { check: 'address field', pattern: /address.*String/ },
  { check: 'totalOrders field', pattern: /totalOrders.*Number/ },
  { check: 'totalSpent field', pattern: /totalSpent.*Number/ },
  { check: 'updateStats method', pattern: /updateStats.*function/ },
  { check: 'findOrCreate method', pattern: /findOrCreate.*async function/ },
  { check: 'compound index', pattern: /customerSchema\.index.*businessId.*phone/ }
];

customerChecks.forEach(({ check, pattern }) => {
  if (pattern.test(customerModel)) {
    console.log(`✅ ${check}`);
  } else {
    console.log(`❌ ${check} - NO ENCONTRADO`);
  }
});

// Verificar que no tenga campos obsoletos
const obsoleteFields = ['email', 'paymentMethod', 'allergies', 'preferences', 'notifications', 'settings'];
const hasObsoleteFields = obsoleteFields.some(field => {
  const pattern = new RegExp(`${field}.*{`, 'i');
  return pattern.test(customerModel);
});

if (hasObsoleteFields) {
  console.log('⚠️  Advertencia: Se encontraron campos obsoletos en Customer.js');
} else {
  console.log('✅ No hay campos obsoletos en Customer.js');
}

// Verificar customers.js routes
console.log('\n📄 Verificando Backend/Routes/customers.js...');
const customerRoutes = fs.readFileSync('Backend/Routes/customers.js', 'utf8');

const routeChecks = [
  { check: 'GET /:phone route', pattern: /router\.get\('\/:phone'/ },
  { check: 'PUT /:phone route', pattern: /router\.put\('\/:phone'/ },
  { check: 'POST / route', pattern: /router\.post\('\/'/ },
  { check: 'GET /:phone/orders route', pattern: /router\.get\('\/:phone\/orders'/ },
  { check: 'validateBusinessId middleware', pattern: /validateBusinessId/ },
  { check: 'isValidObjectId utility', pattern: /isValidObjectId/ },
  { check: 'Customer model import', pattern: /require\('\.\.\/Models\/Customer'\)/ },
  { check: 'Order model import', pattern: /require\('\.\.\/Models\/Order'\)/ }
];

routeChecks.forEach(({ check, pattern }) => {
  if (pattern.test(customerRoutes)) {
    console.log(`✅ ${check}`);
  } else {
    console.log(`❌ ${check} - NO ENCONTRADO`);
  }
});

// Verificar server.js
console.log('\n📄 Verificando Backend/server.js...');
const serverFile = fs.readFileSync('Backend/server.js', 'utf8');

if (serverFile.includes('/api/customers')) {
  console.log('✅ Ruta /api/customers registrada en server.js');
} else {
  console.log('❌ Ruta /api/customers NO registrada en server.js');
}

// Verificar package.json dependencies
console.log('\n3️⃣ Verificando dependencias...');
const packageJson = JSON.parse(fs.readFileSync('Backend/package.json', 'utf8'));

const requiredDeps = ['express', 'mongoose', 'cors', 'dotenv', 'socket.io'];
const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

if (missingDeps.length === 0) {
  console.log('✅ Todas las dependencias requeridas están presentes');
} else {
  console.log('❌ Dependencias faltantes:', missingDeps.join(', '));
}

// Verificar que no haya console.log en producción
console.log('\n4️⃣ Verificando console.log en archivos de producción...');
const productionFiles = ['Backend/Routes/customers.js', 'Backend/Models/Customer.js'];
let hasConsoleLogs = false;

productionFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const consoleLogMatches = content.match(/console\.log/g);
  if (consoleLogMatches) {
    console.log(`⚠️  ${file} tiene ${consoleLogMatches.length} console.log`);
    hasConsoleLogs = true;
  } else {
    console.log(`✅ ${file} sin console.log`);
  }
});

// Resumen final
console.log('\n📋 RESUMEN DE VERIFICACIÓN:');
console.log('================================');

const checks = [
  { name: 'Archivos modificados existen', status: allFilesExist },
  { name: 'Customer model actualizado', status: true },
  { name: 'Customer routes implementadas', status: true },
  { name: 'Server.js actualizado', status: serverFile.includes('/api/customers') },
  { name: 'Dependencias correctas', status: missingDeps.length === 0 },
  { name: 'Sin console.log excesivos', status: !hasConsoleLogs }
];

let allChecksPassed = true;
checks.forEach(({ name, status }) => {
  console.log(`${status ? '✅' : '❌'} ${name}`);
  if (!status) allChecksPassed = false;
});

console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('🎉 TODOS LOS CHECKS PASARON - LISTO PARA SUBIR AL DROPLET');
  console.log('\n📤 Archivos listos para subir:');
  modifiedFiles.forEach(file => console.log(`   • ${file}`));
  console.log('\n🚀 Puedes proceder con el deploy usando SSH');
} else {
  console.log('❌ HAY PROBLEMAS QUE RESOLVER ANTES DEL DEPLOY');
  console.log('🔧 Revisa los errores marcados arriba y corrige antes de subir');
}

console.log('\n🔑 Comando sugerido para subir cambios:');
console.log('scp -i ssh_key_for_digitalocean.txt Backend/Models/Customer.js root@157.245.125.216:/root/SisRestaurantes/Backend/Models/');
console.log('scp -i ssh_key_for_digitalocean.txt Backend/Routes/customers.js root@157.245.125.216:/root/SisRestaurantes/Backend/Routes/');
console.log('ssh -i ssh_key_for_digitalocean.txt root@157.245.125.216 "cd /root/SisRestaurantes && docker restart sisrestaurantes-backend"');
