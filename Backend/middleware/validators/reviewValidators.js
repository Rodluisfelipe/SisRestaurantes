const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// POST / — create review
const validateCreateReview = [
  body('phone').trim().notEmpty().withMessage('phone es requerido')
    .isLength({ max: 30 }).withMessage('phone excede 30 caracteres'),
  body('businessId').trim().notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  body('orderId').trim().notEmpty().withMessage('orderId es requerido')
    .custom(isObjectId).withMessage('orderId inválido'),
  body('customerName').trim().notEmpty().withMessage('customerName es requerido')
    .isLength({ max: 100 }).withMessage('customerName excede 100 caracteres'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating debe ser un entero entre 1 y 5'),
  body('comment').optional({ values: 'falsy' }).isString()
    .isLength({ max: 2000 }).withMessage('comment excede 2000 caracteres'),
  handleValidationErrors,
];

// PUT /:id/reply
const validateReply = [
  param('id').custom(isObjectId).withMessage('ID de reseña inválido'),
  body('reply').trim().notEmpty().withMessage('La respuesta es requerida')
    .isLength({ max: 300 }).withMessage('La respuesta no puede exceder 300 caracteres'),
  handleValidationErrors,
];

// PUT /:id/visibility
const validateVisibility = [
  param('id').custom(isObjectId).withMessage('ID de reseña inválido'),
  body('isVisible').isBoolean().withMessage('isVisible debe ser un booleano'),
  handleValidationErrors,
];

module.exports = {
  validateCreateReview,
  validateReply,
  validateVisibility,
};
