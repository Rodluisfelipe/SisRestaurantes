const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// POST / — create or update category
const validateCreateCategory = [
  body('name').trim().notEmpty().withMessage('name es requerido')
    .isLength({ max: 100 }).withMessage('name excede 100 caracteres'),
  body('description').optional({ values: 'falsy' }).isString()
    .isLength({ max: 500 }).withMessage('description excede 500 caracteres'),
  body('_id').optional({ values: 'falsy' }).custom(isObjectId).withMessage('_id inválido'),
  handleValidationErrors,
];

// PUT /reorder
const validateReorderCategories = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('categories').isArray({ min: 1 }).withMessage('categories debe ser un array no vacío'),
  handleValidationErrors,
];

// PUT /:id
const validateUpdateCategory = [
  param('id').custom(isObjectId).withMessage('ID de categoría inválido'),
  body('name').optional().isString().isLength({ max: 100 }).withMessage('name excede 100 caracteres'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('description excede 500 caracteres'),
  handleValidationErrors,
];

// DELETE /:id
const validateDeleteCategory = [
  param('id').custom(isObjectId).withMessage('ID de categoría inválido'),
  handleValidationErrors,
];

// POST /update-order
const validateUpdateOrder = [
  body('categories').isArray({ min: 1 }).withMessage('categories debe ser un array no vacío'),
  handleValidationErrors,
];

module.exports = {
  validateCreateCategory,
  validateReorderCategories,
  validateUpdateCategory,
  validateDeleteCategory,
  validateUpdateOrder,
};
