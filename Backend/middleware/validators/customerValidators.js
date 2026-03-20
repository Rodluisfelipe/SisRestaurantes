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

module.exports = {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateUpdateAddress,
  validateUpdateSettings,
  validateDeleteCustomer,
  validateDeleteCustomerById,
};
