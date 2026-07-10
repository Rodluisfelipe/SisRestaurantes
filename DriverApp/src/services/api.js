import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const TOKEN_KEY   = 'domi_token';
const SLUG_KEY    = 'domi_slug';
const REFRESH_KEY = 'domi_refresh';

export async function saveSession(token, slug, refreshToken) {
  const pairs = [[TOKEN_KEY, token], [SLUG_KEY, slug]];
  if (refreshToken) pairs.push([REFRESH_KEY, refreshToken]);
  await AsyncStorage.multiSet(pairs);
}

export async function getSession() {
  const [[, token], [, slug], [, refreshToken]] = await AsyncStorage.multiGet([TOKEN_KEY, SLUG_KEY, REFRESH_KEY]);
  return { token, slug, refreshToken };
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, SLUG_KEY, REFRESH_KEY]);
}

/** Try to refresh the access token using the stored refresh token. Returns new token or null. */
async function tryRefresh() {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/delivery/domi/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await AsyncStorage.multiSet([[TOKEN_KEY, data.token], [REFRESH_KEY, data.refreshToken]]);
    return data.token;
  } catch {
    return null;
  }
}

async function request(method, path, body, _retried = false) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // On expired access token, refresh once and retry
  if (res.status === 401 && !_retried) {
    const fresh = await tryRefresh();
    if (fresh) return request(method, path, body, true);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error de red'), { status: res.status, data });
  return data;
}

export const api = {
  get:   (path)       => request('GET',   path),
  post:  (path, body) => request('POST',  path, body),
  patch: (path, body) => request('PATCH', path, body),
};

/* ── Auth ── */
// Legacy PIN login (needs slug)
export async function loginDomi(slug, code) {
  const data = await request('POST', `/restaurants/${slug}/domi/auth`, { code });
  await saveSession(data.token, slug, data.refreshToken);
  return data;
}

// Password login (phone + password, no slug needed)
export async function loginPassword(phone, password) {
  const res = await fetch(`${API_URL}/delivery/domi/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Error de acceso'), { status: res.status, data });
  await saveSession(data.token, data.slug, data.refreshToken);
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

/* ── Availability / presence (for auto-assignment) ── */
export async function setOnline(slug, online, lat, lng) {
  return api.post(`/restaurants/${slug}/domi/online`, { online, lat, lng });
}
export async function heartbeat(slug, lat, lng) {
  return api.post(`/restaurants/${slug}/domi/heartbeat`, { lat, lng });
}
