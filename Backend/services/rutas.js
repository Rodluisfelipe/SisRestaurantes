/**
 * Rutas por las calles con Mapbox (en vez de líneas rectas).
 *
 * Tres cosas:
 *   - la ruta del domi: geometría para dibujarla y tiempo real con tráfico;
 *   - el orden de varias paradas, con la matriz de tiempos reales;
 *   - la distancia por calle, para cobrar lo justo (red y envíos).
 *
 * Todo se guarda unos minutos en memoria con llaves redondeadas a ~11 m: el
 * mismo domi pidiendo la misma ruta no gasta una consulta nueva cada vez.
 * Sin llave (MAPBOX_TOKEN) o si Mapbox falla, todo devuelve null y quien
 * llama sigue con la línea recta, como antes. Nada se rompe por esto.
 */
const logger = require('../utils/logger');
const { decodificarPolyline, claveRuta, ordenarConMatriz, segundosMoto } = require('../utils/rutas');

const BASE = () => (process.env.MAPBOX_API_URL || 'https://api.mapbox.com').replace(/\/$/, '');
const TOKEN = () => process.env.MAPBOX_TOKEN || '';
const ESPERA_MS = 6000;
const MAX_CACHE = 3000;

const cache = new Map(); // llave → { vence, valor }
function leerCache(llave) {
  const c = cache.get(llave);
  if (!c) return undefined;
  if (c.vence < Date.now()) { cache.delete(llave); return undefined; }
  return c.valor;
}
function guardarCache(llave, valor, ms) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); // el más viejo
  cache.set(llave, { vence: Date.now() + ms, valor });
}

const activo = () => !!TOKEN();
const coords = (puntos) => puntos.map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
const valido = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && (Number(p.lat) !== 0 || Number(p.lng) !== 0);

let fallosSeguidos = 0;
let pausaHasta = 0;

async function pedir(ruta, params) {
  if (!activo() || Date.now() < pausaHasta) return null;
  const url = `${BASE()}${ruta}?${new URLSearchParams({ ...params, access_token: TOKEN() })}`;
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const r = await fetch(url, { signal: control.signal });
    if (!r.ok) throw new Error(`Mapbox ${r.status}`);
    const j = await r.json();
    fallosSeguidos = 0;
    return j;
  } catch (e) {
    fallosSeguidos += 1;
    // Si Mapbox está caído o la llave se agotó, un minuto sin preguntar: no se frena a nadie esperando
    if (fallosSeguidos >= 3) { pausaHasta = Date.now() + 60000; fallosSeguidos = 0; }
    logger.warn('Ruta de Mapbox falló; se usa la línea recta', { error: e.message });
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Ruta entre puntos en ese orden.
 * @returns {Promise<null | { metros, segundos, geometria, tramos: [{metros, segundos}] }>}
 */
async function rutaEntre(puntos, { trafico = true } = {}) {
  if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > 25 || !puntos.every(valido)) return null;
  // Con tráfico Mapbox admite hasta 3 puntos; para más, sin tráfico
  const perfil = trafico && puntos.length <= 3 ? 'driving-traffic' : 'driving';
  const llave = claveRuta(perfil, puntos);
  const guardada = leerCache(llave);
  if (guardada !== undefined) return guardada;
  const j = await pedir(`/directions/v5/mapbox/${perfil}/${coords(puntos)}`, { geometries: 'polyline6', overview: 'full', steps: 'false' });
  const r = j?.routes?.[0];
  const valor = r ? {
    metros: Math.round(r.distance),
    segundos: segundosMoto(r.duration),
    geometria: r.geometry,
    tramos: (r.legs || []).map((l) => ({ metros: Math.round(l.distance), segundos: segundosMoto(l.duration) })),
  } : null;
  if (valor) guardarCache(llave, valor, perfil === 'driving-traffic' ? 3 * 60000 : 30 * 60000);
  return valor;
}

/** Matriz de tiempos (segundos, ya de moto) entre todos los puntos. */
async function matriz(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > 25 || !puntos.every(valido)) return null;
  const perfil = puntos.length <= 10 ? 'driving-traffic' : 'driving';
  const llave = `matriz:${claveRuta(perfil, puntos)}`;
  const guardada = leerCache(llave);
  if (guardada !== undefined) return guardada;
  const j = await pedir(`/directions-matrix/v1/mapbox/${perfil}/${coords(puntos)}`, { annotations: 'duration,distance' });
  const valor = Array.isArray(j?.durations) ? j.durations.map((fila) => fila.map((s) => (s == null ? null : segundosMoto(s)))) : null;
  if (valor) guardarCache(llave, valor, 3 * 60000);
  return valor;
}

/** Distancia por calle en km (null si no se pudo: quien llama usa la recta × 1,3). */
async function distanciaKm(a, b) {
  const r = await rutaEntre([a, b], { trafico: false });
  return r ? Math.round(r.metros / 100) / 10 : null;
}

/**
 * El plan del domi: orden con tiempos reales + la ruta para dibujar.
 * @param {{lat,lng}} yo
 * @param {Array<{clave, ubicacion:{lat,lng}, requiere?:string[]}>} paradas
 */
async function planRuta(yo, paradas) {
  const conPunto = (Array.isArray(paradas) ? paradas : []).filter((p) => valido(p?.ubicacion)).slice(0, 24);
  if (!valido(yo) || !conPunto.length) return null;

  let orden = conPunto.map((p) => p.clave);
  const m = conPunto.length > 1 ? await matriz([yo, ...conPunto.map((p) => p.ubicacion)]) : null;
  if (m) orden = ordenarConMatriz(m, conPunto.map((p) => ({ clave: p.clave, requiere: p.requiere || [] }))).orden;

  const porClave = new Map(conPunto.map((p) => [p.clave, p]));
  const secuencia = orden.map((c) => porClave.get(c));
  const r = await rutaEntre([yo, ...secuencia.map((p) => p.ubicacion)], { trafico: true });
  if (!r) return m ? { orden, geometria: null, tramos: [], proveedor: 'mapbox' } : null;
  let acumulado = 0;
  return {
    proveedor: 'mapbox',
    orden,
    geometria: r.geometria,
    metros: r.metros,
    segundos: r.segundos,
    tramos: secuencia.map((p, i) => {
      const t = r.tramos[i] || { metros: null, segundos: null };
      acumulado += t.segundos || 0;
      return { clave: p.clave, metros: t.metros, segundos: t.segundos, llegadaSegundos: acumulado };
    }),
  };
}

module.exports = { activo, rutaEntre, matriz, distanciaKm, planRuta, decodificarPolyline, _cache: cache };
