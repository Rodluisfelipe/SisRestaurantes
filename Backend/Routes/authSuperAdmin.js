const express = require('express');
const router = express.Router();
const authSuperAdmin = require('../Controllers/authSuperAdmin');
const authMiddleware = require('../middleware/authSuperAdmin');

// Rutas públicas (no requieren token)
router.post('/login', authSuperAdmin.login);
router.post('/forgot-password', authSuperAdmin.forgotPassword);
router.post('/reset-password', authSuperAdmin.resetPassword);

// Rutas protegidas (requieren token)
router.post('/change-password', authMiddleware.protectSuperAdmin, authSuperAdmin.changePassword);

module.exports = router; 