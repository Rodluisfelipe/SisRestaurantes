import axios from 'axios';
import { API_URL } from '../config';

// Sobrescribir la configuración global de axios
axios.defaults.baseURL = API_URL;

// Crear una nueva instancia de axios con la configuración correcta
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Mejorar el interceptor para manejar mejor las URLs
api.interceptors.request.use(request => {
  // Verificar si la URL ya incluye la base URL
  if (request.url && !request.url.startsWith('http')) {
    // Si la URL comienza con una barra, quitarla para evitar doble barra
    if (request.url.startsWith('/')) {
      request.url = request.url.substring(1);
    }
  }
  console.log('API Request:', request.method?.toUpperCase(), request.baseURL + request.url);
  return request;
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    // Mejorar el log para depuración
    if (error.config) {
      console.error('Error en URL:', error.config.baseURL + error.config.url);
    }
    return Promise.reject(error);
  }
);

// Interceptar y redirigir llamadas directas a localhost
const originalGet = axios.get;
axios.get = function(url, config) {
  if (url && typeof url === 'string') {
    // Limpiar cualquier URL a localhost
    if (url.includes('localhost:5000')) {
      console.warn('Interceptada llamada directa a localhost:', url);
      url = url.replace(/https?:\/\/localhost:5000\/api\/?/, '');
      return api.get(url, config);
    }
  }
  return originalGet(url, config);
};

// Hacer lo mismo con otros métodos HTTP
const originalPost = axios.post;
axios.post = function(url, data, config) {
  if (url && typeof url === 'string' && url.includes('localhost:5000')) {
    console.warn('Interceptada llamada POST a localhost:', url);
    url = url.replace(/https?:\/\/localhost:5000\/api\/?/, '');
    return api.post(url, data, config);
  }
  return originalPost(url, data, config);
};

const originalPut = axios.put;
axios.put = function(url, data, config) {
  if (url && typeof url === 'string' && url.includes('localhost:5000')) {
    console.warn('Interceptada llamada PUT a localhost:', url);
    url = url.replace(/https?:\/\/localhost:5000\/api\/?/, '');
    return api.put(url, data, config);
  }
  return originalPut(url, data, config);
};

const originalDelete = axios.delete;
axios.delete = function(url, config) {
  if (url && typeof url === 'string' && url.includes('localhost:5000')) {
    console.warn('Interceptada llamada DELETE a localhost:', url);
    url = url.replace(/https?:\/\/localhost:5000\/api\/?/, '');
    return api.delete(url, config);
  }
  return originalDelete(url, config);
};

export default api; 