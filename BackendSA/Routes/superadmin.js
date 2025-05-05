const express = require('express');
const router = express.Router();
const superadmin = require('../Controllers/superadmin');

// Crear nuevo negocio
router.post('/business', superadmin.crearNegocio);

// Listar negocios
router.get('/business', superadmin.listarNegocios);

// Activar/desactivar negocio
router.patch('/business/:id/activate', superadmin.activarNegocio);

// Resetear clave admin
// router.post('/business/:id/reset-admin-password', superadmin.resetearClaveAdmin);

// Eliminar negocio
router.delete('/business/:id', superadmin.eliminarNegocio);

module.exports = router;
