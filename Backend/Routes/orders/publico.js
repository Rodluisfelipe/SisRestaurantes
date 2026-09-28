/**
 * Pedidos — Lo que usa el cliente desde el menú, sin sesión: seguimiento, mis pedidos,
 * cancelar a tiempo, comprobante de pago, cuenta abierta y "comprados juntos".
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const { emitirLlave, abreCuenta, pedidoParaCliente } = require("../../utils/cuentaCliente");
const { ObjectId } = require("mongoose").Types;
const socketService = require("../../services/socketService");
const { validateAndResolveBusinessId } = require("../../utils/businessValidator");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const { ORDER_STATUS } = require('../../utils/constants');
const authMiddleware = require('../../middleware/authMiddleware');
const { resolveBusinessId } = require('../../utils/businessResolver');
const { validatePaymentProof } = require('../../middleware/validators/orderValidators');
const path = require('path');
const sanitizeUpload = require('../../middleware/sanitizeUpload');
const { uploadProof, publicOrderLimiter } = require('./compartido');

// Upsell "se piden juntos" — productos más co-ordenados con los del carrito.
// Público (lo consume el menú del cliente). Fail-soft: ante cualquier error
// devuelve lista vacía y el frontend cae a su lógica por reglas.
router.get('/bought-together', publicOrderLimiter, async (req, res) => {
  try {
    const { businessId, productIds } = req.query;
    if (!businessId) return res.json({ productIds: [] });

    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) return res.json({ productIds: [] });
    const bizId = new ObjectId(businessResult.businessId);

    const ids = String(productIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => isValidObjectId(s))
      .map((s) => new ObjectId(s));
    if (!ids.length) return res.json({ productIds: [] });

    // Pedidos completados que contienen ALGUNO de los productos del carrito;
    // contamos los OTROS productos de esos pedidos por cantidad total.
    const rows = await CompletedOrder.aggregate([
      { $match: { businessId: bizId, 'items.productId': { $in: ids } } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $nin: ids, $ne: null } } },
      { $group: { _id: '$items.productId', count: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);

    res.json({ productIds: rows.map((r) => String(r._id)) });
  } catch (error) {
    logger.error('Error in bought-together', error);
    res.json({ productIds: [] });
  }
});

/* El cliente cancela su pedido recién hecho (la pantalla de confirmación da
   2 minutos). Con el token de seguimiento de ese pedido y solo si el negocio
   aún no lo tomó. Antes el botón llamaba a DELETE /:id, que es del personal:
   al cliente siempre le salía error. No se borra: queda cancelado y el
   negocio lo ve. */
const MINUTOS_PARA_CANCELAR = 2;

