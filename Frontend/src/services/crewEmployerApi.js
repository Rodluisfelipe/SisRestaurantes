/**
 * crewEmployerApi — cliente HTTP para empleadores Crew externos a MenuBy.
 *
 * Token guardado en `crew_employer_token`. Es independiente de `crew_token`
 * (worker) y `accessToken` (admin MenuBy) para que un mismo navegador pueda
 * tener varias identidades sin colisionar.
 */
import axios from 'axios';
import { BACKEND_URL } from '../config';

const crewEmployerApi = axios.create({
  baseURL: `${BACKEND_URL}/api/crew`,
  headers: { 'Content-Type': 'application/json' },
});

export const EMPLOYER_TOKEN_KEY = 'crew_employer_token';
export const EMPLOYER_PROFILE_KEY = 'crew_employer_profile';

crewEmployerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(EMPLOYER_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el token caducó o la cuenta fue bloqueada, vaciamos para forzar re-login.
crewEmployerApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(EMPLOYER_TOKEN_KEY);
      localStorage.removeItem(EMPLOYER_PROFILE_KEY);
    }
    return Promise.reject(err);
  },
);

export function setEmployerSession({ token, employer }) {
  if (token) localStorage.setItem(EMPLOYER_TOKEN_KEY, token);
  if (employer) localStorage.setItem(EMPLOYER_PROFILE_KEY, JSON.stringify(employer));
}

export function clearEmployerSession() {
  localStorage.removeItem(EMPLOYER_TOKEN_KEY);
  localStorage.removeItem(EMPLOYER_PROFILE_KEY);
}

export function getCachedEmployer() {
  try {
    const raw = localStorage.getItem(EMPLOYER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default crewEmployerApi;
