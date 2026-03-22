const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// POST / — create or find customer
const validateCreateCustomer = [
  body('phone').trim().notEmpty().withMessage('Teléfono es requerido')
    .isLength({ max: 30 }).withMessage('Teléfono excede 30 caracteres'),
  body('name').trim().notEmpty().withMessage('Nombre es requerido')
    .isLength({ max: 100 }).withMessage('Nombre excede 100 caracteres'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email inválido')
    .isLength({ max: 254 }).withMessage('Email excede 254 caracteres'),
  body('address').optional({ values: 'falsy' }).isString()
    .isLength({ max: 500 }).withMessage('Dirección excede 500 caracteres'),
  query('businessId').notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  handleValidationErrors,
];

// PUT /:phone — update customer data
const validateUpdateCustomer = [
  param('phone').trim().notEmpty().withMessage('Número de teléfono requerido'),
  body('name').optional().isString().isLength({ max: 100 }).withMessage('Nombre excede 100 caracteres'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email inválido')
    .isLength({ max: 254 }).withMessage('Email excede 254 caracteres'),
  body('address').optional({ values: 'falsy' }).isString()
    .isLength({ max: 500 }).withMessage('Dirección excede 500 caracteres'),
  handleValidationErrors,
];

// PATCH /:phone/address
const validateUpdateAddress = [
  param('phone').trim().notEmpty().withMessage('Número de teléfono requerido'),
  body('name').optional().isString().isLength({ max: 100 }).withMessage('Nombre excede 100 caracteres'),
  body('address').optional().isString().isLength({ max: 500 }).withMessage('Dirección excede 500 caracteres'),
  handleValidationErrors,
];

// PUT /:phone/settings
const validateUpdateSettings = [
  param('phone').trim().notEmpty().withMessage('Número de teléfono requerido'),
  handleValidationErrors,
];

// DELETE /:phone
const validateDeleteCustomer = [
  param('phone').trim().notEmpty().withMessage('Número de teléfono requerido'),
  handleValidationErrors,
];

// DELETE /by-id/:id
const validateDeleteCustomerById = [
  param('id').custom(isObjectId).withMessage('ID del cliente inválido'),
  handleValidationErrors,
];

// POST /:id/notes — add a note to customer
const validateAddNote = [
  param('id').custom(isObjectId).withMessage('ID del cliente inválido'),
  body('text').trim().notEmpty().withMessage('El texto de la nota es requerido')
    .isLength({ max: 1000 }).withMessage('La nota excede 1000 caracteres'),
  body('bookingId').optional({ values: 'falsy' })
    .custom(isObjectId).withMessage('bookingId inválido'),
  body('orderId').optional({ values: 'falsy' })
    .custom(isObjectId).withMessage('orderId inválido'),
  handleValidationErrors,
];

// PATCH /:id/tags — replace customer tags
const validateUpdateTags = [
  param('id').custom(isObjectId).withMessage('ID del cliente inválido'),
  body('tags').isArray({ max: 20 }).withMessage('tags debe ser un array (máximo 20)'),
  body('tags.*').isString().trim().isLength({ min: 1, max: 50 })
    .withMessage('Cada tag debe tener entre 1 y 50 caracteres'),
  handleValidationErrors,
];

module.exports = {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateUpdateAddress,
  validateUpdateSettings,
  validateDeleteCustomer,
  validateDeleteCustomerById,
  validateAddNote,
  validateUpdateTags,
};
