const cron = require('node-cron');
const Order = require('../Models/Order');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');
const { ORDER_STATUS } = require('../utils/constants');

/**
 * Servicio de cierre automático de pedidos a medianoche (hora Colombia).
 * 
 * A las 12:00 AM (UTC-5) cancela pedidos que llevan más de 1 hora en estados pendientes.
 * Esto simula un "cierre de día" automático.
 */

// Pedidos con más de 1 hora en estos estados se cancelan a medianoche
const EXPIRATION_RULES = {
  pending_payment: 60 * 60 * 1000,         // 1 hora
  pending: 60 * 60 * 1000,                 // 1 hora
  payment_uploaded: 60 * 60 * 1000,        // 1 hora
};

// Pedidos cancelados se archivan después de este tiempo (soft-delete)
const CANCELLED_CLEANUP_AFTER = 2 * 60 * 60 * 1000; // 2 horas

/**
 * Busca y cancela pedidos expirados en estados pendientes
 */
async function expireStaleOrders() {
  try {
    const now = new Date();
    let totalExpired = 0;

    for (const [status, maxAge] of Object.entries(EXPIRATION_RULES)) {
      const cutoff = new Date(now.getTime() - maxAge);
      
      // Buscar pedidos expirados
      const staleOrders = await Order.find({
        status: status,
        createdAt: { $lt: cutoff }
      }).select('_id orderNumber businessId customerName status createdAt');

      if (staleOrders.length === 0) continue;

      // Cancelar cada pedido expirado
      for (const order of staleOrders) {
        try {
          const ageMinutes = Math.round((now - order.createdAt) / 60000);
          
          await Order.findByIdAndUpdate(order._id, {
            status: ORDER_STATUS.CANCELLED,
            updatedAt: now,
            $push: { 
              statusHistory: { 
                status: ORDER_STATUS.CANCELLED, 
                timestamp: now, 
                note: `Auto-expirado: ${ageMinutes} min en estado ${status}` 
              } 
            }
          });

          // Notificar al panel admin por socket
          socketService.emitToBusiness(
            order.businessId.toString(), 
            'order_updated', 
            { _id: order._id, status: ORDER_STATUS.CANCELLED, autoExpired: true }
          );

          totalExpired++;
          logger.info(`[OrderCleanup] Pedido #${order.orderNumber} auto-expirado: ${ageMinutes}min en ${status}`);
        } catch (err) {
          logger.error(`[OrderCleanup] Error expirando pedido ${order._id}:`, err);
        }
      }
    }

    if (totalExpired > 0) {
      console.log(`[OrderCleanup] ${totalExpired} pedido(s) auto-expirado(s)`);
    }

    return totalExpired;
  } catch (error) {
    logger.error('[OrderCleanup] Error en expireStaleOrders:', error);
    return 0;
  }
}

/**
 * Archiva pedidos cancelados antiguos (soft-delete para auditoría)
 */
async function cleanupCancelledOrders() {
  try {
    const cutoff = new Date(Date.now() - CANCELLED_CLEANUP_AFTER);
    
    // Soft-delete: mark as archived instead of permanently deleting
    // Preserves data for auditing/accounting while cleaning up the active orders view
    const result = await Order.updateMany(
      {
        status: ORDER_STATUS.CANCELLED,
        updatedAt: { $lt: cutoff },
        _archived: { $ne: true }
      },
      {
        $set: { _archived: true, _archivedAt: new Date() }
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[OrderCleanup] ${result.modifiedCount} cancelled orders archived (soft-deleted)`);
    }

    return result.modifiedCount;
  } catch (error) {
    logger.error('[OrderCleanup] Error en cleanupCancelledOrders:', error);
    return 0;
  }
}

/**
 * Ejecuta ambas tareas de limpieza
 */
async function runCleanup() {
  const expired = await expireStaleOrders();
  const cleaned = await cleanupCancelledOrders();
  return { expired, cleaned };
}

/**
 * Inicia el cron de cierre automático a medianoche Colombia (UTC-5)
 */
function startOrderCleanupCron() {
  // Cron: todos los días a las 00:00 hora Colombia (05:00 UTC)
  cron.schedule('0 5 * * *', async () => {
    logger.info('[OrderCleanup] Cierre automático de medianoche (Colombia)');
    await runCleanup();
  });

  console.log('🧹 Order cleanup cron iniciado (medianoche Colombia / 05:00 UTC)');
}

module.exports = { startOrderCleanupCron, runCleanup, expireStaleOrders, cleanupCancelledOrders };
