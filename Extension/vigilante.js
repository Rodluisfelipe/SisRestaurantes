/**
 * Lo que la web no puede hacer: avisar de un pedido nuevo con MenuBy cerrado.
 *
 * Una página solo corre mientras su pestaña existe. Si el negocio cierra el
 * panel —o Chrome entero— nadie mira si entró un pedido. Este vigilante vive
 * en el service worker de la extensión, despierta cada minuto y avisa.
 *
 * La sesión la trae `contenido.js` desde la propia página, así que sirve
 * mientras el token siga vivo: 24 horas desde la última vez que abrieron
 * MenuBy. Un restaurante lo abre a diario, así que en la práctica está siempre.
 */

const API = 'https://api.menuby.tech/api';
const ALARMA = 'revisar';

/* ── Sesión ── */

export async function guardarSesion({ token, slug }) {
  const anterior = await chrome.storage.local.get(['token']);
  const datos = { token };
  if (slug) datos.slug = slug;

  /* Token nuevo: puede ser otro negocio (cambiaron de cuenta). Se borra lo
     contado antes para no avisar de pedidos que no son. */
  if (anterior.token && anterior.token !== token) {
    // `null` significa "empezar de cero sin avisar", no "no había ninguno".
    datos.vistos = null;
    datos.sinComplemento = false;
  }
  await chrome.storage.local.set(datos);
}

/** El businessId viene dentro del propio token; no hace falta preguntarlo. */
function negocioDelToken(token) {
  try {
    const cuerpo = token.split('.')[1];
    const json = atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).businessId || null;
  } catch {
    return null;
  }
}

function vencido(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return exp ? Date.now() >= exp * 1000 : false;
  } catch {
    return true;
  }
}

/* ── La revisión de cada minuto ── */

async function pedir(ruta, token) {
  const res = await fetch(API + ruta, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export async function revisar() {
  const g = await chrome.storage.local.get(['token', 'slug', 'vistos', 'sinComplemento']);
  const token = g.token;

  if (!token || vencido(token)) {
    // Sin sesión no se inventa nada: se apaga el contador y se espera.
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  const negocio = negocioDelToken(token);
  if (!negocio) return;

  let pendientes = [];
  try {
    const datos = await pedir(`/orders?businessId=${negocio}&status=pending`, token);
    pendientes = Array.isArray(datos) ? datos : [];
  } catch (e) {
    /* 401 = la sesión caducó. Se borra para no seguir golpeando la API con un
       token muerto; vuelve sola en cuanto abran MenuBy. */
    if (e.status === 401) await chrome.storage.local.remove('token');
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  let sinLeer = 0;
  if (!g.sinComplemento) {
    try {
      const datos = await pedir(`/whatsapp-inbox/sin-leer?businessId=${negocio}`, token);
      sinLeer = datos?.sinLeer || 0;
    } catch (e) {
      // 402 = no tiene la bandeja contratada. Se deja de preguntar, para siempre.
      if (e.status === 402) await chrome.storage.local.set({ sinComplemento: true });
    }
  }

  await pintarContador(pendientes.length, sinLeer);
  // Guardados para que el popup los muestre sin tener que volver a preguntar.
  await chrome.storage.local.set({ pendientes: pendientes.length, sinLeer });
  await avisarDeLosNuevos(pendientes, g.vistos);
}

/* El contador rojo del ícono: los pedidos mandan sobre los chats, porque un
   pedido sin atender se enfría y un mensaje espera. */
async function pintarContador(pendientes, sinLeer) {
  const n = pendientes || sinLeer;
  await chrome.action.setBadgeText({ text: n ? String(Math.min(n, 99)) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: pendientes ? '#ef4444' : '#10b981' });
}

/**
 * Avisar solo de lo que no se había visto.
 *
 * Se comparan identificadores y no cantidades: con un contador, un pedido que
 * entra y otro que se despacha en el mismo minuto se anulan, y el nuevo pasa
 * en silencio.
 */
async function avisarDeLosNuevos(pendientes, vistos) {
  /* La primera revisión no avisa de nada. Sin esto, quien instala la extensión
     con cinco pedidos en cola recibe cinco avisos de golpe por pedidos que ya
     conocía — y el primer contacto con la herramienta es un regaño. */
  if (!Array.isArray(vistos)) {
    await chrome.storage.local.set({ vistos: pendientes.map((p) => p._id) });
    return;
  }

  const conocidos = new Set(vistos);
  const nuevos = pendientes.filter((p) => !conocidos.has(p._id));

  for (const pedido of nuevos.slice(0, 3)) {
    chrome.notifications.create(`pedido-${pedido._id}`, {
      type: 'basic',
      iconUrl: 'iconos/favicon-192x192.png',
      title: `Pedido nuevo #${pedido.orderNumber || ''}`.trim(),
      message: [pedido.customerName, moneda(pedido.finalAmount ?? pedido.totalAmount)]
        .filter(Boolean).join(' · ') || 'Toca para abrirlo',
      priority: 2,
      requireInteraction: true,   // se queda hasta que alguien la mire
    });
  }
  if (nuevos.length > 3) {
    chrome.notifications.create('pedidos-varios', {
      type: 'basic',
      iconUrl: 'iconos/favicon-192x192.png',
      title: `${nuevos.length} pedidos nuevos`,
      message: 'Toca para abrir el panel de pedidos.',
      priority: 2,
      requireInteraction: true,
    });
  }

  // Solo se recuerdan los que siguen pendientes: la lista no crece sin fin.
  await chrome.storage.local.set({ vistos: pendientes.map((p) => p._id) });
}

function moneda(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? '$' + Math.round(v).toLocaleString('es-CO') : '';
}

/* ── El reloj ── */

export function programar() {
  // Un minuto es el mínimo que permite Chrome para una alarma periódica.
  chrome.alarms.create(ALARMA, { periodInMinutes: 1 });
}

export const NOMBRE_ALARMA = ALARMA;
