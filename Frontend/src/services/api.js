import axios from 'axios';
import { API_ENDPOINTS, CACHE_CONFIG } from '../config';
import { llaveDe, guardarLlave, negocioDeLaCuenta, telefonoGuardado } from '../utils/cuentaCliente';

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
  baseURL: API_ENDPOINTS.BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  /* 5 s cortaba peticiones buenas en el wifi de un local o con datos: el
     pedido o el producto se guardaba en el servidor pero la pantalla decía
     error, y al reintentar quedaba duplicado. */
  timeout: 20000,
  // Incluir credenciales en solicitudes cross-origin
  withCredentials: true
});

// Interceptor para las peticiones
api.interceptors.request.use(
  (config) => {
    // Asegurarse de que la URL base esté correcta
    if (!config.url.startsWith('/')) {
      config.url = '/' + config.url;
    }
    // Adjuntar access token si existe (pero NO sobreescribir si ya fue puesto explícitamente)
    const hasExplicitAuth = config.headers?.Authorization || config.headers?.authorization;
    if (!hasExplicitAuth) {
      // Prefer sessionStorage (per-tab) over localStorage (shared) to avoid cross-tab conflicts
      const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    // La llave de "Mi cuenta" del menú abierto (ver utils/cuentaCliente).
    const llave = llaveDe();
    if (llave && !config.headers['X-Cuenta']) config.headers['X-Cuenta'] = llave;
    // Y el teléfono del cliente: con él se abre la cuenta mientras no se exija la llave
    const negocio = negocioDeLaCuenta();
    const telefono = negocio ? telefonoGuardado() : '';
    if (telefono && !config.headers['X-Cuenta-Telefono']) {
      config.headers['X-Cuenta-Negocio'] = negocio;
      config.headers['X-Cuenta-Telefono'] = telefono;
    }
    return config;
  },
  (error) => {
    console.error('Error en la petición:', error);
    return Promise.reject(error);
  }
);

/**
 * Instancia SIN interceptores, exclusiva para renovar el token.
 *
 * Es la pieza que evita un bloqueo mortal: si el refresh se pide con `api`,
 * y el servidor responde 401 (que es justo lo que pasa cuando otra sesion
 * invalidó este refresh token), el interceptor se intercepta a si mismo, ve
 * que ya hay un refresh en curso —el suyo— y se encola a esperarse. La
 * promesa nunca se resuelve, `isRefreshing` se queda en true para siempre y
 * a partir de ahi TODA peticion del panel queda colgada cargando.
 */
export const refreshClient = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  withCredentials: true,
});

/**
 * Guarda lo que devolvió /auth/refresh donde vive esta sesión. Si el servidor
 * mandó un refresh token nuevo (la sesión se extiende con el uso), también.
 * localStorage solo se toca si es de ESTA misma sesión: puede ser de otra
 * cuenta abierta en otra pestaña.
 */
export function guardarRenovacion(usado, data) {
  sessionStorage.setItem('accessToken', data.token);
  if (sessionStorage.getItem('refreshToken') === usado && data.refreshToken) {
    sessionStorage.setItem('refreshToken', data.refreshToken);
  }
  if (localStorage.getItem('refreshToken') === usado) {
    localStorage.setItem('accessToken', data.token);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  }
}

/* ¿El servidor dijo que la sesión ya no vale? Solo eso cierra la sesión. Un
   corte de red, un tiempo agotado, un 429 o un 5xx NO: antes cualquiera de
   esos sacaba al usuario del panel en pleno servicio. */
export const sesionRechazada = (err) => [401, 403].includes(err?.response?.status);

// Interceptor para las respuestas
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(null, token));
  refreshSubscribers = [];
}

function onRefreshFailed(err) {
  refreshSubscribers.forEach((cb) => cb(err, null));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => {
    // El servidor entrega la llave de "Mi cuenta" al crear o seguir un pedido.
    if (response?.data?.cuentaToken) guardarLlave(response.data.cuentaToken);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    /* No se intenta refrescar en login ni en el propio refresh. Lo segundo es
       imprescindible: reintentar el refresh dentro del interceptor del refresh
       es la espera circular que dejaba el panel cargando indefinidamente. */
    const esRutaDeAuth = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/refresh');

    /* "Sin cuenta" es del cliente del menú, no de la sesión del panel: no se
       intenta renovar nada aunque haya una sesión del panel abierta. */
    const esSinCuenta = error.response?.data?.codigo === 'SIN_CUENTA';

    if (error.response && error.response.status === 401 && !originalRequest._retry && !esSinCuenta &&
        !esRutaDeAuth &&
        (sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken'))) {
      if (isRefreshing) {
        // Esperar a que el token se refresque
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((err, token) => {
            if (err) return reject(err);
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // Con `refreshClient` (sin interceptores): un 401 acá cae limpio al
        // catch de abajo en vez de encolarse esperándose a sí mismo.
        const res = await refreshClient.post('/auth/refresh', { refreshToken });
        const newToken = res.data.token;
        guardarRenovacion(refreshToken, res.data);

        api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
        onRefreshed(newToken);
        originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
        return api(originalRequest);
      } catch (refreshError) {
        onRefreshFailed(refreshError);
        // Sin red o servidor ocupado: la sesión sigue; la petición falla y se
        // puede reintentar. Solo un rechazo real del servidor manda al login.
        if (!sesionRechazada(refreshError)) return Promise.reject(error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Funciones para obtener datos del backend

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