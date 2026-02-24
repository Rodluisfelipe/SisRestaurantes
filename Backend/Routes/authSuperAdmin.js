const express = require('express');
const router = express.Router();
const authSuperAdmin = require('../Controllers/authSuperAdmin');
const authMiddleware = require('../middleware/authSuperAdmin');
const rateLimit = require('express-rate-limit');

// Rate limiter for SuperAdmin login (stricter than admin)
const saLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Demasiados intentos de inicio de sesión. Intente en 15 minutos.' }
});

// Rate limiter for password reset requests
const saPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { message: 'Demasiadas solicitudes. Intente nuevamente en 1 hora.' }
});

// Rutas públicas (no requieren token)
router.post('/login', saLoginLimiter, authSuperAdmin.login);
router.post('/google', saLoginLimiter, authSuperAdmin.googleLogin);
router.post('/forgot-password', saPasswordLimiter, authSuperAdmin.forgotPassword);
router.post('/reset-password', saPasswordLimiter, authSuperAdmin.resetPassword);

// Rutas protegidas (requieren token)
router.post('/change-password', authMiddleware.protectSuperAdmin, authSuperAdmin.changePassword);

// GET /auth/me - Validate SuperAdmin session (returns user info if token is valid)
router.get('/me', authMiddleware.protectSuperAdmin, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

module.exports = router; 