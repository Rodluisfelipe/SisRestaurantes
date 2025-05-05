const express = require('express');
const router = express.Router();
const authController = require('../Controllers/auth');
const authMiddleware = require('../middleware/auth');

// Rutas públicas (no requieren token)
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Rutas protegidas (requieren token)
router.post('/change-password', authMiddleware.protect, authController.changePassword);

module.exports = router; 