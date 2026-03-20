const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');

// PUT / — general config update
const validateUpdateConfig = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('businessName').optional().isString().isLength({ max: 200 }).withMessage('businessName excede 200 caracteres'),
  body('description').optional().isString().isLength({ max: 2000 }).withMessage('description excede 2000 caracteres'),
  body('address').optional().isString().isLength({ max: 500 }).withMessage('address excede 500 caracteres'),
  body('whatsappNumber').optional().isString().isLength({ max: 30 }).withMessage('whatsappNumber excede 30 caracteres'),
  body('googleMapsUrl').optional().isString().isLength({ max: 2000 }).withMessage('googleMapsUrl excede 2000 caracteres'),
  handleValidationErrors,
];

// PUT /status
const validateUpdateStatus = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('isOpen').isBoolean().withMessage('isOpen debe ser un booleano'),
  handleValidationErrors,
];

// POST /fix-schema
const validateFixSchema = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  handleValidationErrors,
];

// PUT /active (superadmin)
const validateUpdateActive = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('isActive').isBoolean().withMessage('isActive debe ser un booleano'),
  handleValidationErrors,
];

// PUT /hours
const validateUpdateHours = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('businessHours').isObject().withMessage('businessHours debe ser un objeto'),
  handleValidationErrors,
];

// PUT /menu-status
const validateUpdateMenuStatus = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('menuStatus').isIn(['active', 'paused']).withMessage("menuStatus debe ser 'active' o 'paused'"),
  handleValidationErrors,
];

// PUT /:businessId
const validateUpdateConfigById = [
  param('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('businessName').optional().isString().isLength({ max: 200 }).withMessage('businessName excede 200 caracteres'),
  body('description').optional().isString().isLength({ max: 2000 }).withMessage('description excede 2000 caracteres'),
  body('address').optional().isString().isLength({ max: 500 }).withMessage('address excede 500 caracteres'),
  body('whatsappNumber').optional().isString().isLength({ max: 30 }).withMessage('whatsappNumber excede 30 caracteres'),
  body('googleMapsUrl').optional().isString().isLength({ max: 2000 }).withMessage('googleMapsUrl excede 2000 caracteres'),
  handleValidationErrors,
];

module.exports = {
  validateUpdateConfig,
  validateUpdateStatus,
  validateFixSchema,
  validateUpdateActive,
  validateUpdateHours,
  validateUpdateMenuStatus,
  validateUpdateConfigById,
};
