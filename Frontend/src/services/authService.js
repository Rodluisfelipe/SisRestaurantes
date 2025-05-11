import api from './api';

/**
 * Servicio para manejar la autenticación de usuarios en la landing page
 */

/**
 * Registra un nuevo usuario en el sistema
 * @param {Object} userData - Datos del usuario a registrar
 * @param {string} userData.name - Nombre completo del usuario
 * @param {string} userData.businessName - Nombre del negocio
 * @param {string} userData.email - Correo electrónico
 * @param {string} userData.password - Contraseña
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const registerUser = async (userData) => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    throw error;
  }
};

/**
 * Solicita un restablecimiento de contraseña
 * @param {string} email - Correo electrónico del usuario
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const requestPasswordReset = async (email) => {
  try {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    console.error('Error al solicitar restablecimiento de contraseña:', error);
    throw error;
  }
};

/**
 * Restablece la contraseña con un token
 * @param {string} token - Token de restablecimiento
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<Object>} - Respuesta de la API
 */
export const resetPassword = async (token, newPassword) => {
  try {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    throw error;
  }
};

/**
 * Verifica si un email ya está registrado
 * @param {string} email - Correo electrónico a verificar
 * @returns {Promise<boolean>} - true si el email está disponible, false si ya está registrado
 */
export const checkEmailAvailability = async (email) => {
  try {
    const response = await api.post('/auth/check-email', { email });
    return response.data.available;
  } catch (error) {
    // Si el servidor responde con un error, asumimos que el email no está disponible
    console.error('Error al verificar disponibilidad de email:', error);
    return false;
  }
};

export default {
  registerUser,
  requestPasswordReset,
  resetPassword,
  checkEmailAvailability
}; 