/**
 * orderCompletionService — shared logic to finalize a delivered order.
 *
 * Before this service existed, the "mark delivered" flow was duplicated in
 * deliveryPublic.js (QR + domi) and *partially missing* in deliveryPartners.js
 * (partner deliveries never reached CompletedOrder nor the cash register).
 * Every delivery completion now goes through finalizeDeliveredOrder().
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Release a driver after their delivery ends (delivered OR cancelled/failed):
 * decrement activeDeliveries (never below 0), set available when no load left,
 * and increment totalDeliveries only on successful deliveries.
 */
async function releaseDriver(deliveryPersonId, { delivered = true } = {}) {
  if (!deliveryPersonId) return;
  const DeliveryPerson = require('../Models/DeliveryPerson');
  try {
    // Guarded decrement — $inc alone could drive the load factor negative
    await DeliveryPerson.updateOne(
      { _id: deliveryPersonId, activeDeliveries: { $gt: 0 } },
      { $inc: { activeDeliveries: -1 } }
    );
    const update = delivered ? { $inc: { totalDeliveries: 1 } } : {};
    const driver = await DeliveryPerson.findByIdAndUpdate(
      deliveryPersonId,
      { ...update },
      { new: true }
    ).select('activeDeliveries status').lean();
    // Only mark available when they have no other active deliveries
    if (driver && (driver.activeDeliveries || 0) <= 0 && driver.status !== 'available') {
      await DeliveryPerson.updateOne({ _id: deliveryPersonId }, { $set: { status: 'available' } });
    }
  } catch (err) {
    logger.warn('releaseDriver failed', { error: err.message, deliveryPersonId: String(deliveryPersonId) });
  }
}

/**
 * Register the sale in the open cash register (if any). POS orders are excluded
 * because the POS registers its own movements.
 */
async function registerCashSale(order) {
  if (order.orderChannel === 'pos') return;
  try {
    const CashRegister = require('../Models/CashRegister');
    await CashRegister.findOneAndUpdate(
      { businessId: order.businessId, status: 'open' },
      { $push: { movements: {
        type: 'sale',
        amount: order.finalAmount || order.totalAmount,
        paymentMethod: order.paymentMethod || 'cash',
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderChannel: 'menuby',
        description: `MenuBy #${order.orderNumber} - ${order.customerName}`,
        createdAt: new Date()
      }}}
    );
  } catch (err) {
    logger.warn('Failed to register delivery sale in cash register', { error: err.message, orderId: String(order._id) });
  }
}

/**
 * Move an active Order into the CompletedOrder collection atomically.
 * Deletes the payment proof file first. Returns true if the move succeeded.
 */
async function moveOrderToCompleted(order) {
  const Order = require('../Models/Order');
  const CompletedOrder = require('../Models/CompletedOrder');
  const socketService = require('./socketService');

  const orderData = order.toObject ? order.toObject() : { ...order };

  if (orderData.paymentProof) {
    try {
      const proofFilePath = path.join(__dirname, '..', orderData.paymentProof);
      if (fs.existsSync(proofFilePath)) fs.unlinkSync(proofFilePath);
    } catch (fileErr) {
      logger.warn('Could not delete payment proof file', { error: fileErr.message });
    }
  }

  const completedOrder = new CompletedOrder({
    ...orderData,
    paymentProof: null,
    completedAt: new Date(),
    status: 'completed'
  });

  const session = await mongoose.startSession();
  let moveSucceeded = false;
  try {
    await session.withTransaction(async () => {
      await completedOrder.save({ session });
      await Order.findByIdAndDelete(order._id, { session });
    });
    moveSucceeded = true;
  } catch (txErr) {
    logger.error('Transaction failed for delivery completion — order preserved in active', { error: txErr.message, orderId: String(order._id) });
  } finally {
    session.endSession();
  }

  if (moveSucceeded) {
    setTimeout(() => {
      socketService.emitToBusiness(order.businessId.toString(), 'order_deleted', { _id: order._id });
    }, 3000);
  }
  return moveSucceeded;
}

/**
 * Finalize an order that was just marked delivered (order must already be
 * saved with status 'delivered' + deliveredAt). Releases the driver, emits
 * the realtime events, registers the sale and archives the order.
 */
async function finalizeDeliveredOrder(order) {
  const socketService = require('./socketService');

  await releaseDriver(order.deliveryPersonId, { delivered: true });
  if (order.deliveryPersonId) {
    socketService.emitToBusiness(order.businessId, 'domi:status', {
      deliveryPersonId: order.deliveryPersonId,
      status: 'available'
    });
  }

  socketService.emitToBusiness(order.businessId, 'orderUpdated', order.toObject ? order.toObject() : order);
  socketService.emitToBusiness(order.businessId, 'delivery:confirmed', {
    orderId: order._id,
    deliveryPersonId: order.deliveryPersonId || null,
    deliveredAt: order.deliveredAt
  });
  socketService.emitToOrder(order._id, 'order:status', { status: 'delivered', updatedAt: order.deliveredAt });
  socketService.emitToOrder(order._id, 'delivery:confirmed', { deliveredAt: order.deliveredAt });

  await moveOrderToCompleted(order);
  await registerCashSale(order);
}

module.exports = {
  releaseDriver,
  registerCashSale,
  moveOrderToCompleted,
  finalizeDeliveredOrder,
};
