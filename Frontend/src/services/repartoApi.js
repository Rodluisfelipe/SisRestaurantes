import axios from 'axios';
import { API_URL } from '../config';

/**
 * Cliente de /api/reparto: la página de las empresas de reparto, sus clientes
 * y el seguimiento público. La sesión de cada cliente se guarda por empresa:
 * alguien puede ser cliente de dos empresas distintas en el mismo navegador.
 */
const clave = (slug) => `reparto_sesion_${slug}`;

export function sesionReparto(slug) {
  try { return JSON.parse(localStorage.getItem(clave(slug)) || 'null'); } catch { return null; }
}

export function guardarSesionReparto(slug, datos) {
  try {
    if (datos) localStorage.setItem(clave(slug), JSON.stringify(datos));
    else localStorage.removeItem(clave(slug));
  } catch { /* navegador sin almacenamiento: la sesión dura lo que la pestaña */ }
}

export function repartoApi(slug) {
  const api = axios.create({ baseURL: `${API_URL}/reparto`, timeout: 20000 });
  api.interceptors.request.use((c) => {
    const s = slug ? sesionReparto(slug) : null;
    if (s?.token) c.headers.Authorization = `Bearer ${s.token}`;
    return c;
  });
  return api;
}

export const placesApi = axios.create({ baseURL: `${API_URL}/places`, timeout: 10000 });

export const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
