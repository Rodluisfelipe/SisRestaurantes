const { validationResult } = require('express-validator');

/**
 * Express middleware that checks for express-validator errors and returns 422
 * with a structured array of field-level errors.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Errores de validación',
      errors: errors.array().map(e => ({ field: e.path, msg: e.msg })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
