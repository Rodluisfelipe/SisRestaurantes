const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Admin = require('../Models/Admin');
const BusinessConfig = require('../Models/BusinessConfig');
const Category = require('../Models/Category');
const { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken } = require('../config/jwt');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validate');
const logger = require('../utils/logger');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==================== CATEGORY TEMPLATES BY BUSINESS TYPE ====================
const BUSINESS_TYPE_CONFIG = {
  fast_food: {
    label: 'Comida Rápida',
    emoji: '🍔',
    categories: ['Hamburguesas', 'Perros Calientes', 'Papas y Acompañantes', 'Bebidas', 'Combos'],
    orderingMode: 'both'
  },
  restaurant: {
    label: 'Restaurante',
    emoji: '🍽️',
    categories: ['Entradas', 'Platos Fuertes', 'Sopas', 'Ensaladas', 'Postres', 'Bebidas'],
    orderingMode: 'both'
  },
  cafe: {
    label: 'Cafetería',
    emoji: '☕',
    categories: ['Café', 'Bebidas Frías', 'Panadería', 'Desayunos', 'Snacks'],
    orderingMode: 'both'
  },
  bakery: {
    label: 'Pastelería',
    emoji: '🧁',
    categories: ['Tortas', 'Cupcakes', 'Panes', 'Galletas', 'Bebidas'],
    orderingMode: 'whatsapp'
  },
  ice_cream: {
    label: 'Heladería',
    emoji: '🍦',
    categories: ['Helados', 'Malteadas', 'Sundaes', 'Waffles', 'Toppings'],
    orderingMode: 'both'
  },
  bar: {
    label: 'Bar',
    emoji: '🍸',
    categories: ['Cocteles', 'Cervezas', 'Licores', 'Snacks', 'Picadas'],
    orderingMode: 'inapp'
  },
  food_truck: {
    label: 'Food Truck',
    emoji: '🚚',
    categories: ['Plato Principal', 'Acompañantes', 'Bebidas', 'Especiales del Día'],
    orderingMode: 'both'
  },
  other: {
    label: 'Otro',
    emoji: '🍴',
    categories: ['Categoría 1', 'Categoría 2', 'Bebidas'],
    orderingMode: 'whatsapp'
  },
  salon: {
    label: 'Salón / Barbería',
    emoji: '💇',
    categories: ['Cortes', 'Coloración', 'Tratamientos', 'Productos'],
    orderingMode: 'inapp',
    isServiceType: true
  },
  spa: {
    label: 'Spa / Bienestar',
    emoji: '💆',
    categories: ['Masajes', 'Faciales', 'Tratamientos Corporales', 'Productos'],
    orderingMode: 'inapp',
    isServiceType: true
  },
  clinic: {
    label: 'Clínica / Consultorio',
    emoji: '🏥',
    categories: ['Consultas', 'Terapias', 'Procedimientos', 'Productos'],
    orderingMode: 'inapp',
    isServiceType: true
  },
  services: {
    label: 'Servicios con Agenda',
    emoji: '🔧',
    categories: ['Servicios', 'Paquetes', 'Productos'],
    orderingMode: 'inapp',
    isServiceType: true
  },
  hotel: {
    label: 'Hotel',
    emoji: '🏨',
    categories: ['Room Service', 'Desayunos', 'Bebidas', 'Snacks', 'Minibar'],
    orderingMode: 'inapp'
  }
};

