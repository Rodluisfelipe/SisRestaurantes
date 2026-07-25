const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const BusinessConfig = require('../Models/BusinessConfig');
const places = require('../services/googlePlaces');
const logger = require('../utils/logger');

// Rate limit para el proxy (evita abuso de la cuota de Google)
const placesLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  message: { message: 'Demasiadas búsquedas. Intenta de nuevo en un momento.' },
});

// GET /api/places/status — ¿está configurada la integración?
router.get('/status', (req, res) => {
  res.json({ configured: places.isConfigured() });
});

// GET /api/places/autocomplete?input=&sessionToken=
router.get('/autocomplete', placesLimiter, async (req, res) => {
  try {
    if (!places.isConfigured()) return res.json({ configured: false, predictions: [] });
    const { input, sessionToken } = req.query;
    if (!input || input.trim().length < 3) return res.json({ predictions: [] });
    const predictions = await places.autocomplete(input, sessionToken);
    res.json({ configured: true, predictions });
  } catch (err) {
    logger.warn('Places autocomplete route error', { error: err.message });
    res.status(502).json({ message: 'No se pudo consultar Google Places', predictions: [] });
  }
});

// Proxy de fotos: el navegador no puede llamar a Google (key restringida por IP),
// así que el servidor resuelve la URL pública y redirige. Cache en memoria para no repetir cuota.
const photoCache = new Map(); // `${name}|${w}` -> { uri, exp }
// GET /api/places/photo?name=places/PID/photos/REF&maxWidthPx=600
router.get('/photo', async (req, res) => {
  try {
    if (!places.isConfigured()) return res.status(404).end();
    const { name } = req.query;
    if (!name || !String(name).includes('/photos/')) return res.status(400).end();
    const w = Math.min(Math.max(parseInt(req.query.maxWidthPx) || 600, 100), 1200);
    const key = `${name}|${w}`;

    const cached = photoCache.get(key);
    if (cached && cached.exp > Date.now()) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, cached.uri);
    }

    const uri = await places.resolvePhotoUri(name, w);
    if (!uri) return res.status(502).end();
    photoCache.set(key, { uri, exp: Date.now() + 45 * 60 * 1000 });
    res.set('Cache-Control', 'public, max-age=3600');
    return res.redirect(302, uri);
  } catch (err) {
    logger.warn('Places photo route error', { error: err.message });
    return res.status(502).end();
  }
});

// GET /api/places/details?placeId=&sessionToken=
router.get('/details', placesLimiter, async (req, res) => {
  try {
    if (!places.isConfigured()) return res.status(400).json({ message: 'Integración no configurada' });
    const { placeId, sessionToken } = req.query;
    if (!placeId) return res.status(400).json({ message: 'placeId requerido' });
    const det = await places.details(placeId, sessionToken);
    res.json({ details: det });
  } catch (err) {
    logger.warn('Places details route error', { error: err.message });
    res.status(502).json({ message: 'No se pudo obtener el detalle del lugar' });
  }
});

// POST /api/places/connect — vincula el negocio a un lugar de Google y prellena datos
// body: { placeId, sessionToken, businessId?, apply?: {address,hours,location,google} }
router.post('/connect', authMiddleware, async (req, res) => {
  try {
    if (!places.isConfigured()) return res.status(400).json({ message: 'Integración no configurada' });
    const { placeId, sessionToken } = req.body;
    if (!placeId) return res.status(400).json({ message: 'placeId requerido' });

    // Qué campos aplicar (por defecto todos, p.ej. registro). El panel manda flags explícitos.
    // Compat: si viene syncHours (legacy) lo respetamos para las horas.
    const apply = req.body.apply || {
      address: true,
      hours: req.body.syncHours !== false,
      location: true,
      google: true,
    };

    // businessId del token (o del body para superadmin)
    const businessId = req.user.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });

    const cfg = await BusinessConfig.findById(businessId);
    if (!cfg) return res.status(404).json({ message: 'Negocio no encontrado' });

    const det = await places.details(placeId, sessionToken);

    const changed = [];
    if (apply.address && det.address) { cfg.address = det.address; changed.push('address'); }
    if (apply.location && det.location && det.location.lat != null && det.location.lng != null) {
      cfg.location = {
        coordinates: { lat: det.location.lat, lng: det.location.lng },
        address: det.address || cfg.location?.address || '',
      };
      changed.push('location');
    }
    if (apply.hours && det.businessHours) {
      cfg.businessHours = det.businessHours;
      changed.push('businessHours');
    }
    if (apply.google) {
      if (det.mapsUrl) cfg.googleMapsUrl = det.mapsUrl;
      cfg.google = {
        placeId: det.placeId,
        rating: det.rating,
        reviewCount: det.reviewCount,
        reviewUrl: det.reviewUrl,
        mapsUrl: det.mapsUrl,
        website: det.website,
        reviews: det.reviews || [],
        photos: det.photos || [],
        syncedAt: new Date(),
      };
      changed.push('google');
    }

    await cfg.save();

    res.json({
      message: 'Negocio vinculado con Google',
      changed,
      google: cfg.google,
      preview: {
        name: det.name,
        address: det.address,
        phone: det.phone,
        rating: det.rating,
        reviewCount: det.reviewCount,
        businessHours: det.businessHours,
      },
    });
  } catch (err) {
    logger.error('Places connect error', { error: err.message });
    res.status(502).json({ message: 'No se pudo vincular con Google' });
  }
});

module.exports = router;
