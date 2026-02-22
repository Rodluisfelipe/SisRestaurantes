const cron = require('node-cron');
const Order = require('../Models/Order');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * Servicio de limpieza automática de pedidos abandonados/expirados.
 * 
 * Cancela automáticamente pedidos que llevan demasiado tiempo en estados pendientes:
 * - pending_payment: 1 hora (el cliente no subió comprobante)
 * - pending: 30 minutos (pedido creado pero no procesado)  
 * - payment_uploaded: 24 horas (subió comprobante pero nunca se confirmó)
 * - cancelled: eliminación después de 2 horas (ya no sirven)
 *
 * Ejecuta cada 10 minutos.
 */

// Timeouts por estado (en milisegundos)
const EXPIRATION_RULES = {
  pending_payment: 60 * 60 * 1000,         // 1 hora
  pending: 30 * 60 * 1000,                 // 30 minutos
  payment_uploaded: 24 * 60 * 60 * 1000,   // 24 horas
};

// Pedidos cancelados se eliminan después de este tiempo
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
            status: 'cancelled',
            updatedAt: now,
            $push: { 
              statusHistory: { 
                status: 'cancelled', 
                timestamp: now, 
                note: `Auto-expirado: ${ageMinutes} min en estado ${status}` 
              } 
            }
          });

          // Notificar al panel admin por socket
          socketService.emitToBusiness(
            order.businessId.toString(), 
            'order_updated', 
            { _id: order._id, status: 'cancelled', autoExpired: true }
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
 * Elimina pedidos cancelados antiguos de la BD
 */
async function cleanupCancelledOrders() {
  try {
    const cutoff = new Date(Date.now() - CANCELLED_CLEANUP_AFTER);
    
    const result = await Order.deleteMany({
      status: 'cancelled',
      updatedAt: { $lt: cutoff }
    });

    if (result.deletedCount > 0) {
      console.log(`[OrderCleanup] ${result.deletedCount} pedido(s) cancelados eliminados de la BD`);
      logger.info(`[OrderCleanup] ${result.deletedCount} cancelled orders cleaned up`);
    }

    return result.deletedCount;
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
 * Inicia el cron job de limpieza de pedidos
 * Ejecuta cada 10 minutos
 */
function startOrderCleanupCron() {
  // Ejecutar inmediatamente al iniciar para limpiar pedidos stale existentes
  setTimeout(() => {
    runCleanup().then(({ expired, cleaned }) => {
      if (expired > 0 || cleaned > 0) {
        console.log(`[OrderCleanup] Limpieza inicial: ${expired} expirados, ${cleaned} eliminados`);
      }
    }).catch(err => {
      logger.error('[OrderCleanup] Error en limpieza inicial:', err);
    });
  }, 10000); // Esperar 10s después del inicio para que MongoDB esté listo

  // Cron: cada 10 minutos
  cron.schedule('*/10 * * * *', async () => {
    await runCleanup();
  });

  console.log('🧹 Order cleanup cron iniciado (cada 10 minutos)');
}

module.exports = { startOrderCleanupCron, runCleanup, expireStaleOrders, cleanupCancelledOrders };
