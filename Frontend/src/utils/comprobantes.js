import { BACKEND_URL } from '../config';

/**
 * Comprobantes de pago protegidos (/uploads/order-proofs, /uploads/proofs).
 *
 * Antes la imagen se pedía con el token de sesión en la dirección
 * (`?token=…`): quedaba en el historial del navegador y en los registros del
 * servidor. Ahora se descarga con la sesión en la cabecera, como cualquier
 * otra petición, y se muestra desde memoria.
 */

const cache = new Map(); // ruta -> Promise<objectURL>

const tokenDeSesion = () => sessionStorage.getItem('accessToken')
  || localStorage.getItem('accessToken')
  || localStorage.getItem('superadmin_token');

export function urlComprobante(ruta, token = tokenDeSesion()) {
  if (!ruta) return Promise.reject(new Error('Sin comprobante'));
  // Alojado fuera (Spaces, Cloudinary): se usa tal cual.
  if (/^https?:\/\//i.test(ruta)) return Promise.resolve(ruta);
  const clave = `${token || ''}|${ruta}`;
  if (!cache.has(clave)) {
    const p = fetch(`${BACKEND_URL}${ruta.startsWith('/') ? ruta : `/${ruta}`}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 403 ? 'Sin acceso a este comprobante' : 'No se pudo cargar el comprobante');
      return URL.createObjectURL(await res.blob());
    });
    // Un fallo no se queda guardado: el siguiente intento vuelve a pedirlo.
    p.catch(() => cache.delete(clave));
    cache.set(clave, p);
  }
  return cache.get(clave);
}

/** Abre el comprobante en una pestaña nueva, sin el token en la dirección. */
export async function abrirComprobante(ruta, token) {
  // La pestaña se abre ya (dentro del clic) para que el navegador no la bloquee.
  const ventana = window.open('', '_blank');
  try {
    const url = await urlComprobante(ruta, token);
    if (ventana) ventana.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    ventana?.close();
    alert(e.message);
  }
}
