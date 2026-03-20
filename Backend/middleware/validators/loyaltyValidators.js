const { body } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');

// PUT /program — update loyalty program
const validateUpdateProgram = [
  body('pointsPerAmount').optional().isInt({ min: 1 }).withMessage('pointsPerAmount debe ser >= 1'),
  body('amountPerPoints').optional().isInt({ min: 1 }).withMessage('amountPerPoints debe ser >= 1'),
  body('firstOrderBonus').optional().isInt({ min: 0 }).withMessage('firstOrderBonus debe ser >= 0'),
  body('referralBonus').optional().isInt({ min: 0 }).withMessage('referralBonus debe ser >= 0'),
  body('pointsExpiryDays').optional().isInt({ min: 0 }).withMessage('pointsExpiryDays debe ser >= 0'),
  handleValidationErrors,
];

// POST /redeem — redeem loyalty reward
const validateRedeem = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('phone').trim().notEmpty().withMessage('phone es requerido')
    .isLength({ max: 30 }).withMessage('phone excede 30 caracteres'),
  body('rewardId').trim().notEmpty().withMessage('rewardId es requerido'),
  handleValidationErrors,
];

module.exports = {
  validateUpdateProgram,
  validateRedeem,
};
