const cron = require('node-cron');
const logger = require('../utils/logger');
const { trackRun } = require('./cronRegistry');
const { runBackup } = require('../scripts/backup-db');

/**
 * Respaldo diario de la base a DigitalOcean Spaces.
 *
 * Corre dentro del servidor y no como cron del sistema porque el contenedor
 * cambia de nombre en cada despliegue solapado (backend-blue / backend-green),
 * y un `docker exec` con nombre fijo se rompería. Además así hereda el candado
 * de trackRun, que evita que se dispare dos veces durante el solape.
 *
 * A las 4:30 a. m. hora Colombia: después del cierre del día (medianoche) y de
 * la expiración de puntos (3:00), para que el volcado incluya el resultado de
 * ambos y no una foto a medias.
 */
function startBackupCron() {
  cron.schedule('30 4 * * *', async () => {
    logger.info('[Backup] Iniciando respaldo diario de la base...');
    try {
      await trackRun('dbBackup', runBackup);
    } catch (err) {
      // trackRun ya lo registró y lo logueó; aquí solo se evita que una
      // promesa rechazada tumbe el proceso.
      logger.error('[Backup] El respaldo diario falló', err);
    }
  }, { timezone: 'America/Bogota' });

  logger.info('💾 Backup cron iniciado (4:30 a. m. Colombia)');
}

module.exports = { startBackupCron };
