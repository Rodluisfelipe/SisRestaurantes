const cron = require('node-cron');
const logger = require('../utils/logger');
const BusinessConfig = require('../Models/BusinessConfig');
const places = require('./googlePlaces');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Refresca el snapshot de Google (rating, reseñas, fotos) de todos los negocios
 * vinculados. Se corre a diario para mantener el menú al día sin gastar cuota
 * en cada visita.
 */
async function runGoogleRefresh() {
  if (!places.isConfigured()) {
    logger.warn('Google refresh omitido: GOOGLE_PLACES_API_KEY no configurada');
    return { refreshed: 0, total: 0 };
  }

  const businesses = await BusinessConfig.find(
    { 'google.placeId': { $nin: ['', null] } },
    '_id slug google.placeId'
  ).lean();

  let refreshed = 0;
  for (const b of businesses) {
    try {
      const det = await places.details(b.google.placeId);
      await BusinessConfig.updateOne(
        { _id: b._id },
        {
          $set: {
            googleMapsUrl: det.mapsUrl || '',
            'google.rating': det.rating,
            'google.reviewCount': det.reviewCount,
            'google.reviewUrl': det.reviewUrl,
            'google.mapsUrl': det.mapsUrl,
            'google.website': det.website,
            'google.reviews': det.reviews || [],
            'google.photos': det.photos || [],
            'google.syncedAt': new Date(),
          },
        }
      );
      refreshed++;
      await sleep(400); // gentil con la cuota de Google
    } catch (e) {
      logger.warn('Google refresh falló para un negocio', { slug: b.slug, error: e.message });
    }
  }

  logger.info(`Google refresh: ${refreshed}/${businesses.length} negocios actualizados`);
  return { refreshed, total: businesses.length };
}

function startGoogleRefreshCron() {
  // Todos los días a las 4:00 AM Colombia
  cron.schedule('0 4 * * *', () => {
    runGoogleRefresh().catch(e => logger.error('Google refresh cron error', e));
  }, { timezone: 'America/Bogota' });
  logger.info('Google refresh cron started (diario 4am COL)');
}

module.exports = { startGoogleRefreshCron, runGoogleRefresh };
