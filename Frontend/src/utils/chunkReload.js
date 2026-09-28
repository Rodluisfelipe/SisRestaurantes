// Recuperación cuando una pantalla no puede bajar su archivo JS/CSS
// ("Failed to fetch dynamically imported module: .../assets/<hash>.js").
//
// Tres causas reales, las tres cubiertas acá:
//   1. Deploy: el HTML apunta a un archivo que ya no existe → recargar trae el
//      HTML nuevo.
//   2. Conexión que se cae un segundo (wifi del local, datos) → reintentar.
//   3. Caché del navegador ENVENENADA: los /assets se guardan "immutable" por un
//      año; si alguna vez llegó una respuesta rota (un corte a mitad, un HTML en
//      vez del JS), el navegador la sigue usando para siempre y recargar NO la
//      reemplaza. Por eso en incógnito funcionaba y en la ventana normal no.
//      `repararCache` vuelve a bajar el archivo y todo lo que importa con
//      `cache: 'reload'`, que salta la caché y la sobrescribe con lo bueno.
//
// Se usa desde:
//   - lazyConReintento: cada pantalla lazy reintenta sola antes de fallar.
//   - main.jsx: listeners globales (imports sueltos que nadie atrapa).
//   - ErrorBoundary / AdminSectionErrorBoundary: última línea de defensa.

import { lazy } from 'react';

const RELOAD_FLAG = '__crew_chunk_reload_attempted';
const MAX_INTENTOS = 3;
const ESPERAS_MS = [0, 2000, 5000];
const VENTANA_MS = 60 * 1000; // pasado un minuto sin fallos, se empieza de cero
const MAX_ARCHIVOS = 300;
const TIMEOUT_ARCHIVO_MS = 15000;

const leerIntentos = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(RELOAD_FLAG) || 'null');
    if (!d || typeof d.n !== 'number' || Date.now() - d.t > VENTANA_MS) return 0;
    return d.n;
  } catch {
    return 0;
  }
};

// ¿Es un error de carga de chunk / módulo dinámico?
export const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Failed to load module script') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    err?.name === 'ChunkLoadError'
  );
};

// ¿Ya se agotaron los reintentos? (evita loops si el problema es real)
export const chunkReloadAlreadyAttempted = () => leerIntentos() >= MAX_INTENTOS;

// Para el botón "Reintentar" de la pantalla sin conexión.
export const resetChunkReload = () => {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* sin sessionStorage */ }
};

/* ── Reparar la caché HTTP del navegador ─────────────────────────────── */

const urlsDelTexto = (texto, base) => {
  const out = new Set();
  // Imports entre chunks ("./x.js") y la lista de dependencias de Vite ("assets/x.js").
  const re = /["'`](\.\/[\w.-]+\.(?:js|css)|\/?assets\/[\w.-]+\.(?:js|css))["'`]/g;
  let m;
  while ((m = re.exec(texto))) {
    try {
      const p = m[1];
      out.add(new URL(p.startsWith('assets/') ? `/${p}` : p, base).href);
    } catch { /* URL rara: se ignora */ }
  }
  return out;
};

const bajarFresco = async (url) => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_ARCHIVO_MS) : null;
  try {
    // cache:'reload' ignora lo guardado y lo reemplaza con la respuesta nueva.
    const res = await fetch(url, { cache: 'reload', credentials: 'same-origin', signal: ctrl?.signal });
    const tipo = res.headers.get('content-type') || '';
    const texto = res.ok && /javascript/.test(tipo) ? await res.text() : '';
    return { ok: res.ok && !/text\/html/.test(tipo), texto };
  } catch {
    return { ok: false, texto: '' };
  } finally {
    if (t) clearTimeout(t);
  }
};

