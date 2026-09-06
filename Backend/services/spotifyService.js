/**
 * spotifyService — qué está sonando en el local.
 *
 * Dos cuidados que definen todo el diseño:
 *
 * 1. CACHÉ OBLIGATORIA. El banner lo ve cada comensal con el menú abierto. Sin
 *    caché, un local lleno con 40 mesas preguntando cada 15 segundos son ~160
 *    llamadas por minuto a Spotify por UN local. Se consulta a Spotify como
 *    máximo una vez cada 10s por negocio y a todos se les sirve lo mismo.
 *
 * 2. NUNCA ROMPER EL MENÚ. Si Spotify falla, si el token venció, si el local
 *    apagó la música: se devuelve "no hay nada sonando" y el menú simplemente
 *    no pinta el banner. Un restaurante no puede quedarse sin vender porque se
 *    cayó una integración de música.
 */
const SpotifyAccount = require('../Models/SpotifyAccount');
const logger = require('../utils/logger');

const API = 'https://api.spotify.com/v1';
const CUENTAS = 'https://accounts.spotify.com';

/* Ventana de caché. 10s es el punto medio: la canción se siente en vivo y
   Spotify recibe 6 llamadas por minuto por local, pase lo que pase. */
const CACHE_MS = 10 * 1000;
const cache = new Map(); // businessId -> { hasta, datos }

/** Los permisos mínimos: solo leer qué suena. Nada de controlar la música. */
const SCOPES = 'user-read-currently-playing user-read-playback-state';

function urlDeRedireccion() {
  const base = (process.env.API_PUBLIC_URL || 'https://api.menuby.tech').replace(/\/$/, '');
  return `${base}/api/spotify/callback`;
}

/** URL a la que se manda al dueño para que autorice su propia app. */
function urlDeAutorizacion(clientId, state) {
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: urlDeRedireccion(),
    scope: SCOPES,
    state,
    show_dialog: 'true',
  });
  return `${CUENTAS}/authorize?${p.toString()}`;
}

/** Cabecera Basic con las credenciales de la app del local. */
function basic(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/** Canjea el código de autorización por los tokens. */
async function canjearCodigo(cuenta, code) {
  const res = await fetch(`${CUENTAS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: basic(cuenta.clientId, cuenta.getClientSecret()),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: urlDeRedireccion(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Spotify rechazó la autorización');
  }
  return data;
}

/**
 * Devuelve un access token utilizable, renovándolo si hace falta.
 *
 * Spotify a veces NO manda un refresh_token nuevo al renovar; en ese caso hay
 * que conservar el que ya se tenía. Pisarlo con vacío dejaría la cuenta muerta
 * hasta que el dueño la reconectara a mano.
 */
async function tokenVigente(cuenta) {
  if (cuenta.accessTokenVigente()) return cuenta.getAccessToken();

  const refresh = cuenta.getRefreshToken();
  if (!refresh) throw new Error('La cuenta de Spotify no está conectada');

  const res = await fetch(`${CUENTAS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: basic(cuenta.clientId, cuenta.getClientSecret()),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'No se pudo renovar el acceso a Spotify');
  }

  cuenta.setAccessToken(data.access_token, data.expires_in);
  if (data.refresh_token) cuenta.setRefreshToken(data.refresh_token);
  await cuenta.save();

  return cuenta.getAccessToken();
}

const NADA = { sonando: false };

/**
 * Qué suena ahora en el local. Nunca lanza: siempre devuelve algo pintable.
 */
async function loQueSuena(businessId) {
  const clave = String(businessId);

  const enCache = cache.get(clave);
  if (enCache && enCache.hasta > Date.now()) return enCache.datos;

  let datos = NADA;
  try {
    const cuenta = await SpotifyAccount.findOne({ businessId });
    if (!cuenta || !cuenta.activo || !cuenta.refreshTokenEnc) {
      guardarEnCache(clave, NADA);
      return NADA;
    }

    const token = await tokenVigente(cuenta);
    const res = await fetch(`${API}/me/player/currently-playing`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 204 = no hay nada sonando. Es respuesta normal, no un error.
    if (res.status === 204) {
      guardarEnCache(clave, NADA);
      return NADA;
    }

    if (!res.ok) {
      const cuerpo = await res.json().catch(() => ({}));
      throw new Error(cuerpo?.error?.message || `Spotify respondió ${res.status}`);
    }

    const info = await res.json().catch(() => null);
    const item = info?.item;

    if (!info?.is_playing || !item) {
      guardarEnCache(clave, NADA);
      return NADA;
    }

    datos = {
      sonando: true,
      titulo: item.name || '',
      artista: (item.artists || []).map(a => a.name).filter(Boolean).join(', '),
      /* La carátula más pequeña que mande Spotify: el banner es diminuto y
         bajar una imagen de 640px al celular de cada comensal, cada 10
         segundos, es gastarles los datos para nada. */
      imagen: elegirCaratula(item.album?.images),
      duracionMs: item.duration_ms || 0,
      progresoMs: info.progress_ms || 0,
    };

    if (cuenta.status !== 'conectado' || cuenta.lastError) {
      cuenta.status = 'conectado';
      cuenta.lastError = '';
    }
    cuenta.lastPlayingAt = new Date();
    await cuenta.save();
  } catch (error) {
    logger.warn('[Spotify] No se pudo leer lo que suena', { businessId: clave, error: error.message });
    // Se cachea el fallo igual: si Spotify está caído, no tiene sentido
    // reintentar con cada comensal que abra el menú.
    datos = NADA;
    marcarError(businessId, error.message).catch(() => {});
  }

  guardarEnCache(clave, datos);
  return datos;
}

function elegirCaratula(imagenes) {
  if (!Array.isArray(imagenes) || !imagenes.length) return '';
  const ordenadas = [...imagenes].sort((a, b) => (a.width || 0) - (b.width || 0));
  const chica = ordenadas.find(i => (i.width || 0) >= 64) || ordenadas[0];
  return chica?.url || '';
}

function guardarEnCache(clave, datos) {
  cache.set(clave, { hasta: Date.now() + CACHE_MS, datos });
  // La caché vive en memoria del proceso; sin tope crecería con cada negocio.
  if (cache.size > 500) cache.delete(cache.keys().next().value);
}

async function marcarError(businessId, mensaje) {
  await SpotifyAccount.updateOne(
    { businessId },
    { $set: { status: 'error', lastError: String(mensaje || '').slice(0, 300) } }
  );
}

/** Se llama al desconectar o cambiar credenciales, para no servir lo viejo. */
function limpiarCache(businessId) {
  cache.delete(String(businessId));
}

module.exports = {
  urlDeAutorizacion,
  urlDeRedireccion,
  canjearCodigo,
  loQueSuena,
  limpiarCache,
  SCOPES,
};
