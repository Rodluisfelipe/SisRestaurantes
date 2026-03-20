const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const { ALL_ORDER_STATUSES } = require('../../utils/constants');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// PATCH /:id/status
const validateUpdateOrderStatus = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  body('status')
    .trim().notEmpty().withMessage('status es requerido')
    .isIn(ALL_ORDER_STATUSES).withMessage('Valor de status inválido'),
  handleValidationErrors,
];

// PATCH /:id/send-to-kitchen
const validateSendToKitchen = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  handleValidationErrors,
];

// DELETE /:id
const validateDeleteOrder = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  handleValidationErrors,
];

// POST /daily-closing
const validateDailyClosing = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  handleValidationErrors,
];

// POST /cleanup-completed
const validateCleanupCompleted = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('orderIds')
    .isArray({ min: 1 }).withMessage('orderIds debe ser un array no vacío'),
  body('orderIds.*')
    .custom(isObjectId).withMessage('Cada orderIds debe ser un ObjectId válido'),
  handleValidationErrors,
];

// POST /:id/payment-proof  — only param; file + customerToken checked in route
const validatePaymentProof = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  body('customerToken').trim().notEmpty().withMessage('Token de cliente requerido'),
  handleValidationErrors,
];

// PATCH /:id/confirm-payment
const validateConfirmPayment = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  body('note').optional().isString().isLength({ max: 500 }).withMessage('note no puede exceder 500 caracteres'),
  handleValidationErrors,
];

// PATCH /:id/reject-payment
const validateRejectPayment = [
  param('id').custom(isObjectId).withMessage('ID de orden inválido'),
  body('reason').optional().isString().isLength({ max: 500 }).withMessage('reason no puede exceder 500 caracteres'),
  handleValidationErrors,
];

module.exports = {
  validateUpdateOrderStatus,
  validateSendToKitchen,
  validateDeleteOrder,
  validateDailyClosing,
  validateCleanupCompleted,
  validatePaymentProof,
  validateConfirmPayment,
  validateRejectPayment,
};
