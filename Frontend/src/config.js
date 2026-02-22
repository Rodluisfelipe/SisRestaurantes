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
const isProd = import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production';

// Production backend base URL (without /api) — single source of truth
const PROD_BACKEND_URL = 'https://157-245-125-216.nip.io';

// Función para obtener la URL base del backend (sin /api)
const getBackendUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) return envApiUrl;
  if (isProd) return PROD_BACKEND_URL;
  return 'http://localhost:5000';
};

export const BACKEND_URL = getBackendUrl();

// Función para obtener la URL de la API
const getApiUrl = () => {
  return `${BACKEND_URL}/api`;
};

export const API_URL = getApiUrl();

// URLs específicas
export const API_ENDPOINTS = {
  BASE_URL: API_URL,
  EVENTS: `${BACKEND_URL}/events`,
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