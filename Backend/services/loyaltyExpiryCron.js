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
        if (tx.type === 'earn' && tx.expiresAt && tx.expiresAt <= now && tx.points > 0) {
          expiredPoints += tx.points;
          expiredTxIds.push(tx._id);
        }
      }

      if (expiredPoints <= 0) continue;

      // Zero out the expired earn transactions (set points to 0 so they don't expire again)
      for (const txId of expiredTxIds) {
        const tx = loyalty.transactions.id(txId);
        if (tx) tx.points = 0;
      }

      // Deduct expired points from balance (floor at 0)
      const actualDeduction = Math.min(expiredPoints, loyalty.points);
      loyalty.points = Math.max(0, loyalty.points - expiredPoints);

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
 * Start cron: runs daily at 3:00 AM Colombia (08:00 UTC)
 */
let _loyaltyCronRunning = false;
function startLoyaltyExpiryCron() {
  cron.schedule('0 8 * * *', async () => {
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
  });

  logger.info('🏆 Loyalty points expiry cron iniciado (3:00 AM Colombia / 08:00 UTC)');
}

module.exports = { startLoyaltyExpiryCron, expirePoints };