// Helper: create default categories for a business type
async function createDefaultCategories(businessId, businessType) {
  const config = BUSINESS_TYPE_CONFIG[businessType] || BUSINESS_TYPE_CONFIG.other;
  const categories = config.categories.map((name, index) => ({
    name,
    businessId,
    displayOrder: index + 1,
    active: true
  }));
  try {
    await Category.insertMany(categories);
  } catch (err) {
    logger.error('Error creating default categories', err);
  }
}

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
router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  try {
    const { name, businessName, email, password, businessType, referralCode, phone } = req.body;

    // Validaciones básicas
    if (!name || !businessName || !email || !password || !phone) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Sanitizar teléfono
    const sanitizedPhone = phone.trim().substring(0, 30);

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

    // Usar slug elegido por el usuario o generar uno automáticamente
    let slug = req.body.slug;
    if (slug) {
      slug = slug.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      // Verificar que el slug elegido esté disponible
      const slugTaken = await BusinessConfig.findOne({ slug });
      if (slugTaken) {
        return res.status(400).json({ message: 'El enlace elegido ya no está disponible. Por favor selecciona otro.' });
      }
    } else {
      slug = businessName.toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
    }

    // Determinar tipo de negocio y configuración
    const validTypes = ['fast_food', 'restaurant', 'cafe', 'bakery', 'ice_cream', 'bar', 'food_truck', 'salon', 'spa', 'clinic', 'services', 'other'];
    const finalBusinessType = validTypes.includes(businessType) ? businessType : 'restaurant';
    const typeConfig = BUSINESS_TYPE_CONFIG[finalBusinessType];

    // Crear la configuración del negocio
    const businessConfig = new BusinessConfig({
      slug,
      businessName,
      businessType: finalBusinessType,
      orderingMode: typeConfig.orderingMode,
      whatsappNumber: sanitizedPhone,
      onboarding: { level: 1, completedAt: null, guidesShown: [] },
      onboardingFeatureDate: new Date(),
      isActive: true,
      // Auto-enable bookings for service-type businesses
      ...(typeConfig.isServiceType ? {
        enableBookings: true,
        bookingSettings: { slotInterval: 30, maxAdvanceDays: 30, bufferMinutes: 0, autoConfirm: true }
      } : {})
    });

    // Guardar la configuración del negocio
    await businessConfig.save();

    // Crear categorías por defecto según tipo de negocio
    await createDefaultCategories(businessConfig._id, finalBusinessType);

    // Crear el usuario administrador
    const admin = new Admin({
      username: email,
      password,
      phone: sanitizedPhone,
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
      commercialPlan: 'free',
      billingCycle: 'monthly',
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

    // Process referral code if provided
    if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
      try {
        const ReferralConfig = require('../Models/ReferralConfig');
        const Referral = require('../Models/Referral');
        const refConfig = await ReferralConfig.getConfig();
        if (refConfig.isActive) {
          const code = referralCode.toUpperCase().trim();
          const referrer = await BusinessConfig.findOne({ referralCode: code });
          if (referrer && referrer._id.toString() !== businessConfig._id.toString()) {
            const existingRef = await Referral.findOne({ referredBusinessId: businessConfig._id });
            if (!existingRef) {
              const refCount = await Referral.countDocuments({ referrerBusinessId: referrer._id });
              if (refCount < refConfig.maxReferralsPerBusiness) {
                await Referral.create({
                  referrerBusinessId: referrer._id,
                  referredBusinessId: businessConfig._id,
                  referralCode: code,
                  status: 'pending'
                });
                logger.info('Referral created at registration', { referrer: referrer._id, referred: businessConfig._id, code });
              }
            }
          }
        }
      } catch (refErr) {
        logger.warn('Non-blocking error processing referral at registration', { error: refErr.message });
      }
    }

    // Generar tokens para el inicio de sesión automático
    const token = generateToken(admin._id, businessConfig._id);
    const refreshToken = generateRefreshToken(admin._id);
    admin.addRefreshToken(refreshToken);
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

// Generar sugerencias de slug a partir del nombre del negocio
router.post('/suggest-slugs', checkEmailLimiter, async (req, res) => {
  try {
    const { businessName } = req.body;
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({ message: 'El nombre del negocio es requerido' });
    }

    const base = businessName.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!base) {
      return res.status(400).json({ message: 'El nombre no genera un slug válido' });
    }

    // Generate variations
    const words = base.split('-').filter(Boolean);
    const candidates = new Set();
    candidates.add(base);

    // Abbreviations / short forms
    if (words.length > 1) {
      // First word only
      candidates.add(words[0]);
      // First + last
      candidates.add(`${words[0]}-${words[words.length - 1]}`);
      // Initials + last word
      if (words.length >= 3) {
        const initials = words.slice(0, -1).map(w => w[0]).join('');
        candidates.add(`${initials}-${words[words.length - 1]}`);
      }
    }

    // With common suffixes
    candidates.add(`${base}-menu`);
    candidates.add(`${base}-app`);
    if (words.length === 1) {
      candidates.add(`${base}-restaurante`);
    }

    // Check availability for all candidates
    const slugArray = [...candidates];
    const existingSlugs = await BusinessConfig.find(
      { slug: { $in: slugArray } },
      { slug: 1 }
    ).lean();
    const takenSet = new Set(existingSlugs.map(s => s.slug));

    const suggestions = [];
    for (const slug of slugArray) {
      if (!takenSet.has(slug)) {
        suggestions.push({ slug, available: true });
      } else {
        // Find next available numbered variant
        let counter = 1;
        let variant;
        do {
          variant = `${slug}-${counter}`;
          counter++;
        } while (await BusinessConfig.findOne({ slug: variant }));
        suggestions.push({ slug: variant, available: true, original: slug });
      }
      if (suggestions.length >= 5) break;
    }

    res.json({ suggestions });
  } catch (error) {
    logger.error('Error al sugerir slugs', process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Verificar disponibilidad de slug individual
router.post('/check-slug', checkEmailLimiter, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ message: 'Slug es requerido' });
    }
    const normalized = slug.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const existing = await BusinessConfig.findOne({ slug: normalized });
    res.json({ slug: normalized, available: !existing });
  } catch (error) {
    logger.error('Error al verificar slug', process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json({ message: 'Error en el servidor' });
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
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
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

    // Generar tokens (incluye brandId para brand_admin)
    const token = generateToken(admin._id, admin.businessId, admin.role, admin.brandId);
    const refreshToken = generateRefreshToken(admin._id);
    admin.addRefreshToken(refreshToken);
    await admin.save();

    // Cargar sucursales para brand_admin
    let branches = null;
    if (admin.role === 'brand_admin' && admin.accessibleBusinessIds?.length) {
      branches = await BusinessConfig.find(
        { _id: { $in: admin.accessibleBusinessIds } },
        'businessName branchLabel slug isMainBranch'
      ).lean();
    }

    res.json({
      token,
      refreshToken,
      user: {
        id: admin._id,
        username: admin.username,
        name: admin.name,
        avatar: admin.avatar,
        authProvider: admin.authProvider,
        lastLogin: admin.lastLogin,
        mustChangePassword: admin.mustChangePassword,
        businessId: admin.businessId,
        role: admin.role,
        brandId: admin.brandId || null,
        branches,
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

    // Try Admin first
    const admin = await Admin.findByRefreshToken(decoded.id, refreshToken);
    if (admin) {
      const token = generateToken(admin._id, admin.businessId, admin.role, admin.brandId);
      return res.json({ token });
    }

    // Try SuperAdmin
    const SuperAdmin = require('../Models/SuperAdmin');
    const superAdmin = await SuperAdmin.findByRefreshToken(decoded.id, refreshToken);
    if (superAdmin) {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: superAdmin._id, role: 'superadmin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({ token });
    }

    return res.status(401).json({ message: 'Refresh token inválido' });
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
      admin.removeRefreshToken(refreshToken);
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
    // Invalidate all existing sessions
    admin.refreshTokens = [];
    await admin.save();
    // Clear auth middleware cache for this user
    const { invalidateUserCache } = require('../middleware/authMiddleware');
    invalidateUserCache(admin._id.toString(), admin.role || 'admin');
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
    
    // Validate password strength (same rules as registration)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
    }
    
    admin.password = newPassword;
    admin.mustChangePassword = false;
    // Invalidate all existing sessions except current
    admin.refreshTokens = [];
    await admin.save();
    // Clear auth middleware cache
    const { invalidateUserCache } = require('../middleware/authMiddleware');
    invalidateUserCache(admin._id.toString(), admin.role || 'admin');
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
});

// Obtener datos del usuario autenticado (protegido)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // SuperAdmin viewing as admin — return superadmin info with the target businessId
    if (req.user.role === 'superadmin') {
      const SuperAdmin = require('../Models/SuperAdmin');
      const sa = await SuperAdmin.findById(req.user.id).select('-password');
      if (!sa) return res.status(401).json({ message: 'Usuario no encontrado' });
      
      return res.json({
        user: {
          id: sa._id,
          username: sa.username || 'SuperAdmin',
          name: sa.name || 'SuperAdmin',
          role: 'superadmin',
          businessId: req.query.businessId || null,
          createdAt: sa.createdAt,
          updatedAt: sa.updatedAt
        }
      });
    }

    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }
    
    // Cargar sucursales para brand_admin
    let branches = null;
    if (admin.role === 'brand_admin' && admin.accessibleBusinessIds?.length) {
      branches = await BusinessConfig.find(
        { _id: { $in: admin.accessibleBusinessIds } },
        'businessName branchLabel slug isMainBranch'
      ).lean();
    }

    const userData = {
      id: admin._id,
      username: admin.username,
      name: admin.name,
      avatar: admin.avatar,
      authProvider: admin.authProvider,
      lastLogin: admin.lastLogin,
      mustChangePassword: admin.mustChangePassword,
      businessId: admin.businessId,
      role: admin.role,
      brandId: admin.brandId || null,
      branches,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    res.json({ user: userData });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

// ==================== GOOGLE OAUTH ====================

// Rate limiter para Google auth
const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Demasiados intentos. Intente nuevamente más tarde.' }
});

// POST /auth/google - Login o Registro con Google
router.post('/google', googleAuthLimiter, async (req, res) => {
  try {
    const { credential, businessName, slug: chosenSlug, businessType, referralCode, phone } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Token de Google es requerido' });
    }

    // Verificar el ID token con Google
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
    } catch (err) {
      logger.error('Google token verification failed', err);
      return res.status(401).json({ message: 'Token de Google inválido' });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: 'No se pudo obtener el email de Google' });
    }

    // Buscar si ya existe un admin con este googleId o email
    let admin = await Admin.findOne({ $or: [{ googleId }, { username: email }] });

    if (admin) {
      // ===== LOGIN: usuario existente =====

      // Si el admin existía con email/password y ahora usa Google, vincular
      if (!admin.googleId) {
        admin.googleId = googleId;
        admin.authProvider = 'google';
        if (!admin.name) admin.name = name;
        if (!admin.avatar) admin.avatar = picture;
      }

      admin.lastLogin = new Date();
      const token = generateToken(admin._id, admin.businessId, admin.role, admin.brandId);
      const refreshToken = generateRefreshToken(admin._id);
      admin.addRefreshToken(refreshToken);
      await admin.save();

      // Obtener slug del negocio
      const business = await BusinessConfig.findById(admin.businessId);

      return res.json({
        isNewUser: false,
        token,
        refreshToken,
        user: {
          id: admin._id,
          username: admin.username,
          name: admin.name,
          avatar: admin.avatar,
          lastLogin: admin.lastLogin,
          mustChangePassword: false,
          businessId: admin.businessId,
          role: admin.role,
          authProvider: admin.authProvider
        },
        business: business ? {
          id: business._id,
          slug: business.slug,
          businessName: business.businessName
        } : null
      });
    }

    // ===== REGISTRO: usuario nuevo =====

    if (!businessName || !businessName.trim()) {
      // Necesitamos el nombre del negocio para crear la cuenta
      return res.json({
        needsBusinessName: true,
        googleUser: { name, email, picture }
      });
    }

    // Validar teléfono para registro nuevo
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'El número de teléfono/WhatsApp es obligatorio' });
    }
    const sanitizedPhone = phone.trim().substring(0, 30);

    // Sanitizar
    const sanitizedBusinessName = businessName.trim().substring(0, 100);

    // Usar slug elegido o generar uno
    let slug;
    if (chosenSlug) {
      slug = chosenSlug.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const slugTaken = await BusinessConfig.findOne({ slug });
      if (slugTaken) {
        return res.status(400).json({ message: 'El enlace elegido ya no está disponible.' });
      }
    } else {
      slug = sanitizedBusinessName.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
    }

    // Determinar tipo de negocio
    const validTypes = ['fast_food', 'restaurant', 'cafe', 'bakery', 'ice_cream', 'bar', 'food_truck', 'salon', 'spa', 'clinic', 'services', 'other'];
    const finalBusinessType = validTypes.includes(businessType) ? businessType : 'restaurant';
    const typeConfig = BUSINESS_TYPE_CONFIG[finalBusinessType];

    // Crear BusinessConfig
    const businessConfig = new BusinessConfig({
      slug,
      businessName: sanitizedBusinessName,
      businessType: finalBusinessType,
      orderingMode: typeConfig.orderingMode,
      whatsappNumber: sanitizedPhone,
      onboarding: { level: 1, completedAt: null, guidesShown: [] },
      onboardingFeatureDate: new Date(),
      isActive: true,
      // Auto-enable bookings for service-type businesses
      ...(typeConfig.isServiceType ? {
        enableBookings: true,
        bookingSettings: { slotInterval: 30, maxAdvanceDays: 30, bufferMinutes: 0, autoConfirm: true }
      } : {})
    });
    await businessConfig.save();

    // Crear categorías por defecto según tipo de negocio
    await createDefaultCategories(businessConfig._id, finalBusinessType);

    // Crear Admin (sin password para Google auth)
    admin = new Admin({
      username: email,
      password: require('crypto').randomBytes(32).toString('hex'), // password random que nunca se usará
      name: name || email.split('@')[0],
      phone: sanitizedPhone,
      avatar: picture || null,
      googleId,
      authProvider: 'google',
      businessId: businessConfig._id,
      mustChangePassword: false,
      role: 'admin'
    });
    await admin.save();

    // Crear Subscription (trial)
    const Subscription = require('../Models/Subscription');
    const TRIAL_DAYS = parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || 7);
    const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || 1);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
    const graceUntil = new Date(periodEnd);
    graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);

    await new Subscription({
      businessId: businessConfig._id,
      planType: 'monthly',
      commercialPlan: 'free',
      billingCycle: 'monthly',
      status: 'active',
      startDate: now,
      endDate: periodEnd,
      periodStart: now,
      periodEnd: periodEnd,
      graceUntil: graceUntil,
      price: 0,
      paymentStatus: 'paid',
      isActive: true,
      isTrialPeriod: true,
      paymentMethod: 'OTHER',
      notes: `Período de prueba de ${TRIAL_DAYS} días con ${GRACE_DAYS} día(s) de gracia (Google OAuth)`
    }).save();

    // Process referral code if provided
    if (referralCode && typeof referralCode === 'string' && referralCode.trim()) {
      try {
        const ReferralConfigModel = require('../Models/ReferralConfig');
        const ReferralModel = require('../Models/Referral');
        const refConfig = await ReferralConfigModel.getConfig();
        if (refConfig.isActive) {
          const code = referralCode.toUpperCase().trim();
          const referrer = await BusinessConfig.findOne({ referralCode: code });
          if (referrer && referrer._id.toString() !== businessConfig._id.toString()) {
            const existingRef = await ReferralModel.findOne({ referredBusinessId: businessConfig._id });
            if (!existingRef) {
              const refCount = await ReferralModel.countDocuments({ referrerBusinessId: referrer._id });
              if (refCount < refConfig.maxReferralsPerBusiness) {
                await ReferralModel.create({
                  referrerBusinessId: referrer._id,
                  referredBusinessId: businessConfig._id,
                  referralCode: code,
                  status: 'pending'
                });
                logger.info('Referral created at Google registration', { referrer: referrer._id, referred: businessConfig._id, code });
              }
            }
          }
        }
      } catch (refErr) {
        logger.warn('Non-blocking error processing referral at Google registration', { error: refErr.message });
      }
    }

    // Generar tokens
    const token = generateToken(admin._id, businessConfig._id);
    const refreshToken = generateRefreshToken(admin._id);
    admin.addRefreshToken(refreshToken);
    await admin.save();

    logger.info(`Nuevo negocio registrado via Google: ${sanitizedBusinessName} (${email})`);


    res.status(201).json({
      isNewUser: true,
      token,
      refreshToken,
      user: {
        id: admin._id,
        username: admin.username,
        name: admin.name,
        avatar: admin.avatar,
        lastLogin: admin.lastLogin,
        mustChangePassword: false,
        businessId: businessConfig._id,
        role: admin.role,
        authProvider: 'google'
      },
      business: {
        id: businessConfig._id,
        slug,
        businessName: sanitizedBusinessName
      }
    });
  } catch (error) {
    logger.error('Error en Google auth', { message: error.message, stack: error.stack?.split('\n').slice(0, 3).join(' | ') });
    res.status(500).json({ message: 'Error en el servidor al procesar autenticación con Google' });
  }
});

