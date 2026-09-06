const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const SpotifyAccount = require('../Models/SpotifyAccount');
const spotify = require('../services/spotifyService');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');
const { tenantAuth } = require('../middleware/tenantAuth');
const { resolveBusinessId } = require('../utils/businessResolver');

/**
 * Spotify — el banner de "qué está sonando" en el menú del local.
 *
 * Cada negocio conecta SU PROPIA app de Spotify. Ver el comentario del modelo
 * SpotifyAccount para el porqué.
 */

/* Mismo mecanismo que el OAuth de WhatsApp: el negocio viaja firmado dentro del
   `state`. Sin firma, cualquiera podría cambiar el state por el id de otro
   negocio y conectarle una cuenta ajena. */
function firmarNegocio(businessId) {
  const dato = String(businessId);
  const firma = crypto.createHmac('sha256', process.env.JWT_SECRET).update(dato).digest('hex').slice(0, 32);
  return `${dato}.${firma}`;
}

function leerNegocioFirmado(state) {
  const [dato, firma] = String(state || '').split('.');
  if (!dato || !firma) return null;
  const esperada = crypto.createHmac('sha256', process.env.JWT_SECRET).update(dato).digest('hex').slice(0, 32);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return dato;
}

// GET /api/spotify/cuenta — estado para el panel
router.get('/cuenta', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    const cuenta = await SpotifyAccount.findOne({ businessId });
    res.json({
      cuenta: cuenta ? cuenta.toPanel() : null,
      urlDeRedireccion: spotify.urlDeRedireccion(),
    });
  } catch (error) {
    logger.error('Error obteniendo cuenta de Spotify', error, req);
    res.status(500).json(formatHttpError(req, 'Error al consultar la cuenta de Spotify', 500));
  }
});

// PUT /api/spotify/credenciales — el dueño pega client id y secret de su app
router.put('/credenciales', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.body.businessId || req.user?.businessId);
    const clientId = String(req.body.clientId || '').trim();
    const clientSecret = String(req.body.clientSecret || '').trim();

    if (!clientId || !clientSecret) {
      return res.status(400).json(formatHttpError(req, 'Hacen falta el Client ID y el Client Secret de tu app de Spotify', 400));
    }

    let cuenta = await SpotifyAccount.findOne({ businessId });
    if (!cuenta) cuenta = new SpotifyAccount({ businessId });

    /* Si cambian las credenciales, los tokens viejos ya no sirven: pertenecen
       a la app anterior. Se borran para que el dueño vuelva a autorizar y no
       quede una cuenta a medias que falla en silencio. */
    const cambio = cuenta.clientId !== clientId;
    cuenta.clientId = clientId;
    cuenta.setClientSecret(clientSecret);
    if (cambio) {
      cuenta.refreshTokenEnc = '';
      cuenta.accessTokenEnc = '';
      cuenta.accessTokenExpiresAt = null;
      cuenta.displayName = '';
      cuenta.status = 'sin_conectar';
      cuenta.lastError = '';
    }
    await cuenta.save();
    spotify.limpiarCache(businessId);

    res.json({ cuenta: cuenta.toPanel() });
  } catch (error) {
    logger.error('Error guardando credenciales de Spotify', error, req);
    res.status(500).json(formatHttpError(req, 'Error al guardar las credenciales', 500));
  }
});

// GET /api/spotify/conectar — devuelve la URL de autorización
router.get('/conectar', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    const cuenta = await SpotifyAccount.findOne({ businessId });

    if (!cuenta?.clientId || !cuenta?.clientSecretEnc) {
      return res.status(400).json(formatHttpError(req, 'Primero guarda el Client ID y el Client Secret de tu app', 400));
    }

    res.json({ url: spotify.urlDeAutorizacion(cuenta.clientId, firmarNegocio(businessId)) });
  } catch (error) {
    logger.error('Error generando enlace de Spotify', error, req);
    res.status(500).json(formatHttpError(req, 'Error al generar el enlace', 500));
  }
});

/**
 * GET /api/spotify/callback — a donde vuelve el dueño desde Spotify.
 * Público: lo llama el navegador del dueño; la autenticación la da el `state`
 * firmado, no una sesión nuestra.
 */
