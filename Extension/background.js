/**
 * El service worker: los atajos de teclado y el vigilante de pedidos.
 *
 * En Manifest V3 esto no corre todo el tiempo — Chrome lo apaga a los pocos
 * segundos de inactividad y lo despierta por eventos. Por eso no hay ningún
 * `setInterval` acá: el reloj lo lleva `chrome.alarms`, que sí sobrevive al
 * apagado.
 */
import { ir, leerSlug, slugDeUrl, guardarSlug } from './comun.js';
import { revisar, programar, guardarSesion, NOMBRE_ALARMA } from './vigilante.js';

const POR_COMANDO = {
  'abrir-panel': 'panel',
  'abrir-whatsapp': 'whatsapp',
  'abrir-pos': 'pos',
};

/* ── Atajos de teclado (Alt+1, Alt+2, Alt+3) ──
   Funcionan en cualquier pestaña de Chrome. Una página web solo escucha el
   teclado mientras está al frente; esto, siempre. */
chrome.commands.onCommand.addListener(async (comando) => {
  const destino = POR_COMANDO[comando];
  if (!destino) return;

  let slug = await leerSlug();
  if (!slug) {
    const [activa] = await chrome.tabs.query({ active: true, currentWindow: true });
    slug = slugDeUrl(activa?.url) || '';
    if (slug) await guardarSlug(slug);
  }
  if (!slug) {
    await chrome.action.openPopup().catch(() => {});
    return;
  }
  await ir(destino, slug);
});

/* ── La sesión que manda la página ── */
chrome.runtime.onMessage.addListener((mensaje, remitente, responder) => {
  if (mensaje?.tipo !== 'sesion') return false;

  // Solo se acepta de una pestaña de MenuBy, nunca de otra página.
  const deConfianza = remitente?.origin?.endsWith('menuby.tech')
    || /^https:\/\/([a-z0-9-]+\.)?menuby\.tech\//.test(remitente?.url || '');
  if (!deConfianza) return false;

  (async () => {
    if (mensaje.slug) await guardarSlug(mensaje.slug);
    await guardarSesion(mensaje);
    await revisar();
    responder({ ok: true });
  })();
  return true; // la respuesta va en diferido
});

/* ── El reloj ── */
chrome.runtime.onInstalled.addListener(() => { programar(); revisar(); });
chrome.runtime.onStartup.addListener(() => { programar(); revisar(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === NOMBRE_ALARMA) revisar(); });

/* Tocar el aviso lleva a los pedidos, que es lo único que se quiere hacer
   cuando entra uno. */
chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const slug = await leerSlug();
  if (slug) await ir('panel', slug);
});
