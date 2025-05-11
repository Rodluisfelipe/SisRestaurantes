const express = require('express');
const router = express.Router();
const superadmin = require('../Controllers/superadmin');
const authMiddleware = require('../middleware/authSuperAdmin');

// Rutas protegidas (requieren autenticación de superadmin)
router.use(authMiddleware.protectSuperAdmin);

// Crear nuevo negocio
router.post('/business', superadmin.crearNegocio);

// Listar negocios
router.get('/business', superadmin.listarNegocios);

// Activar/desactivar negocio
router.patch('/business/:id/activate', superadmin.activarNegocio);

// Eliminar negocio
router.delete('/business/:id', superadmin.eliminarNegocio);

module.exports = router; 