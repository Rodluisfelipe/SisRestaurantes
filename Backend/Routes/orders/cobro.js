/**
 * Pedidos — Cobrar: cuenta abierta de mesa, confirmar o rechazar un pago por comprobante.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const socketService = require("../../services/socketService");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const { ORDER_STATUS } = require('../../utils/constants');
const { tenantAuth } = require('../../middleware/tenantAuth');
const { validateConfirmPayment, validateRejectPayment } = require('../../middleware/validators/orderValidators');

// Cobrar una cuenta abierta de mesa (POS): aplica pago + propina + descuento,
// registra la venta en la caja (canal 'pos', una sola vez) y completa la orden.
router.patch("/:id/pay-tab", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({
      _id: id,
      ...(tenantBizId ? { businessId: tenantBizId } : {})
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.orderChannel !== 'pos') {
      return res.status(400).json({ message: "Solo se pueden cobrar cuentas del POS" });
    }
    if (['completed', 'cancelled', 'delivered'].includes(order.status)) {
      return res.status(400).json({ message: "Esta cuenta ya fue cerrada" });
    }

    const paymentMethod = req.body.paymentMethod || 'cash';
    const tipAmount = Math.max(0, Math.round(parseFloat(req.body.tipAmount) || 0));
    const base = (order.totalAmount || 0) + (order.deliveryFee || 0);
    const manualDiscount = Math.max(0, Math.round(parseFloat(req.body.discountAmount) || 0));
    const discountAmount = Math.min(manualDiscount, base);
    const finalAmount = Math.max(0, base - discountAmount + tipAmount);

    order.paymentMethod = paymentMethod;
    order.tipAmount = tipAmount;
    order.discountAmount = discountAmount;
    order.finalAmount = finalAmount;
    order.posOpenTab = false;
    if (req.body.posPaymentInfo) order.posPaymentInfo = req.body.posPaymentInfo;
    order.status = 'completed';
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: 'completed', timestamp: new Date(), note: 'Cuenta cobrada (POS)' });
    order.updatedAt = new Date();
    await order.save();

    // Registrar la venta POS en la caja abierta (una sola vez, canal 'pos')
    try {
      const CashRegister = require('../../Models/CashRegister');
      await CashRegister.findOneAndUpdate(
        { businessId: order.businessId, status: 'open' },
        { $push: { movements: {
          type: 'sale',
          amount: finalAmount,
          paymentMethod: paymentMethod || 'cash',
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderChannel: 'pos',
          description: `Venta POS #${order.orderNumber} - ${order.customerName}`,
          createdAt: new Date()
        }}}
      );
    } catch (cashErr) {
      logger.warn('Failed to register tab sale in cash register', { error: cashErr.message, orderId: order._id });
    }

    // Mover a CompletedOrder + emitir (registerCashSale salta POS, sin doble conteo)
    try {
      const { moveOrderToCompleted } = require('../../services/orderCompletionService');
      await moveOrderToCompleted(order);
    } catch (moveErr) {
      logger.warn('Failed to move paid tab to completed', { error: moveErr.message, orderId: order._id });
      socketService.emitToBusiness(order.businessId.toString(), "order_updated", order);
    }

    res.json({ success: true, order });
  } catch (error) {
    logger.error('Error paying tab', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Confirm payment (admin only)
router.patch('/:id/confirm-payment', tenantAuth, validateConfirmPayment, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Compound query ensures tenant isolation
    const tenantBizIdPay = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizIdPay ? { businessId: tenantBizIdPay } : {}) });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.status !== ORDER_STATUS.PAYMENT_UPLOADED) {
      return res.status(400).json({ message: `No se puede confirmar pago en estado "${order.status}"` });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdPay ? { businessId: tenantBizIdPay } : {}) },
      {
        status: ORDER_STATUS.PAYMENT_CONFIRMED,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PAYMENT_CONFIRMED, timestamp: new Date(), note: note || 'Pago confirmado por el restaurante' } }
      },
      { new: true }
    );

    // Emit socket event for order update
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'order_updated', updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: ORDER_STATUS.PAYMENT_CONFIRMED, order: updatedOrder });

    // Also emit specific event for customer tracking
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'payment_confirmed', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      status: ORDER_STATUS.PAYMENT_CONFIRMED
    });

    logger.info(`Payment confirmed for order ${updatedOrder.orderNumber}`);

    // Push notification to customer
    try {
      const { sendCustomerOrderStatusPush } = require('../../services/pushService');
      await sendCustomerOrderStatusPush(updatedOrder, ORDER_STATUS.PAYMENT_CONFIRMED);
    } catch (pushErr) {
      logger.warn('Failed to send customer push for payment confirmed', { error: pushErr.message });
    }

    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error confirming payment', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Reject payment (admin only)
router.patch('/:id/reject-payment', tenantAuth, validateRejectPayment, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    // Compound query ensures tenant isolation
    const tenantBizIdRej = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizIdRej ? { businessId: tenantBizIdRej } : {}) });
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.status !== ORDER_STATUS.PAYMENT_UPLOADED) {
      return res.status(400).json({ message: `No se puede rechazar pago en estado "${order.status}"` });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdRej ? { businessId: tenantBizIdRej } : {}) },
      {
        status: ORDER_STATUS.PENDING_PAYMENT,
        paymentProof: null,
        paymentProofUploadedAt: null,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PENDING_PAYMENT, timestamp: new Date(), note: reason || 'Comprobante rechazado - sube uno nuevo' } }
      },
      { new: true }
    );

    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'order_updated', updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });
    socketService.emitToBusiness(updatedOrder.businessId.toString(), 'payment_rejected', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      reason: reason || 'Comprobante rechazado'
    });

    logger.info(`Payment rejected for order ${updatedOrder.orderNumber}: ${reason}`);

    // Push notification to customer about rejection
    try {
      const { sendPushToCustomer } = require('../../services/pushService');
      if (updatedOrder.customerToken) {
        await sendPushToCustomer(updatedOrder.customerToken, {
          title: `⚠️ Pedido #${updatedOrder.orderNumber} - Comprobante rechazado`,
          body: reason || 'Tu comprobante fue rechazado. Por favor sube uno nuevo.',
          clickUrl: '/',
          data: { orderId: updatedOrder._id.toString(), orderNumber: updatedOrder.orderNumber, status: ORDER_STATUS.PENDING_PAYMENT }
        });
      }
    } catch (pushErr) {
      logger.warn('Failed to send customer push for payment rejected', { error: pushErr.message });
    }

    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error rejecting payment', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
