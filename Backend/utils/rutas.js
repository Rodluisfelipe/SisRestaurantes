/**
 * Rutas por las calles: lo que no depende de la red.
 *
 *  - decodificar la geometría que manda Mapbox (polyline con 6 decimales);
 *  - ordenar las paradas de un domi con los TIEMPOS reales entre ellas (la
 *    matriz de Mapbox), respetando que cada pedido se recoge antes de
 *    entregarse;
 *  - la llave del caché: redondeada a ~11 m, para que dos consultas desde
 *    casi el mismo punto no gasten dos rutas.
 *
 * Puro, para probarlo sin Mapbox.
 */

/** Polyline codificada (precisión 6) → [[lng, lat], ...] */
function decodificarPolyline(str, precision = 6) {
  const factor = 10 ** precision;
  const coords = [];
  let lat = 0;
  let lng = 0;
  let i = 0;
  const leer = () => {
    let resultado = 0;
    let desplazamiento = 0;
    let b;
    do {
      b = str.charCodeAt(i++) - 63;
      resultado |= (b & 0x1f) << desplazamiento;
      desplazamiento += 5;
    } while (b >= 0x20 && i <= str.length);
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
  };
  while (i < str.length) {
    lat += leer();
    lng += leer();
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/** [[lng, lat], ...] → polyline codificada (para pruebas y para reenviar geometría). */
function codificarPolyline(coords, precision = 6) {
  const factor = 10 ** precision;
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const escribir = (v) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const [lng, lat] of coords) {
    const la = Math.round(lat * factor);
    const ln = Math.round(lng * factor);
    escribir(la - pLat);
    escribir(ln - pLng);
    pLat = la;
    pLng = ln;
  }
  return out;
}

/** Llave estable de un punto, redondeada a 4 decimales (~11 m). */
const clavePunto = (p) => `${Number(p.lng).toFixed(4)},${Number(p.lat).toFixed(4)}`;
const claveRuta = (perfil, puntos) => `${perfil}|${puntos.map(clavePunto).join(';')}`;

/**
 * El orden de las paradas que menos tiempo toma.
 * @param {number[][]} segundos  matriz N×N; el índice 0 es el domi
 * @param {Array<{clave:string, requiere?:string[]}>} paradas  índices 1..N-1 en ese orden
 * @returns {{ orden: string[], totalSegundos: number }}
 */
function ordenarConMatriz(segundos, paradas) {
  const n = paradas.length;
  const idx = new Map(paradas.map((p, i) => [p.clave, i + 1]));
  const costo = (a, b) => {
    const v = segundos?.[a]?.[b];
    return Number.isFinite(v) ? v : 1e7; // sin dato: se castiga, no se ignora
  };
  const permitido = (p, hechos) => (p.requiere || []).every((r) => !idx.has(r) || hechos.has(r));

  if (n <= 8) {
    let mejor = null;
    let mejorCosto = Infinity;
    const hechos = new Set();
    const camino = [];
    const buscar = (desde, acumulado) => {
      if (acumulado >= mejorCosto) return;
      if (camino.length === n) { mejor = [...camino]; mejorCosto = acumulado; return; }
      for (const p of paradas) {
        if (hechos.has(p.clave) || !permitido(p, hechos)) continue;
        hechos.add(p.clave);
        camino.push(p.clave);
        buscar(idx.get(p.clave), acumulado + costo(desde, idx.get(p.clave)));
        camino.pop();
        hechos.delete(p.clave);
      }
    };
    buscar(0, 0);
    return { orden: mejor || paradas.map((p) => p.clave), totalSegundos: Math.round(mejorCosto) };
  }

  // Muchas paradas: siempre a la siguiente posible más rápida
  const hechos = new Set();
  const orden = [];
  let aqui = 0;
  let total = 0;
  while (orden.length < n) {
    let elegido = null;
    let menor = Infinity;
    for (const p of paradas) {
      if (hechos.has(p.clave) || !permitido(p, hechos)) continue;
      const c = costo(aqui, idx.get(p.clave));
      if (c < menor) { menor = c; elegido = p; }
    }
    if (!elegido) break;
    hechos.add(elegido.clave);
    orden.push(elegido.clave);
    total += menor;
    aqui = idx.get(elegido.clave);
  }
  return { orden, totalSegundos: Math.round(total) };
}

/**
 * Una moto no hace la fila del carro en un trancón: Mapbox calcula para carro,
 * así que el tiempo se ajusta (0,85 = 15 % menos).
 */
const FACTOR_MOTO = 0.85;
const segundosMoto = (s) => Math.round(Number(s || 0) * FACTOR_MOTO);

module.exports = { decodificarPolyline, codificarPolyline, clavePunto, claveRuta, ordenarConMatriz, segundosMoto, FACTOR_MOTO };
