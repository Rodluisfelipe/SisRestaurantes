import { API_URL } from '../config';

/**
 * Da un código corto al error ("MB-K3X9QZ") y manda el detalle técnico al
 * servidor. El usuario solo ve el código; soporte lo busca en los logs.
 */
export function codigoDeError() {
  const t = Date.now().toString(36).slice(-4);
  const r = Math.random().toString(36).slice(2, 6);
  return `MB-${(t + r).toUpperCase()}`;
}

export function reportarError(error, extra = {}) {
  const codigo = codigoDeError();
  try {
    fetch(`${API_URL}/errores-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        codigo,
        mensaje: String(error?.message || error || ''),
        stack: String(error?.stack || ''),
        url: window.location.href,
        ...extra,
      }),
    }).catch(() => {});
  } catch { /* sin red: el código igual sirve para ubicar la hora */ }
  return codigo;
}
