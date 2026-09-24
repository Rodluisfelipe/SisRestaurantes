/**
 * La llave de "Mi cuenta" en este celular (ver Backend/utils/cuentaCliente).
 *
 * La entrega el servidor al crear un pedido o al seguirlo, y con ella el
 * celular ve y edita la cuenta de ese cliente: sus datos, pedidos, favoritos
 * y puntos. Se guarda una por negocio.
 *
 * `services/api.js` la adjunta sola a cada petición del menú abierto y guarda
 * la que llegue en una respuesta: ninguna pantalla tiene que acordarse.
 */

const clave = (businessId) => `mb_cuenta:${businessId}`;

/* El negocio del menú abierto. Solo el menú lo fija: el panel nunca manda llave. */
let negocioActual = null;

export function usarCuentaDe(businessId) {
  negocioActual = businessId ? String(businessId) : null;
}

export function negocioDeLaCuenta() {
  return negocioActual;
}

export function llaveDe(businessId = negocioActual) {
  if (!businessId) return null;
  try { return localStorage.getItem(clave(businessId)); } catch { return null; }
}

export function guardarLlave(llave, businessId = negocioActual) {
  if (!businessId || !llave) return;
  try { localStorage.setItem(clave(businessId), llave); } catch { /* sin almacenamiento */ }
  try { window.dispatchEvent(new CustomEvent('mb:cuenta', { detail: { businessId } })); } catch { /* nada */ }
}

export function olvidarLlave(businessId = negocioActual) {
  if (!businessId) return;
  try { localStorage.removeItem(clave(businessId)); } catch { /* nada */ }
  try { window.dispatchEvent(new CustomEvent('mb:cuenta', { detail: { businessId } })); } catch { /* nada */ }
}

export function tieneCuenta(businessId = negocioActual) {
  return !!llaveDe(businessId);
}

/** ¿El servidor dijo que esta petición necesitaba la cuenta y no la había? */
export function esSinCuenta(error) {
  return error?.response?.status === 401 && error?.response?.data?.codigo === 'SIN_CUENTA';
}