router.post('/:id/cancelar-cliente', publicOrderLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers['x-customer-token'] || req.body?.customerToken;
    if (!isValidObjectId(id) || !token) return res.status(400).json({ message: 'Datos incompletos' });
    const order = await Order.findById(id);
    if (!order || !order.customerToken || order.customerToken !== token) {
      return res.status(403).json({ message: 'No se pudo verificar el pedido' });
    }
    const edadMin = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    const cancelable = [ORDER_STATUS.PENDING, ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_UPLOADED].includes(order.status);
    if (!cancelable || edadMin > MINUTOS_PARA_CANCELAR) {
      return res.status(409).json({ message: 'El negocio ya está preparando tu pedido. Escríbele para cancelarlo.' });
    }
    order.status = ORDER_STATUS.CANCELLED;
    order.cancellationReason = 'Cancelado por el cliente';
    if (Array.isArray(order.statusHistory)) order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, timestamp: new Date() });
    await order.save();
    socketService.emitToBusiness(order.businessId.toString(), 'order_updated', order);
    socketService.emitToOrder(order._id, 'order_status_changed', { orderId: order._id, status: order.status, order });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('Error cancelling order by customer', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Track order by ID + customerToken (public endpoint) - MUST be before /:id
router.get('/track/:id', publicOrderLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    // Accept token from header (preferred) or query string (legacy)
    const token = req.headers['x-customer-token'] || req.query.token;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!token) {
      return res.status(401).json({ message: 'Token requerido' });
    }

    /* Completar un pedido lo archiva en CompletedOrder (con el mismo id): el
       seguimiento lo busca ahí también, o el cliente veía "no encontrado"
       justo cuando su pedido llegaba. */
    let order = await Order.findById(id).lean();
    if (!order) {
      const CompletedOrder = require('../../Models/CompletedOrder');
      order = await CompletedOrder.findById(id).lean();
    }
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.customerToken !== token) {
      return res.status(403).json({ message: 'Token inválido' });
    }

    /* La foto de cada producto: el pedido no la guarda, se busca en el
       catálogo para que el seguimiento muestre lo que pidió. */
    const Product = require('../../Models/Product');
    const ids = (order.items || []).map((i) => i.productId).filter(Boolean);
    const fotos = ids.length
      ? new Map((await Product.find({ _id: { $in: ids } }).select('image').lean()).map((p) => [String(p._id), p.image || '']))
      : new Map();

    // Return safe subset of order data for tracking
    const trackingData = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      orderChannel: order.orderChannel,
      customerName: order.customerName,
      items: order.items.map(i => ({
        name: i.name, quantity: i.quantity, price: i.price,
        image: (i.productId && fotos.get(String(i.productId))) || '',
        opciones: (i.selectedToppings || []).map((t) => t.optionName).filter(Boolean).slice(0, 4),
      })),
      tableNumber: order.tableNumber,
      deliveryPersonName: order.deliveryPersonId?.name || null,
      cancellationReason: order.cancellationReason || null,
      totalAmount: order.totalAmount,
      finalAmount: order.finalAmount,
      discountAmount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      paymentMethod: order.paymentMethod,
      paymentProof: order.paymentProof,
      statusHistory: order.statusHistory,
      messages: order.messages || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      // Quien tiene el token de seguimiento pidió desde este celular: su cuenta.
      ...(order.phone ? { cuentaToken: emitirLlave({ businessId: order.businessId, telefono: order.phone }) } : {}),
    };

    res.json(trackingData);
  } catch (error) {
    logger.error('Error tracking order', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ─── ORDER CHAT MESSAGES ────────────────────────────────────────────────

// Get my orders by phone + businessId (public endpoint) - MUST be before /:id
/* Los pedidos de un cliente: solo con la llave de su cuenta (ver
   utils/cuentaCliente). Antes bastaba el teléfono y la respuesta traía los
   pedidos completos, con el token de seguimiento incluido: cualquiera podía
   ver pedidos ajenos y subirles un comprobante de pago. */
router.get('/my-orders', publicOrderLimiter, async (req, res) => {
  try {
    const { phone, businessId } = req.query;

    if (!phone || !businessId) {
      return res.status(400).json({ message: 'phone y businessId son requeridos' });
    }

    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }

    const businessObjectId = businessResult.businessId;
    if (!abreCuenta(req, businessObjectId, phone)) {
      return res.status(401).json({ codigo: 'SIN_CUENTA', message: 'Tu cuenta se activa en este celular con tu primer pedido.' });
    }

    const [activeOrders, completedOrders] = await Promise.all([
      Order.find({
        businessId: businessObjectId,
        phone: phone,
        status: { $nin: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.DELIVERED] }
      }).sort({ createdAt: -1 }).limit(10).lean(),
      CompletedOrder.find({
        businessId: businessObjectId,
        phone: phone
      }).sort({ completedAt: -1 }).limit(10).lean(),
    ]);

    /* Se conservan los campos que ya leen las pantallas del menú (en inglés)
       y se quitan los internos: notas del personal, historial de cambios,
       domiciliario, datos de pago de la pasarela. */
    const seguro = (o) => {
      const p = pedidoParaCliente(o);
      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        orderType: o.orderType,
        orderChannel: o.orderChannel,
        items: o.items,
        totalAmount: o.totalAmount,
        finalAmount: o.finalAmount,
        deliveryFee: o.deliveryFee,
        discountAmount: o.discountAmount,
        couponCode: o.couponCode,
        paymentMethod: o.paymentMethod,
        phone: o.phone,
        address: o.address,
        cancellationReason: o.cancellationReason,
        autoExpired: o.autoExpired,
        tableNumber: o.tableNumber,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
        reviewed: o.reviewed,
        ...(p.seguimiento ? { customerToken: p.seguimiento } : {}),
      };
    };

    res.json({
      active: activeOrders.map(seguro),
      completed: completedOrders.map(seguro)
    });
  } catch (error) {
    logger.error('Error fetching my orders', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Cuenta abierta de una mesa — lectura PÚBLICA para el comensal que escaneó el
// QR de esa mesa. Devuelve solo lo consumido (qué, cuánto y el subtotal): nunca
// datos del cliente, del pago, ni de otras mesas.
// OJO: debe ir ANTES de "/:id", que lleva authMiddleware y capturaría esta ruta.
router.get('/open-tab', async (req, res) => {
  try {
    const { businessId: rawBiz, table } = req.query;
    if (!rawBiz || !table) {
      return res.status(400).json({ message: 'businessId y table son requeridos' });
    }
    let businessId;
    try { businessId = await resolveBusinessId(rawBiz); } catch { return res.json({ open: false }); }

    const order = await Order.findOne({
      businessId,
      posOpenTab: true,
      tableNumber: String(table).trim(),
      status: { $nin: ['completed', 'cancelled', 'delivered'] },
    }).select('orderNumber items totalAmount createdAt').lean();

    if (!order) return res.json({ open: false });

    res.set('Cache-Control', 'no-store');
    res.json({
      open: true,
      orderNumber: order.orderNumber,
      openedAt: order.createdAt,
      items: (order.items || []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        selectedToppings: (i.selectedToppings || []).map((t) => ({ optionName: t.optionName, price: t.price })),
      })),
      subtotal: order.totalAmount || 0,
    });
  } catch (e) {
    logger.error('open-tab error', { error: e.message });
    res.status(500).json({ open: false });
  }
});

// Upload payment proof (public - uses customerToken for auth)
router.post('/:id/payment-proof', (req, res, next) => {
  uploadProof.single('proof')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'La imagen es muy grande. Máximo 25MB.' });
      }
      if (err.message) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: 'Error al procesar la imagen. Intenta con otro archivo.' });
    }
    next();
  });
}, sanitizeUpload({ maxWidth: 1600, quality: 90 }), ...validatePaymentProof, async (req, res) => {
  try {
    const { id } = req.params;
    const { customerToken } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    if (!customerToken) {
      return res.status(401).json({ message: 'Token de cliente requerido' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Imagen del comprobante requerida' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    if (order.customerToken !== customerToken) {
      return res.status(403).json({ message: 'Token inválido' });
    }

    if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_UPLOADED].includes(order.status)) {
      return res.status(400).json({ message: 'Este pedido no requiere comprobante de pago en este momento' });
    }

    // Save proof path — scoped by order ID
    const safeOrderId = id.replace(/[^a-zA-Z0-9]/g, '');
    const proofPath = `/uploads/order-proofs/${safeOrderId}/${req.file.filename}`;
    
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        paymentProof: proofPath,
        paymentProofUploadedAt: new Date(),
        status: ORDER_STATUS.PAYMENT_UPLOADED,
        updatedAt: new Date(),
        $push: { statusHistory: { status: ORDER_STATUS.PAYMENT_UPLOADED, timestamp: new Date(), note: 'Comprobante de pago subido' } }
      },
      { new: true }
    );

    // Notify restaurant via socket
    socketService.emitToBusiness(order.businessId.toString(), 'payment_proof_uploaded', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      customerName: updatedOrder.customerName,
      paymentProof: proofPath,
      paymentMethod: updatedOrder.paymentMethod
    });

    // Push notification to restaurant
    try {
      const { sendPushToBusinessId } = require('../../services/pushService');
      await sendPushToBusinessId(order.businessId.toString(), {
        title: `💳 Comprobante recibido - Pedido #${updatedOrder.orderNumber}`,
        body: `${updatedOrder.customerName} ha subido su comprobante de pago`,
        data: { orderId: updatedOrder._id.toString(), type: 'payment_proof' }
      });
    } catch (pushErr) {
      logger.warn('Failed to send push for payment proof', { error: pushErr.message });
    }

    logger.info(`Payment proof uploaded for order ${updatedOrder.orderNumber}`);
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    logger.error('Error uploading payment proof', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
