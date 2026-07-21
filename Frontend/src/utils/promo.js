// Helpers de "Producto del día / Promo" con cuenta regresiva.
// La promo está activa si: promo.active, tiene precio válido, y no ha expirado
// (endsAt en el futuro, o sin endsAt = sin límite de tiempo).

export function isPromoActive(product) {
  const p = product?.promo;
  if (!p || !p.active) return false;
  if (p.price === null || p.price === undefined || Number(p.price) < 0) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() <= Date.now()) return false;
  return true;
}

// Precio a cobrar: el promocional si la promo está activa; si no, el normal.
export function getEffectivePrice(product) {
  return isPromoActive(product) ? Number(product.promo.price) : Number(product?.price || 0);
}

// Milisegundos restantes de la promo (o null si no tiene fecha de fin).
export function promoMsLeft(product) {
  const end = product?.promo?.endsAt;
  if (!end) return null;
  return Math.max(0, new Date(end).getTime() - Date.now());
}

// Formatea ms → "HH:MM:SS" (o "MM:SS" si falta menos de 1h).
export function formatCountdown(ms) {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
