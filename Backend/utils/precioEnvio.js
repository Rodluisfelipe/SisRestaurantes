/**
 * El precio de un envío de una empresa de reparto a sus clientes (fuera de
 * MenuBy): lo que ve el cliente antes de pedir.
 *
 * Dos formas que la empresa puede usar a la vez:
 *   1. Zonas en el mapa con precio fijo ("Centro: $6.000"). Si el destino cae
 *      en una zona activa, manda la zona: es lo que la empresa le prometió a
 *      su cliente y no debe cambiar por unos metros más o menos.
 *   2. Tarifa por distancia (base + valor por km), para todo lo demás.
 * Si la empresa no cubre el destino (ninguna zona y sin tarifa por distancia,
 * o más lejos que su distancia máxima), se dice claro: no se inventa precio.
 *
 * Puro: sin base de datos, para probarlo entero.
 */
const FACTOR_CALLES = 1.3;

function distanciaKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** ¿El punto está dentro del polígono? (anillo de [lng, lat], trazado de rayo). */
function dentroDePoligono(punto, anillo) {
  if (!punto || !Array.isArray(anillo) || anillo.length < 3) return false;
  const x = punto.lng;
  const y = punto.lat;
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    const cruza = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function enZona(punto, z) {
  if (!z || z.activa === false) return false;
  if (z.tipo === 'circulo') {
    const d = distanciaKm(punto, z.centro);
    return d != null && d <= Number(z.radioKm || 0);
  }
  return dentroDePoligono(punto, z.poligono);
}

const redondearArriba = (v, paso) => Math.ceil(v / Math.max(1, paso)) * Math.max(1, paso);

/**
 * @param {Object} tarifa  { base, porKm, kmIncluidos, minimo, maximoKm, redondeo }
 * @param {Array}  zonas   [{ nombre, precio, tipo: 'poligono'|'circulo', poligono, centro, radioKm, activa }]
 * @param {{lat,lng}} origen
 * @param {{lat,lng}} destino
 * @returns {{ cubre: boolean, precio?: number, km?: number, zona?: string, desglose?: Array, motivo?: string }}
 */
function calcularPrecioEnvio(tarifa, zonas, origen, destino, kmPorCalle = null) {
  if (!origen || !destino) return { cubre: false, motivo: 'Marca el punto de recogida y el de entrega.' };
  // Distancia por calle (Mapbox) si la hay; si no, la recta × 1,3
  const km = Number.isFinite(kmPorCalle) && kmPorCalle > 0
    ? Math.round(kmPorCalle * 10) / 10
    : Math.round((distanciaKm(origen, destino) || 0) * FACTOR_CALLES * 10) / 10;

  // 1. Zona con precio fijo: la primera activa que contenga el destino
  const zona = (Array.isArray(zonas) ? zonas : []).find((z) => Number(z?.precio) > 0 && enZona(destino, z));
  if (zona) {
    const precio = Math.round(Number(zona.precio));
    return { cubre: true, precio, km, zona: zona.nombre || 'Zona', desglose: [{ concepto: `Zona ${zona.nombre || ''}`.trim(), valor: precio }] };
  }

  // 2. Tarifa por distancia
  const t = tarifa || {};
  const base = Math.max(0, Number(t.base) || 0);
  const porKm = Math.max(0, Number(t.porKm) || 0);
  if (!base && !porKm) return { cubre: false, km, motivo: 'Esta empresa no llega a esa dirección.' };
  const maximoKm = Number(t.maximoKm) || 0;
  if (maximoKm > 0 && km > maximoKm) return { cubre: false, km, motivo: `Solo hacemos envíos de hasta ${maximoKm} km.` };

  const incluidos = Math.max(0, Number(t.kmIncluidos) || 0);
  const porDistancia = Math.round(Math.max(0, km - incluidos) * porKm);
  const desglose = [{ concepto: 'Tarifa base', valor: base }];
  if (porDistancia > 0) desglose.push({ concepto: `Distancia (${km.toFixed(1).replace('.', ',')} km)`, valor: porDistancia });
  let precio = Math.max(Number(t.minimo) || 0, base + porDistancia);
  precio = redondearArriba(precio, Number(t.redondeo) || 100);
  const sumado = desglose.reduce((s, d) => s + d.valor, 0);
  if (precio !== sumado) desglose.push({ concepto: precio - sumado > 0 && base + porDistancia < (Number(t.minimo) || 0) ? 'Ajuste al mínimo' : 'Redondeo', valor: precio - sumado });
  return { cubre: true, precio, km, desglose };
}

/** Normaliza la tarifa que guarda la empresa (sin negativos ni absurdos). */
function normalizarTarifaEnvio(t = {}) {
  const n = (v, max) => Math.min(max, Math.max(0, Number(v) || 0));
  return {
    base: Math.round(n(t.base, 1e6)),
    porKm: Math.round(n(t.porKm, 1e5)),
    kmIncluidos: n(t.kmIncluidos, 50),
    minimo: Math.round(n(t.minimo, 1e6)),
    maximoKm: n(t.maximoKm, 500),
    redondeo: Math.max(1, Math.round(n(t.redondeo, 10000)) || 100),
  };
}

/** Normaliza las zonas: sin polígonos rotos ni precios negativos. */
function normalizarZonas(zonas = []) {
  return (Array.isArray(zonas) ? zonas : []).slice(0, 50).map((z) => {
    const base = { nombre: String(z?.nombre || 'Zona').trim().slice(0, 40), precio: Math.round(Math.max(0, Number(z?.precio) || 0)), activa: z?.activa !== false };
    if (z?.tipo === 'circulo') {
      const lat = Number(z?.centro?.lat);
      const lng = Number(z?.centro?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { ...base, tipo: 'circulo', centro: { lat, lng }, radioKm: Math.min(100, Math.max(0.1, Number(z?.radioKm) || 1)) };
    }
    const anillo = (Array.isArray(z?.poligono) ? z.poligono : [])
      .map((p) => [Number(p?.[0]), Number(p?.[1])])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 180 && Math.abs(b) <= 90)
      .slice(0, 200);
    if (anillo.length < 3) return null;
    return { ...base, tipo: 'poligono', poligono: anillo };
  }).filter(Boolean);
}

module.exports = { calcularPrecioEnvio, normalizarTarifaEnvio, normalizarZonas, dentroDePoligono, distanciaKm };
