import axios from "axios";

// Crear instancia de axios para el SuperAdmin
const superadminApi = axios.create({
  baseURL: (import.meta.env.PROD || import.meta.env.VITE_ENVIRONMENT === 'production') 
    ? "https://sisrestaurantes.onrender.com/api/superadmin"
    : "/api/superadmin",
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

// Funciones de autenticación
export const loginSuperAdmin = async (email, password) => {
  try {
    const response = await superadminApi.post('/auth/login', { email, password });
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

export const deleteBusiness = async (id) => {
  try {
    const response = await superadminApi.delete(`/business/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default superadminApi;