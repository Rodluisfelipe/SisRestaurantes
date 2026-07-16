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

// Retry ONLY on network failures (fetch throws before a response). Safe for
// POSTs: if fetch never got a response, the server never processed the request.
async function fetchWithRetry(url, opts, tries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, opts);
    } catch (netErr) {
      if (attempt >= tries - 1) throw Object.assign(new Error('Sin conexión. Revisa tu internet.'), { network: true });
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

async function request(method, path, body, _retried = false) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetchWithRetry(`${API_URL}${path}`, {
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
  get:    (path)       => request('GET',    path),
  post:   (path, body) => request('POST',   path, body),
  patch:  (path, body) => request('PATCH',  path, body),
  delete: (path)       => request('DELETE', path),
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

// Phone + PIN login (no slug, no password) — the simplest method for drivers
export async function loginPhonePin(phone, code) {
  const res = await fetch(`${API_URL}/delivery/domi/login-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
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

/* ── Offers (Phase C) ── */
export async function fetchOffers(slug) {
  return api.get(`/restaurants/${slug}/domi/offers`);
}
export async function acceptOffer(slug, offerId) {
  return api.post(`/restaurants/${slug}/domi/offers/${offerId}/accept`);
}
export async function rejectOffer(slug, offerId) {
  return api.post(`/restaurants/${slug}/domi/offers/${offerId}/reject`);
}

/* ── Availability / presence (for auto-assignment) ── */
export async function setOnline(slug, online, lat, lng) {
  return api.post(`/restaurants/${slug}/domi/online`, { online, lat, lng });
}
export async function heartbeat(slug, lat, lng) {
  return api.post(`/restaurants/${slug}/domi/heartbeat`, { lat, lng });
}

/* ── Native push token registration (FCM) ── */
export async function registerPushToken(slug, fcmToken) {
  return api.post(`/restaurants/${slug}/domi/push-token`, { fcmToken });
}
export async function clearPushToken(slug) {
  try { return await api.delete(`/restaurants/${slug}/domi/push-token`); }
  catch { return null; }
}
