import axios from 'axios';
import { API_ENDPOINTS, CACHE_CONFIG } from '../config';
import { io } from 'socket.io-client';

/**
 * Servicio centralizado para comunicación con el backend
 *
 * Este servicio:
 * - Configura Axios con la URL base correcta
 * - Intercepta llamadas para manejar errores
 * - Redirige llamadas erróneas a localhost hacia la URL de producción
 * - Proporciona una interfaz unificada para todas las peticiones al backend
 */

// Crear una instancia de axios con configuración básica
const api = axios.create({
  baseURL: 'https://sisrestaurantes.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Agregar timeout
  timeout: 5000,
  // Incluir credenciales en solicitudes cross-origin
  withCredentials: true
});

// Implementar un cache simple usando Map
const cache = new Map();

// Interceptor para las peticiones
api.interceptors.request.use(
  (config) => {
    // Asegurarse de que la URL base esté correcta
    if (!config.url.startsWith('/')) {
      config.url = '/' + config.url;
    }
    // Adjuntar access token si existe
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Error en la petición:', error);
    return Promise.reject(error);
  }
);

// Interceptor para las respuestas
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => {
    // Las respuestas exitosas (2xx) pasan por aquí
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Esperar a que el token se refresque
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await api.post('/auth/refresh', { refreshToken });
        const newToken = res.data.token;
        localStorage.setItem('accessToken', newToken);
        api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
        onRefreshed(newToken);
        return api(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, NO hacer logout forzado
        // Solo registramos el error, pero no cerramos sesión
        console.error('Error al refrescar el token:', refreshError);
        // Ya no hacemos logout automático ni borramos tokens
        /*
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        */
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Función para limpiar el cache
export const clearCache = () => cache.clear();

// Función para invalidar una entrada específica del cache
export const invalidateCache = (url, params = {}) => {
  const cacheKey = `${url}${JSON.stringify(params)}`;
  cache.delete(cacheKey);
};

// Instancia global de socket.io-client
export const socket = io('https://sisrestaurantes.onrender.com', {
  autoConnect: false, // Se conecta manualmente cuando se necesite
  transports: ['websocket'],
});

// Obtener negocio por slug
export async function getBusinessBySlug(slug) {
  if (!slug) {
    console.error('getBusinessBySlug - No se proporcionó un slug');
    return null;
  }
  
  try {
    console.log('getBusinessBySlug - Intentando obtener negocio con slug:', slug);
    const response = await api.get(`/business-config/by-slug/${slug}`);
    console.log('getBusinessBySlug - Respuesta:', response.data);
    return response.data;
  } catch (error) {
    console.error('getBusinessBySlug - Error al obtener negocio con slug:', slug, error);
    
    // Si el error es 404, intentamos obtener por ID directamente
    if (error.response && error.response.status === 404) {
      try {
        console.log('getBusinessBySlug - Intentando obtener como ID directo:', slug);
        const directResponse = await api.get(`/business-config?businessId=${slug}`);
        console.log('getBusinessBySlug - Respuesta directa:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('getBusinessBySlug - Error al obtener como ID directo:', directError);
        return null;
      }
    }
    
    return null;
  }
}

export default api; 