export const urlDelError = (err) => {
  const m = String(err?.message || err || '').match(/https?:\/\/[^\s'"]+\.(?:js|css)/);
  return m ? m[0] : '';
};

let reparando = null;

/**
 * Vuelve a bajar, saltando la caché, el archivo que falló y todo lo que
 * importa (y el bundle de entrada). Devuelve true si todo bajó bien.
 * Una sola reparación a la vez aunque fallen varias pantallas juntas.
 */
export const repararCache = (urlFallida) => {
  if (reparando) return reparando;
  reparando = (async () => {
    const pendientes = [];
    if (urlFallida) pendientes.push(urlFallida);
    document.querySelectorAll('script[type="module"][src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]').forEach((el) => {
      const u = el.src || el.href;
      if (u && u.includes('/assets/')) pendientes.push(u);
    });
    const vistos = new Set();
    let todoBien = true;
    while (pendientes.length && vistos.size < MAX_ARCHIVOS) {
      const lote = pendientes.splice(0, 6).filter((u) => !vistos.has(u));
      lote.forEach((u) => vistos.add(u));
      const res = await Promise.all(lote.map(bajarFresco));
      res.forEach((r, i) => {
        if (!r.ok) todoBien = false;
        if (r.texto) urlsDelTexto(r.texto, lote[i]).forEach((u) => { if (!vistos.has(u)) pendientes.push(u); });
      });
    }
    return todoBien;
  })().finally(() => { setTimeout(() => { reparando = null; }, 0); });
  return reparando;
};

/* ── Recargar la página (último recurso) ─────────────────────────────── */

const recargar = () => {
  const u = new URL(window.location.href);
  u.searchParams.set('_r', Date.now().toString());
  window.location.replace(u.toString());
};

// Repara la caché, limpia service worker/cachés y recarga con cache-bust.
// Hasta MAX_INTENTOS veces seguidas. Devuelve true si disparó la recuperación,
// false si ya se agotaron (para que el caller muestre la pantalla de error).
export const recoverFromChunkError = (why, err) => {
  if (typeof window === 'undefined') return false;
  if (window.__recuperandoChunk) return true; // varios listeners, una sola recarga
  const n = leerIntentos();
  if (n >= MAX_INTENTOS) return false;
  window.__recuperandoChunk = true;
  try {
    sessionStorage.setItem(RELOAD_FLAG, JSON.stringify({ n: n + 1, t: Date.now(), why: why || '' }));
  } catch {
    // sessionStorage no disponible: seguimos igual, sin guard.
  }

  const cleanups = [repararCache(urlDelError(err)).catch(() => {})];
  if ('serviceWorker' in navigator) {
    cleanups.push(
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
    );
  }
  if ('caches' in window) {
    cleanups.push(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
    );
  }
  Promise.all(cleanups).finally(() => {
    setTimeout(() => {
      // Sin internet, recargar solo gastaría el intento: se espera a que vuelva.
      if (navigator.onLine === false) {
        window.addEventListener('online', recargar, { once: true });
      } else {
        recargar();
      }
    }, ESPERAS_MS[n] || 0);
  });
  return true;
};

/* ── Carga de pantallas con reintento ────────────────────────────────── */

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hayInternet = () => (navigator.onLine === false
  ? new Promise((r) => window.addEventListener('online', r, { once: true }))
  : Promise.resolve());

/**
 * Importa un módulo y, si su archivo no baja, repara la caché y lo intenta de
 * nuevo sin recargar la página (el usuario no pierde lo que estaba haciendo).
 * Si aun así no baja, recarga como último recurso.
 */
export async function importarConReintento(cargar) {
  try {
    return await cargar();
  } catch (e) {
    if (!isChunkLoadError(e)) throw e;
    for (let i = 0; i < 2; i++) {
      await hayInternet();
      await repararCache(urlDelError(e)).catch(() => {});
      await esperar(i === 0 ? 300 : 1500);
      try {
        return await cargar();
      } catch (e2) {
        if (!isChunkLoadError(e2)) throw e2;
      }
    }
    // El navegador recuerda el fallo del módulo en esta página: toca recargar.
    if (recoverFromChunkError('lazy', e)) return new Promise(() => {}); // queda cargando hasta recargar
    throw e;
  }
}

/** React.lazy con reintento y reparación de caché. */
export const lazyConReintento = (cargar) => lazy(() => importarConReintento(cargar));
