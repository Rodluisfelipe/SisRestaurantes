/**
 * Configuración centralizada de la aplicación
 *
 * Define:
 * - URL base de la API para producción y desarrollo
 * - Endpoints específicos para cada recurso
 *
 * Esta configuración se usa en toda la aplicación para tener
 * un único punto de control para las URLs de la API.
 */

// URL base de la API
const API_URL = 'https://sisrestaurantes.onrender.com/api';

// URLs específicas
export const API_ENDPOINTS = {
  BASE_URL: 'https://sisrestaurantes.onrender.com/api',
  EVENTS: 'https://sisrestaurantes.onrender.com/events',
  PRODUCTS: `${API_URL}/products`,
  CATEGORIES: `${API_URL}/categories`,
  TOPPING_GROUPS: `${API_URL}/topping-groups`,
  BUSINESS_CONFIG: `${API_URL}/business-config`,
  BUSINESS_SETTINGS: `${API_URL}/business-settings`,
};

export const CACHE_CONFIG = {
  DURATION: 15 * 60 * 1000, // 15 minutos
  ENABLED: true,
  EXCLUDED_ROUTES: ['/business-config'] // Rutas que no deben ser cacheadas
};