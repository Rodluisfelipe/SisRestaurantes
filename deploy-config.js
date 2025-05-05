/**
 * Script seguro para preparar el despliegue
 * Este script NO contiene información sensible, solo prepara los archivos de configuración
 */
const fs = require('fs');

console.log('🔒 Preparando configuración para despliegue...');

// 1. Asegurarse que el archivo .env está en .gitignore
const gitignorePath = './.gitignore';
let gitignoreContent = '';

try {
  gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
} catch (error) {
  gitignoreContent = '';
}

if (!gitignoreContent.includes('.env')) {
  console.log('⚠️ Añadiendo .env a .gitignore para proteger tus credenciales');
  fs.appendFileSync(gitignorePath, '\n# Archivos de entorno\n.env\n.env.*\n');
}

// 2. Verificar que existen los archivos de configuración
const requiredFiles = [
  { path: 'Backend/.env', message: 'Backend/.env - Contiene credenciales de MongoDB y configuración' },
  { path: 'Frontend/.env.production', message: 'Frontend/.env.production - Contiene URL de API para producción' }
];

let missingFiles = false;
requiredFiles.forEach(file => {
  if (!fs.existsSync(file.path)) {
    console.log(`❌ Falta archivo: ${file.path}`);
    console.log(`   ${file.message}`);
    missingFiles = true;
  }
});

if (missingFiles) {
  console.log('\n⚠️ Por favor, crea los archivos faltantes antes de continuar.');
  console.log('   Consulta la documentación para saber qué debe contener cada archivo.');
  process.exit(1);
}

console.log('✅ Todos los archivos de configuración están presentes');
console.log('\n🚀 Instrucciones para desplegar:');
console.log('1. Backend (Render):');
console.log('   - Sube tu código a GitHub');
console.log('   - Ve a dashboard.render.com');
console.log('   - Configura las variables de entorno desde Backend/.env');
console.log('   - Haz clic en "Deploy"');
console.log('\n2. Frontend (InfinityFree):');
console.log('   - Ejecuta: cd Frontend && npm run build');
console.log('   - Sube los archivos de Frontend/dist a tu hosting');

console.log('\n✨ ¡Listo para desplegar de forma segura!');
