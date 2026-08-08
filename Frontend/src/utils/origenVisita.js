/**
 * De qué enlace llegó el cliente al menú.
 *
 * El valor viene en `?source=` — por ejemplo `?source=whatsapp`,
 * `?source=instagram`, `?source=mesa04`. Sirve para saber qué enlace está
 * trayendo pedidos de verdad; `orderChannel` solo dice cómo se tomó el pedido,
 * no de dónde salió el cliente.
 *
 * Se guarda en la sesión porque entre que entra y confirma el pedido el cliente
 * navega por categorías y productos, y el parámetro se pierde de la URL. Muere
 * al cerrar la pestaña, que es lo que se quiere: la próxima visita puede venir
 * de otro lado.
 */
const CLAVE = 'menuby_origen';

/** Solo letras, números, punto y guion; corto. Llega de la URL. */
function limpiar(valor) {
  return String(valor || '').trim().slice(0, 40).replace(/[^\w.-]/g, '');
}

/**
 * Lee el parámetro de la URL y lo recuerda. Si no viene, devuelve el que ya
 * estuviera guardado en esta visita.
 */
export function registrarOrigen(search) {
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    const bruto = params.get('source') || params.get('utm_source');
    const limpio = limpiar(bruto);

    if (limpio) {
      sessionStorage.setItem(CLAVE, limpio);
      return limpio;
    }
    return sessionStorage.getItem(CLAVE) || null;
  } catch {
    // Navegación privada puede bloquear sessionStorage; no vale romper el menú.
    return null;
  }
}

/** El origen de esta visita, si se conoce. */
export function origenActual() {
  try {
    return sessionStorage.getItem(CLAVE) || null;
  } catch {
    return null;
  }
}

export default { registrarOrigen, origenActual };
