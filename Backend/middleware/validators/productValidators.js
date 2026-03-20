const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// PUT /products-reorder
const validateProductsReorder = [
  body('businessId').trim().notEmpty().withMessage('businessId es requerido'),
  body('products').isArray({ min: 1 }).withMessage('products debe ser un array no vacío'),
  body('products.*._id').custom(isObjectId).withMessage('Cada product._id debe ser un ObjectId válido'),
  handleValidationErrors,
];

// PUT /reorder-featured
const validateReorderFeatured = [
  body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds debe ser un array no vacío'),
  body('orderedIds.*').custom(isObjectId).withMessage('Cada orderedId debe ser un ObjectId válido'),
  handleValidationErrors,
];

// PUT /:id/toggle-featured
const validateToggleFeatured = [
  param('id').custom(isObjectId).withMessage('ID de producto inválido'),
  handleValidationErrors,
];

// DELETE /:id
const validateDeleteProduct = [
  param('id').custom(isObjectId).withMessage('ID de producto inválido'),
  handleValidationErrors,
];

// PATCH /:id/toggle
const validateToggleProduct = [
  param('id').custom(isObjectId).withMessage('ID de producto inválido'),
  handleValidationErrors,
];

// PUT /:id (param only — validateProductInput handles body)
const validateUpdateProductParam = [
  param('id').custom(isObjectId).withMessage('ID de producto inválido'),
  handleValidationErrors,
];

module.exports = {
  validateProductsReorder,
  validateReorderFeatured,
  validateToggleFeatured,
  validateDeleteProduct,
  validateToggleProduct,
  validateUpdateProductParam,
};
