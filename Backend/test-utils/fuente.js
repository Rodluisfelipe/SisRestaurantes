/**
 * El código de los pedidos como texto, para las pruebas que revisan su fuente.
 * Antes era un solo archivo (Routes/orders.js); ahora es la carpeta
 * Routes/orders/, que se junta en el orden en que se monta.
 */
const fs = require('fs');
const path = require('path');

const ORDEN = ['compartido', 'listado', 'crear', 'publico', 'mensajes', 'detalle', 'estado', 'edicion', 'cobro', 'cierre', 'index'];

function fuenteOrders() {
  const dir = path.join(__dirname, '..', 'Routes', 'orders');
  return ORDEN.map((n) => fs.readFileSync(path.join(dir, `${n}.js`), 'utf8')).join('\n');
}

module.exports = { fuenteOrders };