// ==================== ONBOARDING ====================

// GET /auth/onboarding-status — calcula nivel en tiempo real
router.get('/onboarding-status', authMiddleware, async (req, res) => {
  try {
    let businessId;

    // SuperAdmin: get businessId from query param or return legacy
    if (req.user.role === 'superadmin') {
      businessId = req.query.businessId;
      if (!businessId) {
        return res.json({ isLegacy: true, level: 6, progress: 100, unlockedSections: 'all', guidesShown: [], nextStep: null });
      }
    } else {
      const admin = await Admin.findById(req.user.id);
      if (!admin) return res.status(401).json({ message: 'No autorizado' });
      businessId = admin.businessId;
    }

    const business = await BusinessConfig.findById(businessId);
    if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

    // Si es un negocio existente antes del feature (no tiene onboardingFeatureDate) → todo desbloqueado
    const isLegacy = !business.onboardingFeatureDate;
    if (isLegacy) {
      return res.json({
        isLegacy: true,
        level: 6,
        progress: 100,
        completedAt: business.createdAt,
        guidesShown: business.onboarding?.guidesShown || [],
        businessType: business.businessType || 'restaurant',
        unlockedSections: 'all',
        nextStep: null
      });
    }

    // Si ya completó el onboarding
    if (business.onboarding?.completedAt) {
      return res.json({
        isLegacy: false,
        level: 6,
        progress: 100,
        completedAt: business.onboarding.completedAt,
        guidesShown: business.onboarding.guidesShown || [],
        businessType: business.businessType,
        unlockedSections: 'all',
        nextStep: null
      });
    }

    // Calcular nivel en tiempo real basado en datos reales
    const [categoryCount, productCount, orderCount, customerCount] = await Promise.all([
      Category.countDocuments({ businessId }),
      mongoose.model('Product').countDocuments({ businessId }),
      mongoose.model('Order').countDocuments({ businessId }),
      mongoose.model('Customer').countDocuments({ businessId })
    ]);

    let level = 1; // Post-registration: has categories + products unlocked
    let nextStep = { action: 'Agrega tu primera categoría', tab: 'categories' };
    const progress = 10;

    // Level 2: Has ≥1 category AND ≥1 product
    if (categoryCount >= 1 && productCount >= 1) {
      level = 2;
      nextStep = { action: 'Personaliza tu menú', tab: 'theme' };
    }
    // Level 3: Has configured ordering mode or received first order
    if (level >= 2 && (business.orderingMode !== 'whatsapp' || orderCount >= 1)) {
      level = 3;
      nextStep = { action: 'Espera tu primer pedido', tab: 'orders' };
    }
    // Level 4: Has ≥5 orders or ≥3 customers
    if (level >= 3 && (orderCount >= 5 || customerCount >= 3)) {
      level = 4;
      nextStep = { action: 'Conoce a tus clientes', tab: 'customers' };
    }
    // Level 5: Has ≥10 orders
    if (level >= 4 && orderCount >= 10) {
      level = 5;
      nextStep = { action: 'Explora herramientas avanzadas', tab: 'coupons' };
    }
    // Level 6: All complete
    if (level >= 5 && orderCount >= 15) {
      level = 6;
      nextStep = null;
      // Mark as completed
      business.onboarding.completedAt = new Date();
    }

    // Calculate progress percentage
    const progressMap = { 1: 10, 2: 30, 3: 50, 4: 70, 5: 85, 6: 100 };

    // Define which sections are unlocked per level
    const sectionsByLevel = {
      1: ['categories', 'products', 'business'],
      2: ['categories', 'products', 'business', 'theme', 'product-order', 'toppings'],
      3: ['categories', 'products', 'business', 'theme', 'product-order', 'toppings', 'orders', 'completed_orders', 'payment-config'],
      4: ['categories', 'products', 'business', 'theme', 'product-order', 'toppings', 'orders', 'completed_orders', 'payment-config', 'customers', 'reviews'],
      5: ['categories', 'products', 'business', 'theme', 'product-order', 'toppings', 'orders', 'completed_orders', 'payment-config', 'customers', 'reviews', 'coupons', 'tables', 'delivery-zones', 'catalog', 'whatsapp'],
      6: 'all'
    };

    // Always unlocked
    const alwaysUnlocked = ['location', 'change-password', 'subscription', 'dashboard'];

    // Update level in DB if changed
    if (business.onboarding.level !== level) {
      business.onboarding.level = level;
      await business.save();
    }

    res.json({
      isLegacy: false,
      level,
      progress: progressMap[level] || 10,
      completedAt: business.onboarding.completedAt,
      guidesShown: business.onboarding.guidesShown || [],
      businessType: business.businessType,
      unlockedSections: level >= 6 ? 'all' : [...(sectionsByLevel[level] || []), ...alwaysUnlocked],
      nextStep
    });
  } catch (error) {
    logger.error('Error getting onboarding status', process.env.NODE_ENV !== 'production' ? error : undefined);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// POST /auth/onboarding-guide-shown — mark a guide as seen
router.post('/onboarding-guide-shown', authMiddleware, async (req, res) => {
  try {
    const { guideId } = req.body;
    if (!guideId) return res.status(400).json({ message: 'guideId es requerido' });

    // SuperAdmin: just acknowledge, don't modify business data
    if (req.user.role === 'superadmin') return res.json({ success: true });

    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(401).json({ message: 'No autorizado' });

    await BusinessConfig.findByIdAndUpdate(admin.businessId, {
      $addToSet: { 'onboarding.guidesShown': guideId }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking guide shown', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// GET /auth/business-types — returns available business types for registration
router.get('/business-types', (req, res) => {
  const types = Object.entries(BUSINESS_TYPE_CONFIG).map(([key, val]) => ({
    id: key,
    label: val.label,
    emoji: val.emoji,
    categoryCount: val.categories.length
  }));
  res.json({ types });
});

// ==================== STAFF (SUB-USER) MANAGEMENT ====================

const { requireRole } = require('../middleware/authMiddleware');
const { validateUpdateStaff } = require('../middleware/validators/staffValidators');
const { getPlanLimitStatus } = require('../utils/subscriptionHelper');

// GET /auth/staff — list staff users for this business
router.get('/staff', authMiddleware, requireRole('admin', 'brand_admin', 'superadmin'), async (req, res) => {
  try {
    const bId = req.user.businessId || req.query.businessId;
    if (!bId) return res.status(400).json({ message: 'businessId requerido' });
    const staff = await Admin.find({
      businessId: bId,
      role: { $in: ['staff', 'manager'] }
    }).select('username name role lastLogin createdAt phone bio specialty profileImage isPublic commissionType commissionValue schedule servicesOffered').sort('-createdAt');
    res.json({ staff });
  } catch (error) {
    logger.error('Error listing staff', error);
    res.status(500).json({ message: 'Error al listar el equipo' });
  }
});

// POST /auth/staff — create a staff user
router.post('/staff', authMiddleware, requireRole('admin', 'brand_admin', 'superadmin'), async (req, res) => {
  try {
    const { username, password, name, role, businessId: bodyBizId } = req.body;
    const bId = req.user.businessId || bodyBizId;
    if (!bId) return res.status(400).json({ message: 'businessId requerido' });

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const allowedRoles = ['staff', 'manager'];
    const staffRole = allowedRoles.includes(role) ? role : 'staff';

    // Check if username already exists
    const existing = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Este nombre de usuario ya está en uso' });
    }

    const currentUsers = await Admin.countDocuments({
      businessId: bId,
      role: { $in: ['admin', 'staff', 'manager'] }
    });
    const limitStatus = await getPlanLimitStatus({
      businessId: bId,
      resourceKey: 'staffUsers',
      currentCount: currentUsers
    });

    if (limitStatus.limitReached) {
      return res.status(403).json({
        message: limitStatus.message,
        code: 'PLAN_LIMIT_REACHED',
        resource: 'staffUsers',
        plan: limitStatus.commercialPlan,
        limit: limitStatus.limitValue,
        current: currentUsers
      });
    }

    const staff = new Admin({
      username: username.toLowerCase().trim(),
      password,
      name: name || username,
      role: staffRole,
      businessId: bId,
      authProvider: 'local'
    });
    await staff.save();

    res.status(201).json({
      staff: {
        id: staff._id,
        username: staff.username,
        name: staff.name,
        role: staff.role,
        createdAt: staff.createdAt
      }
    });
  } catch (error) {
    logger.error('Error creating staff user', error);
    res.status(500).json({ message: 'Error al crear el usuario' });
  }
});

// PATCH /auth/staff/:id — update staff profile
router.patch('/staff/:id', authMiddleware, requireRole('admin', 'brand_admin', 'superadmin'), validateUpdateStaff, async (req, res) => {
  try {
    const staffId = req.params.id;
    const bId = req.user.businessId || req.body.businessId;
    if (!bId) return res.status(400).json({ message: 'businessId requerido' });

    const staff = await Admin.findOne({
      _id: staffId,
      businessId: bId,
      role: { $in: ['staff', 'manager'] }
    });

    if (!staff) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Whitelist — only allow these fields to be updated
    const allowedFields = ['name', 'bio', 'specialty', 'phone', 'profileImage', 'isPublic', 'commissionType', 'commissionValue', 'schedule', 'servicesOffered'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        staff[field] = req.body[field];
      }
    }

    // Validate commission: percentage cannot exceed 100
    if (staff.commissionType === 'percentage' && staff.commissionValue > 100) {
      return res.status(400).json({ message: 'El porcentaje de comisión no puede exceder 100%' });
    }

    // Validate servicesOffered belong to the same business
    if (req.body.servicesOffered && req.body.servicesOffered.length > 0) {
      const Product = require('../Models/Product');
      const validProducts = await Product.countDocuments({
        _id: { $in: req.body.servicesOffered },
        businessId: bId
      });
      if (validProducts !== req.body.servicesOffered.length) {
        return res.status(400).json({ message: 'Algunos servicios no pertenecen a este negocio' });
      }
    }

    await staff.save();

    // Return updated staff without sensitive fields
    const updated = staff.toObject();
    delete updated.password;
    delete updated.refreshTokens;

    res.json({ staff: updated });
  } catch (error) {
    logger.error('Error updating staff profile', error);
    res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
});

// DELETE /auth/staff/:id — delete a staff user
router.delete('/staff/:id', authMiddleware, requireRole('admin', 'brand_admin', 'superadmin'), async (req, res) => {
  try {
    const staffId = req.params.id;
    const bId = req.user.businessId || req.query.businessId;
    if (!bId) return res.status(400).json({ message: 'businessId requerido' });
    const staff = await Admin.findOne({
      _id: staffId,
      businessId: bId,
      role: { $in: ['staff', 'manager'] }
    });

    if (!staff) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await Admin.deleteOne({ _id: staffId });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    logger.error('Error deleting staff user', error);
    res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
});

// ==================== BRAND ADMIN — BRANCH SWITCHING ====================

// GET /auth/my-branches — returns branches accessible to brand_admin
router.get('/my-branches', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'brand_admin') return res.status(403).json({ message: 'Solo para brand_admin' });
    const admin = await Admin.findById(req.user.id, 'accessibleBusinessIds brandId').lean();
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });
    const branches = await BusinessConfig.find(
      { _id: { $in: admin.accessibleBusinessIds } },
      'businessName branchLabel slug isMainBranch isActive'
    ).lean();
    res.json({ branches });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /auth/switch-branch — brand_admin switches active branch (returns new JWT)
router.post('/switch-branch', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'brand_admin') return res.status(403).json({ message: 'Solo para brand_admin' });
    const { targetBusinessId } = req.body;
    if (!targetBusinessId) return res.status(400).json({ message: 'targetBusinessId requerido' });

    const admin = await Admin.findById(req.user.id, 'brandId accessibleBusinessIds').lean();
    if (!admin) return res.status(404).json({ message: 'Admin no encontrado' });

    const hasAccess = (admin.accessibleBusinessIds || []).some(id => id.toString() === String(targetBusinessId));
    if (!hasAccess) return res.status(403).json({ message: 'Sin acceso a esta sucursal' });

    const token = generateToken(admin._id, targetBusinessId, 'brand_admin', admin.brandId);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 