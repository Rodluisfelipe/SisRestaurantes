const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./handleErrors');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates staff schedule object structure.
 * Expected: { monday: { isOpen: true, openTime: '09:00', closeTime: '18:00' }, ... }
 */
const validateScheduleObject = (schedule) => {
  if (typeof schedule !== 'object' || schedule === null || Array.isArray(schedule)) {
    throw new Error('schedule debe ser un objeto');
  }
  for (const [day, config] of Object.entries(schedule)) {
    if (!VALID_DAYS.includes(day)) {
      throw new Error(`Día inválido en schedule: ${day}`);
    }
    if (typeof config !== 'object' || config === null) {
      throw new Error(`Configuración inválida para ${day}`);
    }
    if (typeof config.isOpen !== 'boolean') {
      throw new Error(`${day}.isOpen debe ser boolean`);
    }
    if (config.isOpen) {
      if (!config.openTime || !TIME_REGEX.test(config.openTime)) {
        throw new Error(`${day}.openTime debe tener formato HH:MM`);
      }
      if (!config.closeTime || !TIME_REGEX.test(config.closeTime)) {
        throw new Error(`${day}.closeTime debe tener formato HH:MM`);
      }
    }
  }
  return true;
};

// PATCH /auth/staff/:id — update staff profile
const validateUpdateStaff = [
  param('id').custom(isObjectId).withMessage('ID de staff inválido'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nombre debe tener entre 1 y 100 caracteres'),
  body('bio').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).withMessage('Bio excede 500 caracteres'),
  body('specialty').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Especialidad excede 100 caracteres'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Teléfono excede 30 caracteres'),
  body('profileImage').optional({ values: 'falsy' }).isString().isLength({ max: 500 }).withMessage('URL de imagen excede 500 caracteres'),
  body('isPublic').optional().isBoolean().withMessage('isPublic debe ser boolean'),
  body('commissionType').optional().isIn(['none', 'percentage', 'fixed']).withMessage('commissionType debe ser none, percentage o fixed'),
  body('commissionValue').optional().isFloat({ min: 0 }).withMessage('commissionValue debe ser >= 0'),
  body('schedule').optional({ values: 'falsy' }).custom(validateScheduleObject),
  body('servicesOffered').optional().isArray({ max: 100 }).withMessage('servicesOffered debe ser un array (max 100)'),
  body('servicesOffered.*').optional().custom(isObjectId).withMessage('Cada servicio debe ser un ObjectId válido'),
  handleValidationErrors,
];

module.exports = {
  validateUpdateStaff,
};
