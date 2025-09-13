import { useState, useCallback } from 'react';

/**
 * Hook personalizado para manejo de validaciones de formularios
 * Elimina duplicación de lógica de validación
 */

const useFormValidation = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Reglas de validación comunes
  const commonValidations = {
    required: (value, message = 'Este campo es obligatorio') => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        return message;
      }
      return null;
    },
    
    email: (value, message = 'Ingresa un email válido') => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return message;
      }
      return null;
    },
    
    minLength: (minLength, message) => (value) => {
      if (value && value.length < minLength) {
        return message || `Debe tener al menos ${minLength} caracteres`;
      }
      return null;
    },
    
    maxLength: (maxLength, message) => (value) => {
      if (value && value.length > maxLength) {
        return message || `No debe exceder ${maxLength} caracteres`;
      }
      return null;
    },
    
    match: (fieldToMatch, message) => (value, allValues) => {
      if (value && allValues[fieldToMatch] && value !== allValues[fieldToMatch]) {
        return message || 'Los campos no coinciden';
      }
      return null;
    },
    
    number: (value, message = 'Debe ser un número válido') => {
      if (value && isNaN(Number(value))) {
        return message;
      }
      return null;
    },
    
    positiveNumber: (value, message = 'Debe ser un número positivo') => {
      if (value && (isNaN(Number(value)) || Number(value) <= 0)) {
        return message;
      }
      return null;
    }
  };

  // Validar un campo específico
  const validateField = useCallback((fieldName, value, allValues = values) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    // Si rules es un array, aplicar todas las validaciones
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        const error = applyValidationRule(rule, value, allValues);
        if (error) return error;
      }
      return null;
    }

    // Si es una sola regla
    return applyValidationRule(rules, value, allValues);
  }, [validationRules, values]);

  // Aplicar una regla de validación
  const applyValidationRule = (rule, value, allValues) => {
    if (typeof rule === 'function') {
      return rule(value, allValues);
    }

    if (typeof rule === 'object') {
      const { type, message, ...params } = rule;
      
      if (commonValidations[type]) {
        if (Object.keys(params).length > 0) {
          // Si hay parámetros, crear la función de validación
          const validationFn = commonValidations[type](Object.values(params)[0], message);
          return validationFn(value, allValues);
        } else {
          // Si no hay parámetros, usar directamente
          return commonValidations[type](value, message);
        }
      }
    }

    return null;
  };

  // Validar todos los campos
  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName], values);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField, validationRules]);

  // Manejar cambios en los campos
  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Si el campo ya fue tocado, validar en tiempo real
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    }
  }, [touched, validateField]);

  // Manejar blur (cuando el usuario sale del campo)
  const handleBlur = useCallback((fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    const error = validateField(fieldName, values[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, [values, validateField]);

  // Resetear el formulario
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  // Establecer valores programáticamente
  const setFieldValue = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
  }, []);

  // Establecer error programáticamente
  const setFieldError = useCallback((fieldName, error) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }));
  }, []);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    reset,
    setFieldValue,
    setFieldError,
    isValid: Object.keys(errors).length === 0,
    hasErrors: Object.keys(errors).length > 0
  };
};

export default useFormValidation;
