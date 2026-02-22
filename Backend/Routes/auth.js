const express = require('express');
const router = express.Router();
const Admin = require('../Models/Admin');
const BusinessConfig = require('../Models/BusinessConfig');
const { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } = require('../config/jwt');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Rate limiter para prevenir ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: { message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' }
});

// Rate limiter para registro (prevenir abuso de trials)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por IP por hora
  message: { message: 'Demasiados registros desde esta dirección. Intente nuevamente en 1 hora.' }
});

// Rate limiter para check-email (prevenir enumeración)
const checkEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos
  message: { message: 'Demasiadas consultas. Intente nuevamente más tarde.' }
});

// Validación de fortaleza de contraseña
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula';
  }
  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra minúscula';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número';
  }
  return null;
};

// Validación de formato de email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Ruta de registro de negocio
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, businessName, email, password } = req.body;

    // Validaciones básicas
    if (!name || !businessName || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Validar formato de email
    if (!validateEmail(email)) {
      return res.status(400).json({ message: 'Formato de correo electrónico inválido' });
    }

    // Validar fortaleza de contraseña
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    // Sanitizar nombre (prevenir XSS básico)
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedBusinessName = businessName.trim().substring(0, 100);

    // Verificar si el email ya está registrado como username
    const existingAdmin = await Admin.findOne({ username: email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Este correo ya está registrado' });
    }

    // Generar un slug basado en el nombre del negocio
    let slug = businessName.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Verificar si el slug ya existe y modificarlo si es necesario
    let slugExists = true;
    let counter = 1;
    let newSlug = slug;
    
    while (slugExists) {
      const existingBusiness = await BusinessConfig.findOne({ slug: newSlug });
      if (existingBusiness) {
        newSlug = `${slug}-${counter}`;
        counter++;
      } else {
        slugExists = false;
        slug = newSlug;
      }
    }

    // Crear la configuración del negocio
    const businessConfig = new BusinessConfig({
      slug,
      businessName,
      isActive: true
    });

    // Guardar la configuración del negocio
    await businessConfig.save();

    // Crear el usuario administrador
    const admin = new Admin({
      username: email,
      password,
      businessId: businessConfig._id,
      mustChangePassword: false,
      role: 'admin'
    });

    // Guardar el usuario administrador
    await admin.save();

    // Crear suscripción inicial: 7 días de prueba + 1 día de gracia
    const Subscription = require('../Models/Subscription');
    const TRIAL_DAYS = parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || 7);
    const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || 1);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
    const graceUntil = new Date(periodEnd);
    graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS); // periodEnd + 1 día de gracia
    
    const initialSubscription = new Subscription({
      businessId: businessConfig._id,
      planType: 'monthly',
      status: 'active',
      startDate: now,
      endDate: periodEnd,
      periodStart: now,
      periodEnd: periodEnd,
      graceUntil: graceUntil,
      price: 0, // Gratis durante período de prueba
      paymentStatus: 'paid',
      isActive: true,
      isTrialPeriod: true,
      paymentMethod: 'OTHER',
      notes: `Período de prueba de ${TRIAL_DAYS} días con ${GRACE_DAYS} día(s) de gracia`
    });
    
    await initialSubscription.save();

    // Generar tokens para el inicio de sesión automático
    const token = generateToken(admin._id, businessConfig._id);
    const refreshToken = generateRefreshToken(admin._id);
    admin.refreshToken = refreshToken;
    await admin.save();

    res.status(201).json({
      message: 'Negocio registrado con éxito',
      business: {
        id: businessConfig._id,
        slug,
        businessName
      },
      user: {
        id: admin._id,
        username: admin.username,
        businessId: admin.businessId
      },
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Error al registrar negocio', process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json({ message: 'Error en el servidor al registrar el negocio' });
  }
});

// Verificar disponibilidad de email
router.post('/check-email', checkEmailLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email es requerido' });
    }
    
    const existingAdmin = await Admin.findOne({ username: email });
    
    res.json({
      available: !existingAdmin
    });
  } catch (error) {
    logger.error('Error al verificar email', process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta de login con rate limiting
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    logger.info('POST /auth/login', { username, password: 'REDACTED' });

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
    const token = generateToken(admin._id, admin.businessId);
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
        businessId: admin.businessId,
        role: admin.role
      }
    });
  } catch (error) {
    logger.error('Error en login', process.env.NODE_ENV !== 'production' ? error : undefined);
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

// Rate limiter for token refresh
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Demasiadas solicitudes de refresh. Intente nuevamente más tarde.' }
});

// Endpoint para refrescar el access token
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    // Buscar admin y validar refresh token guardado (hashed comparison)
    const admin = await Admin.findByRefreshToken(decoded.id, refreshToken);
    if (!admin) {
      return res.status(401).json({ message: 'Refresh token inválido' });
    }
    // Generar nuevo access token
    const token = generateToken(admin._id, admin.businessId);
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
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    admin.password = newPassword; // El pre-save del modelo la hashea
    admin.mustChangePassword = false;
    await admin.save();
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
});

// Force change password (only allowed when mustChangePassword flag is set)
router.post('/force-change-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });
    
    // Only allow force-change when the flag is set (first login, SA-created accounts)
    if (!admin.mustChangePassword) {
      return res.status(403).json({ message: 'No autorizado. Usa el endpoint de cambio de contraseña normal.' });
    }
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    
    admin.password = newPassword;
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
    
    // Asegurarse de incluir todos los campos necesarios
    const userData = {
      id: admin._id,
      username: admin.username,
      lastLogin: admin.lastLogin,
      mustChangePassword: admin.mustChangePassword,
      businessId: admin.businessId,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };
    
    res.json({ user: userData });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

module.exports = router; 