/**
 * Pedidos: /api/orders.
 *
 * Antes era un solo archivo de 2.600 líneas. Ahora cada parte vive en su
 * archivo; acá solo se montan, EN ESTE ORDEN, que importa: las rutas de un
 * solo segmento (/completed, /my-orders, /open-tab, /bought-together) tienen
 * que ir antes que GET /:id o las atraparía.
 */
const express = require("express");
const router = express.Router();

const { generateOrderNumber } = require('./compartido');
const estado = require('./estado');
const { actualizarEstadoPedido } = estado;

router.use(require('./listado'));
router.use(require('./crear'));
router.use(require('./publico'));
router.use(require('./mensajes'));
router.use(require('./detalle'));
router.use(estado);
router.use(require('./edicion'));
router.use(require('./cobro'));
router.use(require('./cierre'));

// La caja (Routes/pos.js) cambia estados por el mismo camino que el panel.
router.actualizarEstadoPedido = actualizarEstadoPedido;

module.exports = router;
module.exports.generateOrderNumber = generateOrderNumber;
