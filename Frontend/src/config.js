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

// Función para obtener la URL de la API
const getApiUrl = () => {
  // Priorizar variables de entorno
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl) {
    return `${envApiUrl}/api`;
  }
  
  // Usar HTTPS en producción para evitar Mixed Content
  if (isProd) {
    return 'https://157-245-125-216.nip.io/api'; // Digital Ocean backend - HTTPS
  }
  
  // Desarrollo local
  return 'http://localhost:5000/api';
};

export const API_URL = getApiUrl();

// URLs específicas
export const API_ENDPOINTS = {
  BASE_URL: API_URL,
  EVENTS: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/events` : (isProd ? 'https://157-245-125-216.nip.io/events' : 'http://localhost:5000/events'),
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