router.get('/callback', async (req, res) => {
  const panel = (process.env.FRONTEND_URL || 'https://menuby.tech').replace(/\/$/, '');

  /* Se devuelve al dueño a SU panel, no a una página intermedia: viene de
     autorizar en Spotify y lo natural es caer donde estaba, con el resultado
     a la vista. Si no se puede resolver el negocio, al menos a la raíz. */
  const volver = async (estado, detalle) => {
    let destino = `${panel}/?spotify=${estado}`;
    try {
      const businessId = leerNegocioFirmado(req.query.state);
      if (businessId) {
        const BusinessConfig = require('../Models/BusinessConfig');
        const negocio = await BusinessConfig.findById(businessId).select('slug').lean();
        if (negocio?.slug) destino = `${panel}/${negocio.slug}/admin?spotify=${estado}`;
      }
    } catch { /* el destino por defecto ya sirve */ }

    if (detalle) destino += `&motivo=${encodeURIComponent(String(detalle).slice(0, 120))}`;
    return res.redirect(destino);
  };

  const businessId = leerNegocioFirmado(req.query.state);
  if (!businessId) {
    logger.warn('[Spotify] Callback con state inválido');
    return volver('error', 'El enlace no es válido o fue alterado');
  }
  if (req.query.error) return volver('cancelado');
  if (!req.query.code) return volver('cancelado');

  try {
    const cuenta = await SpotifyAccount.findOne({ businessId });
    if (!cuenta) return volver('error', 'No hay credenciales guardadas para este negocio');

    const tokens = await spotify.canjearCodigo(cuenta, String(req.query.code));

    cuenta.setAccessToken(tokens.access_token, tokens.expires_in);
    if (tokens.refresh_token) cuenta.setRefreshToken(tokens.refresh_token);
    cuenta.status = 'conectado';
    cuenta.lastError = '';

    // Nombre de la cuenta, solo para que el dueño confirme que conectó la
    // correcta. Si falla, no vale la pena tumbar toda la conexión por eso.
    try {
      const perfil = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }).then(r => r.json());
      cuenta.displayName = perfil?.display_name || perfil?.id || '';
    } catch { /* el nombre es cosmético */ }

    await cuenta.save();
    spotify.limpiarCache(businessId);

    return volver('ok');
  } catch (error) {
    logger.error('[Spotify] Error en el callback', error);
    return volver('error', error.message);
  }
});

// DELETE /api/spotify/cuenta — desconectar
router.delete('/cuenta', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.query.businessId || req.user?.businessId);
    await SpotifyAccount.deleteOne({ businessId });
    spotify.limpiarCache(businessId);
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error desconectando Spotify', error, req);
    res.status(500).json(formatHttpError(req, 'Error al desconectar', 500));
  }
});

// PATCH /api/spotify/activo — encender/apagar el banner sin desconectar
router.patch('/activo', tenantAuth, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req.body.businessId || req.user?.businessId);
    const cuenta = await SpotifyAccount.findOne({ businessId });
    if (!cuenta) return res.status(404).json(formatHttpError(req, 'No hay cuenta de Spotify conectada', 404));

    cuenta.activo = !!req.body.activo;
    await cuenta.save();
    spotify.limpiarCache(businessId);

    res.json({ cuenta: cuenta.toPanel() });
  } catch (error) {
    logger.error('Error cambiando estado del banner', error, req);
    res.status(500).json(formatHttpError(req, 'Error al actualizar', 500));
  }
});

/**
 * GET /api/spotify/sonando — público, lo consulta el menú del comensal.
 *
 * Va sin autenticación a propósito: lo llama cualquiera que tenga el menú
 * abierto. Solo devuelve título, artista y carátula —nada del negocio ni de la
 * cuenta— y por debajo hay caché de 10s por local, así que ni siquiera se puede
 * usar para golpear a Spotify.
 */
router.get('/sonando', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.json({ sonando: false });

    const bid = await resolveBusinessId(businessId).catch(() => null);
    if (!bid) return res.json({ sonando: false });

    res.json(await spotify.loQueSuena(bid));
  } catch (error) {
    // Jamás romper el menú por la música.
    logger.warn('Error consultando lo que suena', { error: error.message });
    res.json({ sonando: false });
  }
});

module.exports = router;
