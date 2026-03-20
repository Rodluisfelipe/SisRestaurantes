const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// POST / — create table
const validateCreateTable = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  body('tableNumber').notEmpty().withMessage('tableNumber es requerido'),
  body('tableName').optional().isString().isLength({ max: 100 }).withMessage('tableName excede 100 caracteres'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('notes excede 500 caracteres'),
  body('capacity').optional().isInt({ min: 1, max: 100 }).withMessage('capacity debe ser un entero entre 1 y 100'),
  handleValidationErrors,
];

// PUT /:id — update table
const validateUpdateTable = [
  param('id').custom(isObjectId).withMessage('ID de mesa inválido'),
  body('tableName').optional().isString().isLength({ max: 100 }).withMessage('tableName excede 100 caracteres'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('notes excede 500 caracteres'),
  body('capacity').optional().isInt({ min: 1, max: 100 }).withMessage('capacity debe ser un entero entre 1 y 100'),
  handleValidationErrors,
];

// DELETE /:id
const validateDeleteTable = [
  param('id').custom(isObjectId).withMessage('ID de mesa inválido'),
  handleValidationErrors,
];

// PUT /batch/positions
const validateBatchPositions = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido')
    .custom(isObjectId).withMessage('businessId inválido'),
  body('updates').isArray({ min: 1 }).withMessage('updates debe ser un array no vacío'),
  body('updates.*._id').custom(isObjectId).withMessage('Cada update._id debe ser un ObjectId válido'),
  handleValidationErrors,
];

module.exports = {
  validateCreateTable,
  validateUpdateTable,
  validateDeleteTable,
  validateBatchPositions,
};
