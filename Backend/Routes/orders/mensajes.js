/**
 * Pedidos — Chat del pedido entre el cliente y el negocio.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const Customer = require("../../Models/Customer");
const socketService = require("../../services/socketService");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const { tenantAuth } = require('../../middleware/tenantAuth');
const { stripHtml } = require('../../utils/sanitize');
const { chatLimiter } = require('./compartido');

// Customer sends a message (public, token-based auth)
router.post('/:id/messages/customer', chatLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers['x-customer-token'] || req.body.customerToken;
    const { text } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid order ID' });
    if (!token) return res.status(401).json({ message: 'Token requerido' });
    if (!text || !text.trim() || text.trim().length > 500) return res.status(400).json({ message: 'Mensaje inválido (1-500 caracteres)' });

    const order = await Order.findById(id);
    if (!order || order.customerToken !== token) return res.status(403).json({ message: 'Token inválido' });
    if (['completed', 'delivered', 'cancelled'].includes(order.status)) return res.status(400).json({ message: 'No se pueden enviar mensajes a pedidos finalizados' });

    const message = { sender: 'customer', text: stripHtml(text.trim()), timestamp: new Date() };
    order.messages.push(message);
    order.updatedAt = new Date();
    await order.save();

    const saved = order.messages[order.messages.length - 1];
    socketService.emitToOrder(id, 'order_message', { orderId: id, message: saved });
    socketService.emitToBusiness(order.businessId.toString(), 'order_message', { orderId: id, message: saved });

    res.status(201).json(saved);
  } catch (error) {
    logger.error('Error sending customer message', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Business sends a message (admin auth)
router.post('/:id/messages/business', tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid order ID' });
    if (!text || !text.trim() || text.trim().length > 500) return res.status(400).json({ message: 'Mensaje inválido (1-500 caracteres)' });

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({ _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) });
    if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
    if (['completed', 'delivered', 'cancelled'].includes(order.status)) return res.status(400).json({ message: 'No se pueden enviar mensajes a pedidos finalizados' });

    const message = { sender: 'business', text: stripHtml(text.trim()), timestamp: new Date() };
    order.messages.push(message);
    order.updatedAt = new Date();
    await order.save();

    const saved = order.messages[order.messages.length - 1];
    socketService.emitToOrder(id, 'order_message', { orderId: id, message: saved });
    socketService.emitToBusiness(order.businessId.toString(), 'order_message', { orderId: id, message: saved });

    res.status(201).json(saved);
  } catch (error) {
    logger.error('Error sending business message', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
