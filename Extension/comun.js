/**
 * Lo que comparten el popup y el service worker: a dónde va cada destino y
 * cómo llegar sin romper lo que ya está abierto.
 */

export const ORIGEN = 'https://www.menuby.tech';

/* Cada una tiene su propia dirección, así que cada una tiene su pestaña. Es lo
   que la web sola no puede hacer: reutilizar una pestaña pierde lo que hubiera
   dentro —el pedido a medio armar del POS, el mensaje a medio escribir. */
export const DESTINOS = {
  panel: { txt: 'Panel', ruta: (slug) => `/${slug}/admin` },
  whatsapp: { txt: 'WhatsApp', ruta: (slug) => `/${slug}/whatsapp` },
  pos: { txt: 'POS', ruta: (slug) => `/${slug}/pos` },
};

/** El negocio guardado. Se pide una vez y queda. */
export async function leerSlug() {
  const { slug } = await chrome.storage.sync.get('slug');
  return slug || '';
}

export async function guardarSlug(slug) {
  await chrome.storage.sync.set({ slug: String(slug || '').trim().toLowerCase() });
}

/**
 * El slug sale de la dirección: menuby.tech/doggitos/admin -> doggitos.
 * Devuelve null si esa pestaña no es de un negocio.
 */
export function slugDeUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('menuby.tech')) return null;
    const partes = u.pathname.split('/').filter(Boolean);
    if (!partes.length) return null;
    // Rutas de la plataforma, no de un negocio.
    const reservadas = ['blog', 'landing', 'customers', 'crew', 'superadmin', 'login', 'privacidad', 'terminos'];
    if (reservadas.includes(partes[0])) return null;
    return partes[0];
  } catch {
    return null;
  }
}

/** ¿Esta pestaña abierta es la pantalla que buscamos? */
function esDestino(url, destinoId, slug) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('menuby.tech')) return false;
    const base = DESTINOS[destinoId].ruta(slug);
    /* Con `startsWith`, el panel reconoce sus subrutas: quien está en una
       sección del panel ya está "en el panel", y no hay que recargárselo. */
    return u.pathname === base || u.pathname.startsWith(`${base}/`);
  } catch {
    return false;
  }
}

/**
 * Ir a un destino.
 *
 * Este es el motivo de que esto sea una extensión y no un enlace: si la
 * pantalla ya está abierta en otra pestaña, la trae al frente sin tocarla.
 * El POS conserva su pedido a medio armar y los chats su borrador.
 */
export async function ir(destinoId, slug) {
  const destino = DESTINOS[destinoId];
  if (!destino || !slug) return;

  const pestañas = await chrome.tabs.query({ url: ['https://menuby.tech/*', 'https://www.menuby.tech/*'] });
  const abierta = pestañas.find((p) => esDestino(p.url, destinoId, slug));

  if (abierta) {
    await chrome.tabs.update(abierta.id, { active: true });
    await chrome.windows.update(abierta.windowId, { focused: true });
    return;
  }

  await chrome.tabs.create({ url: ORIGEN + destino.ruta(slug), active: true });
}
