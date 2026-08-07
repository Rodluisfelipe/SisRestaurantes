const cron = require('node-cron');
const CustomerLoyalty = require('../Models/CustomerLoyalty');
const LoyaltyProgram = require('../Models/LoyaltyProgram');
const logger = require('../utils/logger');
const { trackRun } = require('./cronRegistry');

/**
 * Expire loyalty points whose expiresAt has passed.
 * For each CustomerLoyalty doc with expired earn transactions,
 * deducts the expired points and logs an 'expire' transaction.
 */
async function expirePoints() {
  try {
    const now = new Date();
    let totalExpired = 0;
    let customersAffected = 0;

    // Find all loyalty profiles that have at least one expired 'earn' transaction
    const loyalties = await CustomerLoyalty.find({
      'transactions.expiresAt': { $lte: now },
      'transactions.type': 'earn'
    });

    for (const loyalty of loyalties) {
      let expiredPoints = 0;
      const expiredTxIds = [];

      for (const tx of loyalty.transactions) {
        // Only expire 'earn' transactions that have an expiresAt in the past
        // and haven't already been expired (check by marking them)
        if (tx.type === 'earn' && tx.expiresAt && tx.expiresAt <= now && tx.points > 0 && !tx.expired) {
          expiredPoints += tx.points;
          expiredTxIds.push(tx._id);
        }
      }

      if (expiredPoints <= 0) continue;

      /* Se MARCA la transacción como vencida en vez de ponerle los puntos en
         cero. Ponerla en cero borraba cuántos puntos se habían ganado, y como
         además se añadía una línea de expiración negativa, el mismo descuento
         quedaba contado dos veces: el historial dejaba de sumar el saldo y no
         había forma de auditar por qué. */
      for (const txId of expiredTxIds) {
        const tx = loyalty.transactions.id(txId);
        if (tx) tx.expired = true;
      }

      /* Solo se descuenta lo que realmente había. Si el saldo era menor que lo
         vencido —porque ya se había gastado— se descuenta el saldo y la línea
         de expiración registra esa misma cifra, no la teórica: así el
         historial sigue sumando el saldo. */
      const actualDeduction = Math.min(expiredPoints, loyalty.points);
      loyalty.points = Math.max(0, loyalty.points - actualDeduction);

      // Log the expiry transaction
      loyalty.transactions.push({
        type: 'expire',
        points: -actualDeduction,
        description: `${actualDeduction} punto(s) expirado(s) automáticamente`,
        createdAt: now
      });

      loyalty.lastActivityAt = now;
      await loyalty.save();

      totalExpired += actualDeduction;
      customersAffected++;
    }

    if (totalExpired > 0) {
      logger.info(`[LoyaltyExpiry] ${totalExpired} punto(s) expirado(s) de ${customersAffected} cliente(s)`);
    }

    return { totalExpired, customersAffected };
  } catch (error) {
    logger.error('[LoyaltyExpiry] Error expirando puntos:', error);
    return { totalExpired: 0, customersAffected: 0 };
  }
}

/**
 * Start cron: runs daily at 3:00 AM Colombia.
 *
 * La hora se declara por zona horaria y no como "08:00 UTC": antes dependía
 * de que el contenedor corriera en UTC, así que fijarle un TZ para cualquier
 * otra cosa habría movido la expiración de puntos cinco horas en silencio.
 */
let _loyaltyCronRunning = false;
function startLoyaltyExpiryCron() {
  cron.schedule('0 3 * * *', async () => {
    if (_loyaltyCronRunning) {
      logger.warn('[LoyaltyExpiry] Previous run still in progress — skipping');
      return;
    }
    _loyaltyCronRunning = true;
    try {
      logger.info('[LoyaltyExpiry] Ejecutando expiración diaria de puntos...');
      await trackRun('loyaltyExpiry', expirePoints);
    } finally {
      _loyaltyCronRunning = false;
    }
  }, { timezone: 'America/Bogota' });

  logger.info('🏆 Loyalty points expiry cron iniciado (3:00 AM Colombia)');
}

module.exports = { startLoyaltyExpiryCron, expirePoints };
