const { body, validationResult } = require('express-validator');

/**
 * Returns 400 with validation errors if any exist.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

/** POST /auth/register */
const validateRegister = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ max: 100 }).withMessage('Nombre muy largo'),
  body('businessName').trim().notEmpty().withMessage('El nombre del negocio es obligatorio')
    .isLength({ max: 100 }).withMessage('Nombre de negocio muy largo'),
  body('email').trim().isEmail().withMessage('Formato de correo electrónico inválido')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('phone').trim().notEmpty().withMessage('El número de teléfono/WhatsApp es obligatorio')
    .isLength({ min: 7, max: 30 }).withMessage('Número de teléfono inválido'),
  handleValidationErrors,
];

/** POST /auth/login */
const validateLogin = [
  body('username').trim().notEmpty().withMessage('El usuario es requerido')
    .isLength({ max: 100 }).withMessage('Usuario muy largo'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
  handleValidationErrors,
];

/** POST /orders */
const validateCreateOrder = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('customerName').trim().notEmpty().withMessage('Nombre del cliente es requerido')
    .isLength({ max: 100 }).withMessage('customerName excede 100 caracteres'),
  body('orderType').isIn(['inSite', 'takeaway', 'delivery']).withMessage('orderType inválido'),
  body('items').isArray({ min: 1, max: 100 }).withMessage('items debe ser un array de 1 a 100 elementos'),
  body('items.*.name').trim().notEmpty().withMessage('Cada item debe tener nombre'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Cada item debe tener cantidad >= 1'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Cada item debe tener precio >= 0'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('totalAmount debe ser un número >= 0'),
  body('address').optional().isLength({ max: 500 }).withMessage('address excede 500 caracteres'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateCreateOrder,
};
