const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// POST / — create booking
const validateCreateBooking = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  body('customerName').trim().notEmpty().withMessage('customerName es requerido')
    .isLength({ max: 100 }).withMessage('customerName excede 100 caracteres'),
  body('bookingDate').notEmpty().withMessage('bookingDate es requerido')
    .isISO8601().withMessage('bookingDate debe ser una fecha ISO 8601 válida'),
  body('items').isArray({ min: 1 }).withMessage('items debe ser un array no vacío'),
  body('phone').optional({ values: 'falsy' }).isString()
    .isLength({ max: 30 }).withMessage('phone excede 30 caracteres'),
  body('customerEmail').optional({ values: 'falsy' }).isEmail().withMessage('Email inválido')
    .isLength({ max: 254 }).withMessage('Email excede 254 caracteres'),
  body('customerNotes').optional({ values: 'falsy' }).isString()
    .isLength({ max: 1000 }).withMessage('customerNotes excede 1000 caracteres'),
  body('totalAmount').optional().isFloat({ min: 0 }).withMessage('totalAmount debe ser >= 0'),
  body('couponCode').optional({ values: 'falsy' }).isString()
    .isLength({ max: 50 }).withMessage('couponCode excede 50 caracteres'),
  handleValidationErrors,
];

// PATCH /:id/status
const validateUpdateBookingStatus = [
  param('id').custom(isObjectId).withMessage('ID de reserva inválido'),
  body('bookingStatus').trim().notEmpty().withMessage('bookingStatus es requerido')
    .isIn(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
    .withMessage('bookingStatus inválido'),
  body('reason').optional({ values: 'falsy' }).isString()
    .isLength({ max: 500 }).withMessage('reason excede 500 caracteres'),
  handleValidationErrors,
];

// PATCH /:id/assign-staff
const validateAssignStaff = [
  param('id').custom(isObjectId).withMessage('ID de reserva inválido'),
  body('staffId').optional({ values: 'falsy' })
    .custom(isObjectId).withMessage('staffId inválido'),
  body('staffName').optional({ values: 'falsy' }).isString()
    .isLength({ max: 100 }).withMessage('staffName excede 100 caracteres'),
  handleValidationErrors,
];

// POST /recurring
const validateCreateRecurring = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  body('recurrenceType').isIn(['weekly', 'biweekly', 'monthly'])
    .withMessage('recurrenceType debe ser weekly, biweekly o monthly'),
  body('endDate').notEmpty().withMessage('endDate es requerido')
    .isISO8601().withMessage('endDate debe ser una fecha ISO 8601 válida'),
  body('bookingTemplate').isObject().withMessage('bookingTemplate debe ser un objeto'),
  body('bookingTemplate.bookingDate').notEmpty().withMessage('bookingTemplate.bookingDate es requerido')
    .isISO8601().withMessage('bookingTemplate.bookingDate debe ser una fecha ISO 8601 válida'),
  handleValidationErrors,
];

module.exports = {
  validateCreateBooking,
  validateUpdateBookingStatus,
  validateAssignStaff,
  validateCreateRecurring,
};
