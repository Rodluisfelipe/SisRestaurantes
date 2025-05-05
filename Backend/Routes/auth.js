const express = require('express');
const router = express.Router();
const Admin = require('../Models/Admin');
const { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } = require('../config/jwt');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');

// Rate limiter para prevenir ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: { message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' }
});

// Ruta de login
// router.post('/login', loginLimiter, async (req, res) => {
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar el admin
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Verificar contraseña
    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Actualizar último login
    admin.lastLogin = new Date();

    // Generar tokens
    const token = generateToken(admin._id);
    const refreshToken = generateRefreshToken(admin._id);
    admin.refreshToken = refreshToken;
    await admin.save();

    res.json({
      token,
      refreshToken,
      user: {
        id: admin._id,
        username: admin.username,
        lastLogin: admin.lastLogin,
        mustChangePassword: admin.mustChangePassword,
        businessId: admin.businessId
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user: admin });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

// Endpoint para refrescar el access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    // Buscar admin y validar refresh token guardado
    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Refresh token inválido' });
    }
    // Generar nuevo access token
    const token = generateToken(admin._id);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error al refrescar el token' });
  }
});

// Endpoint para logout (invalidar refresh token)
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'No refresh token provided' });
    }
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(400).json({ message: 'Invalid refresh token' });
    }
    const admin = await Admin.findById(decoded.id);
    if (admin) {
      admin.refreshToken = null;
      await admin.save();
    }
    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    res.status(500).json({ message: 'Error al hacer logout' });
  }
});

// Cambiar contraseña del admin (protegido)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });
    const isValid = await admin.comparePassword(oldPassword);
    if (!isValid) return res.status(400).json({ message: 'Contraseña actual incorrecta' });
    admin.password = newPassword; // El pre-save del modelo la hashea
    admin.mustChangePassword = false;
    await admin.save();
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
});

// Obtener datos del usuario autenticado (protegido)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
    res.json({ user: admin });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

module.exports = router; 