/**
 * Google Places API (New) — wrapper para MenuBy.
 * Se usa como proxy server-side para no exponer la API key y poder cachear/limitar.
 *
 * Requiere env GOOGLE_PLACES_API_KEY (proyecto de Google Cloud con "Places API (New)" habilitada).
 * Docs: https://developers.google.com/maps/documentation/places/web-service
 */
const logger = require('../utils/logger');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

const isConfigured = () => !!API_KEY;

/**
 * Autocompletado de lugares/negocios.
 * @param {string} input texto de búsqueda
 * @param {string} [sessionToken] token de sesión (optimiza facturación autocomplete+details)
 * @returns {Promise<Array<{placeId, description, mainText, secondaryText}>>}
 */
async function autocomplete(input, sessionToken) {
  if (!isConfigured()) throw new Error('GOOGLE_PLACES_API_KEY no configurada');
  if (!input || !input.trim()) return [];

  const body = {
    input: input.trim(),
    languageCode: 'es',
    regionCode: 'CO',
  };
  if (sessionToken) body.sessionToken = sessionToken;

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('Places autocomplete error', { status: res.status, body: text.slice(0, 300) });
    throw new Error(`Places autocomplete ${res.status}`);
  }

  const data = await res.json();
  const suggestions = data.suggestions || [];
  return suggestions
    .filter(s => s.placePrediction)
    .map(s => {
      const p = s.placePrediction;
      return {
        placeId: p.placeId,
        description: p.text?.text || '',
        mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondaryText: p.structuredFormat?.secondaryText?.text || '',
      };
    });
}

// Places day index: 0=Sunday..6=Saturday → claves de businessHours
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const pad = (n) => String(n).padStart(2, '0');

/**
 * Convierte regularOpeningHours (Places) al formato businessHours de MenuBy.
 * Aproximación: primer periodo por día. El dueño puede ajustar después.
 */
function mapOpeningHours(regularOpeningHours) {
  const periods = regularOpeningHours?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;

  const hours = {};
  for (const key of DAY_KEYS) {
    hours[key] = { isOpen: false, openTime: '08:00', closeTime: '22:00' };
  }

  for (const period of periods) {
    const openDay = period.open?.day;
    if (openDay === undefined || openDay === null) continue;
    const key = DAY_KEYS[openDay];
    if (!key || hours[key].isOpen) continue; // primer periodo del día

    const openTime = `${pad(period.open.hour || 0)}:${pad(period.open.minute || 0)}`;
    // Si no hay close (abierto 24h) dejamos 23:59
    const closeTime = period.close
      ? `${pad(period.close.hour || 0)}:${pad(period.close.minute || 0)}`
      : '23:59';
    hours[key] = { isOpen: true, openTime, closeTime };
  }

  return hours;
}

/**
 * Detalles de un lugar. Devuelve datos normalizados para prellenar el negocio.
 * @param {string} placeId
 * @param {string} [sessionToken]
 */
async function details(placeId, sessionToken) {
  if (!isConfigured()) throw new Error('GOOGLE_PLACES_API_KEY no configurada');
  if (!placeId) throw new Error('placeId requerido');

  const fieldMask = [
    'id', 'displayName', 'formattedAddress', 'location',
    'nationalPhoneNumber', 'internationalPhoneNumber',
    'rating', 'userRatingCount', 'googleMapsUri', 'websiteUri',
    'regularOpeningHours',
  ].join(',');

  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'es');
  url.searchParams.set('regionCode', 'CO');
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('Places details error', { status: res.status, body: text.slice(0, 300) });
    throw new Error(`Places details ${res.status}`);
  }

  const d = await res.json();
  return {
    placeId: d.id || placeId,
    name: d.displayName?.text || '',
    address: d.formattedAddress || '',
    location: d.location ? { lat: d.location.latitude, lng: d.location.longitude } : null,
    phone: d.nationalPhoneNumber || d.internationalPhoneNumber || '',
    rating: typeof d.rating === 'number' ? d.rating : null,
    reviewCount: typeof d.userRatingCount === 'number' ? d.userRatingCount : 0,
    mapsUrl: d.googleMapsUri || '',
    website: d.websiteUri || '',
    // Enlace directo para escribir reseña (deep link estable de Google)
    reviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(d.id || placeId)}`,
    businessHours: mapOpeningHours(d.regularOpeningHours),
  };
}

module.exports = { isConfigured, autocomplete, details, mapOpeningHours };
