// Script para ejecutar en DevTools Console
// Copia y pega este código en la consola del navegador

console.log('🧹 Iniciando limpieza profunda del localStorage...');

// 1. Listar todo lo que hay en localStorage
console.log('📋 Contenido actual del localStorage:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  console.log(`  ${key}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
}

// 2. Limpiar todo
localStorage.clear();
sessionStorage.clear();

// 3. Limpiar cookies también
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

// 4. Verificar que esté limpio
console.log('✅ localStorage limpiado. Elementos restantes:', localStorage.length);

// 5. Recargar la página
console.log('🔄 Recargando página en 2 segundos...');
setTimeout(() => {
  window.location.reload();
}, 2000);
