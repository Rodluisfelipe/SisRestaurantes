const crypto = require('crypto');

/**
 * Reglas de la asistencia, sin base de datos (para poder probarlas).
 */

const ZONA = 'America/Bogota';

// Una entrada abierta hace más de esto ya no se cierra con la siguiente marca:
// se asume que olvidó marcar la salida y lo nuevo es otra entrada.
const MAX_JORNADA_MS = 20 * 60 * 60 * 1000;

// Dos marcas de la misma persona en menos de esto son un doble toque.
const DOBLE_MARCA_MS = 60 * 1000;

const PIN_RE = /^\d{4}$/;

function secreto(uso) {
  return `${process.env.JWT_SECRET || 'menuby-dev'}:${uso}`;
}

/** HMAC del PIN, atado al negocio: el mismo PIN en dos negocios da distinto. */
function hashPin(businessId, pin) {
  return crypto.createHmac('sha256', secreto('asistencia-pin')).update(`${businessId}:${pin}`).digest('hex');
}

function pinValido(pin) {
  return PIN_RE.test(String(pin || ''));
}

/** Código aleatorio para el QR o el link (sin caracteres que se confunden). */
function codigoAleatorio(largo = 12) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(largo);
  let s = '';
  for (let i = 0; i < largo; i++) s += abc[bytes[i] % abc.length];
  return s;
}

/**
 * ¿La marca que viene es entrada o salida? Si lo último fue una entrada
 * (reciente), esta es la salida. Si no, es una entrada.
 * Devuelve null si es un doble toque.
 */
function siguienteTipo(ultima, ahora = new Date()) {
  if (!ultima) return 'entrada';
  const hace = ahora - new Date(ultima.fecha);
  if (hace < DOBLE_MARCA_MS) return null;
  if (ultima.tipo === 'entrada' && hace < MAX_JORNADA_MS) return 'salida';
  return 'entrada';
}

function hora(fecha) {
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ZONA }).format(new Date(fecha));
}

function dia(fecha) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).format(new Date(fecha));
}

function escaparHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** El aviso de Telegram: quién, entrada o salida, sede y hora. */
function mensajeTelegram({ nombre, tipo, sedeNombre, fecha }) {
  const cabeza = tipo === 'entrada' ? '🟢 <b>Entrada</b>' : '🔴 <b>Salida</b>';
  return [
    `${cabeza} · ${escaparHtml(nombre)}`,
    `📍 ${escaparHtml(sedeNombre || 'Sede principal')}`,
    `🕐 ${hora(fecha)} · ${dia(fecha)}`,
  ].join('\n');
}

/** "YYYY-MM-DD" (día en Colombia) → Date al inicio de ese día. */
function inicioDelDia(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return null;
  return new Date(`${ymd}T00:00:00-05:00`);
}

/** Busca en las actualizaciones de Telegram un "/start <codigo>". */
function chatDelVinculo(updates, codigo) {
  const re = new RegExp(`^/start(?:@\\w+)?\\s+${codigo}\\s*$`);
  for (const u of updates || []) {
    const m = u.message || u.channel_post;
    if (m && typeof m.text === 'string' && re.test(m.text.trim())) {
      const chat = m.chat || {};
      const nombre = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '';
      return { chatId: String(chat.id), nombre };
    }
  }
  return null;
}

/** Candado de la marca: persona + minuto. */
function candadoMarca(personaId, fecha = new Date()) {
  return `${personaId}:${Math.floor(new Date(fecha).getTime() / 60000)}`;
}

// Solo links de Google Maps (el servidor los abre para leer las coordenadas).
const HOSTS_MAPS = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i;

function esLinkMaps(texto) {
  try {
    const u = new URL(String(texto).trim());
    if (!/^https?:$/.test(u.protocol) || !HOSTS_MAPS.test(u.hostname)) return false;
    if (/^(www\.)?google\./i.test(u.hostname) && !u.pathname.startsWith('/maps')) return false;
    if (u.hostname === 'goo.gl' && !u.pathname.startsWith('/maps')) return false;
    return true;
  } catch {
    return false;
  }
}

function coordsValidas(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Lee las coordenadas de un link largo de Google Maps. El punto exacto del
 * lugar (!3d…!4d…) manda sobre el centro de la vista (@lat,lng).
 */
function coordsDeMaps(texto) {
  const s = decodeURIComponent(String(texto || ''));
  const patrones = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patrones) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (coordsValidas(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/** Metros entre dos puntos. */
function metrosEntre(a, b) {
  if (!a || !b || !coordsValidas(a.lat, a.lng) || !coordsValidas(b.lat, b.lng)) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

/** ¿Puede esta persona marcar en esta sede? (sin sedes asignadas = en todas) */
function puedeMarcarEn(persona, sedeId) {
  const sedes = (persona?.sedes || []).map(String);
  return !sedes.length || sedes.includes(String(sedeId));
}

module.exports = {
  candadoMarca,
  esLinkMaps,
  coordsValidas,
  coordsDeMaps,
  metrosEntre,
  puedeMarcarEn,
  ZONA,
  MAX_JORNADA_MS,
  DOBLE_MARCA_MS,
  secreto,
  hashPin,
  pinValido,
  codigoAleatorio,
  siguienteTipo,
  hora,
  dia,
  mensajeTelegram,
  inicioDelDia,
  chatDelVinculo,
};
