/**
 * Se ejecuta dentro de las páginas de MenuBy y le pasa al fondo dos cosas que
 * solo se pueden leer desde adentro: la sesión y de qué negocio es.
 *
 * Es lo que permite que la extensión avise de un pedido nuevo con MenuBy
 * cerrado. Sin esto tendría que pedir usuario y contraseña aparte —otra
 * credencial que cuidar y que se desincroniza al cambiarla.
 *
 * No manda la sesión a ningún lado: viaja al service worker de la propia
 * extensión, que la usa contra la misma API que ya usa el panel.
 */

function sesionActual() {
  try {
    // sessionStorage primero, igual que el panel: es la que manda por pestaña.
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    if (!token) return null;
    const partes = location.pathname.split('/').filter(Boolean);
    return { token, slug: partes[0] || null };
  } catch {
    return null;
  }
}

function avisar() {
  const sesion = sesionActual();
  if (!sesion) return;
  chrome.runtime.sendMessage({ tipo: 'sesion', ...sesion }).catch(() => {});
}

avisar();

/* El panel renueva el token mientras se trabaja, así que se vuelve a mirar de
   vez en cuando y al volver a la pestaña. Si no, la extensión se quedaría con
   uno viejo y dejaría de avisar sin decir por qué. */
setInterval(avisar, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') avisar();
});
