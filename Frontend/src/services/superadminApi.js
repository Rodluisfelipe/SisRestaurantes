import axios from "axios";
import { BACKEND_URL } from '../config';

// Crear instancia de axios para el SuperAdmin
const superadminApi = axios.create({
  baseURL: `${BACKEND_URL}/api/superadmin`,
  headers: {
    "Content-Type": "application/json",
  },
  // Incluir credenciales en solicitudes cross-origin
  withCredentials: true
});

// Agregar interceptor para añadir el token a cada solicitud
superadminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("superadmin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for automatic logout on 401
const handle401 = (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_refreshToken');
    // Redirect to superadmin login if we're on a superadmin page
    if (window.location.pathname.startsWith('/superadmin')) {
      window.location.href = '/superadmin';
    }
  }
  return Promise.reject(error);
};

superadminApi.interceptors.response.use(
  (response) => response,
  handle401
);

// Funciones de autenticación
export const loginSuperAdmin = async (email, password) => {
  try {
    const response = await superadminApi.post('/auth/login', { email, password });
    return response;
  } catch (error) {
    throw error;
  }
};

export const googleLoginSuperAdmin = async (credential) => {
  try {
    const response = await superadminApi.post('/auth/google', { credential });
    return response;
  } catch (error) {
    throw error;
  }
};

export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await superadminApi.post('/auth/change-password', { 
      oldPassword, 
      newPassword 
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const forgotPassword = async (email) => {
  try {
    const response = await superadminApi.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (token, newPassword) => {
  try {
    const response = await superadminApi.post('/auth/reset-password', { 
      token, 
      newPassword 
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Funciones para gestión de negocios
export const fetchBusinesses = async () => {
  try {
    const response = await superadminApi.get('/business');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createBusiness = async (businessData) => {
  try {
    const response = await superadminApi.post('/business', businessData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const activateBusiness = async (id, isActive) => {
  try {
    const response = await superadminApi.patch(`/business/${id}/activate`, { isActive });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const togglePosBeta = async (id, enabled) => {
  try {
    const response = await superadminApi.patch(`/business/${id}/pos-beta`, { enabled });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const toggleSupplier = async (id, enabled) => {
  try {
    const response = await superadminApi.patch(`/business/${id}/supplier`, { enabled });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteBusiness = async (id) => {
  try {
    const response = await superadminApi.delete(`/business/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Crear instancia separada para suscripciones
const subscriptionApi = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true
});

// Agregar interceptor para añadir el token a cada solicitud
subscriptionApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("superadmin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for 401 handling
subscriptionApi.interceptors.response.use(
  (response) => response,
  handle401
);

export { subscriptionApi };
export default superadminApi;