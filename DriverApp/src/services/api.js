import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const TOKEN_KEY = 'domi_token';
const SLUG_KEY  = 'domi_slug';

export async function saveSession(token, slug) {
  await AsyncStorage.multiSet([[TOKEN_KEY, token], [SLUG_KEY, slug]]);
}

export async function getSession() {
  const [[, token], [, slug]] = await AsyncStorage.multiGet([TOKEN_KEY, SLUG_KEY]);
  return { token, slug };
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, SLUG_KEY]);
}

async function request(method, path, body) {
  const { token } = await getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error de red'), { status: res.status, data });
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
};

/* ── Auth ── */
export async function loginDomi(slug, code) {
  const data = await request('POST', `/restaurants/${slug}/domi/auth`, { code });
  await saveSession(data.token, slug);
  return data;
}

/* ── Orders ── */
export async function fetchOrders(slug) {
  return api.get(`/restaurants/${slug}/domi/orders`);
}

export async function markPicked(slug, orderId) {
  return api.post(`/restaurants/${slug}/domi/orders/${orderId}/picked`);
}

export async function confirmDelivery(slug, orderId, code) {
  return api.post(`/restaurants/${slug}/domi/orders/${orderId}/confirm`, { code });
}
