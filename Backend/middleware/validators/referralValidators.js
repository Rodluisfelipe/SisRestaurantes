const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');

const validateUpdateConfig = [
  body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano'),
  body('referrerDiscountPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('referrerDiscountPercent debe estar entre 0 y 100'),
  body('referredDiscountPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('referredDiscountPercent debe estar entre 0 y 100'),
  body('maxCreditsPerBusiness').optional().isInt({ min: 0 }).withMessage('maxCreditsPerBusiness debe ser >= 0'),
  body('maxReferralsPerBusiness').optional().isInt({ min: 1 }).withMessage('maxReferralsPerBusiness debe ser >= 1'),
  body('requireApproval').optional().isBoolean().withMessage('requireApproval debe ser booleano'),
  body('minSubscriptionMonths').optional().isInt({ min: 1 }).withMessage('minSubscriptionMonths debe ser >= 1'),
  handleValidationErrors
];

const validateApproveReferral = [
  param('id').isMongoId().withMessage('ID de referido inválido'),
  handleValidationErrors
];

const validateRejectReferral = [
  param('id').isMongoId().withMessage('ID de referido inválido'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Razón máximo 500 caracteres'),
  handleValidationErrors
];

const validateReferralCode = [
  param('code').isAlphanumeric().withMessage('Código inválido').isLength({ min: 4, max: 12 }).withMessage('Código debe tener entre 4 y 12 caracteres'),
  handleValidationErrors
];

module.exports = {
  validateUpdateConfig,
  validateApproveReferral,
  validateRejectReferral,
  validateReferralCode
};
