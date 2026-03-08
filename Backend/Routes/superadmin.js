const express = require('express');
const router = express.Router();
const superadmin = require('../Controllers/superadmin');
const authMiddleware = require('../middleware/authSuperAdmin');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Rutas protegidas (requieren autenticación de superadmin)
router.use(authMiddleware.protectSuperAdmin);

// Crear nuevo negocio
router.post('/business', superadmin.crearNegocio);

// Listar negocios
router.get('/business', superadmin.listarNegocios);

// Activar/desactivar negocio
router.patch('/business/:id/activate', superadmin.activarNegocio);

// Toggle POS beta para un negocio
router.patch('/business/:id/pos-beta', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const negocio = await BusinessConfig.findByIdAndUpdate(
      id,
      { 'features.posBetaEnabled': !!enabled },
      { new: true }
    );
    if (!negocio) return res.status(404).json({ message: 'Negocio no encontrado' });
    const io = req.app.get('io');
    if (io) io.emit('businesses-updated');
    res.json(negocio);
  } catch (error) {
    logger.error('Error toggling POS beta', error);
    res.status(500).json({ message: 'Error al cambiar POS beta' });
  }
});

// Eliminar negocio
router.delete('/business/:id', superadmin.eliminarNegocio);

// ========== GESTIÓN DE PEDIDOS (SuperAdmin) ==========

const VALID_ORDER_STATUSES = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'ready', 'inProgress', 'completed', 'cancelled', 'delivered'];
const COMPLETED_STATUSES = ['completed', 'delivered', 'cancelled'];

// GET /api/superadmin/orders - Listar todos los pedidos de todos los negocios
router.get('/orders', async (req, res) => {
  try {
    const { status, businessId, collection: col, search } = req.query;

    // --- Active orders ---
    const activeQuery = {};
    if (status) activeQuery.status = status;
    if (businessId && mongoose.isValidObjectId(businessId)) activeQuery.businessId = new mongoose.Types.ObjectId(businessId);

    let activeOrders = [];
    if (!col || col === 'active') {
      activeOrders = await Order.find(activeQuery)
        .sort({ createdAt: -1 })
        .limit(200)
        .populate('businessId', 'businessName slug')
        .lean();
      activeOrders = activeOrders.map(o => ({ ...o, _collection: 'orders' }));
    }

    // --- Completed orders ---
    const completedQuery = {};
    if (status) completedQuery.status = status;
    if (businessId && mongoose.isValidObjectId(businessId)) completedQuery.businessId = new mongoose.Types.ObjectId(businessId);

    let completedOrders = [];
    if (!col || col === 'completed') {
      completedOrders = await CompletedOrder.find(completedQuery)
        .sort({ completedAt: -1 })
        .limit(200)
        .populate('businessId', 'businessName slug')
        .lean();
      completedOrders = completedOrders.map(o => ({ ...o, _collection: 'completedorders' }));
    }

    let allOrders = [...activeOrders, ...completedOrders];

    // Client-side search by customer name
    if (search) {
      const s = search.toLowerCase();
      allOrders = allOrders.filter(o => (o.customerName || '').toLowerCase().includes(s));
    }

    // Sort all by date descending
    allOrders.sort((a, b) => {
      const da = a.completedAt || a.createdAt || 0;
      const db = b.completedAt || b.createdAt || 0;
      return new Date(db) - new Date(da);
    });

    // Get business list for filter dropdown
    const businesses = await BusinessConfig.find({}, 'businessName slug').sort({ businessName: 1 }).lean();

    res.json({
      success: true,
      orders: allOrders,
      businesses: businesses.map(b => ({ id: b._id, name: b.businessName, slug: b.slug })),
      total: allOrders.length
    });
  } catch (error) {
    logger.error('Error fetching orders (superadmin)', error, req);
    res.status(500).json({ message: 'Error al obtener pedidos' });
  }
});

// PATCH /api/superadmin/orders/:id/status - Cambiar estado de un pedido
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, fromCollection } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'ID de pedido inválido' });
    }
    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido', validStatuses: VALID_ORDER_STATUSES });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    let order = null;
    let sourceCollection = fromCollection;

    // Try to find in orders first, then completedorders
    order = await Order.findById(objectId);
    if (order) {
      sourceCollection = 'orders';
    } else {
      order = await CompletedOrder.findById(objectId);
      if (order) sourceCollection = 'completedorders';
    }

    if (!order) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    const oldStatus = order.status;
    const shouldBeCompleted = COMPLETED_STATUSES.includes(status);
    const isCurrentlyInOrders = sourceCollection === 'orders';

    if (shouldBeCompleted && isCurrentlyInOrders) {
      // Move from orders -> completedorders
      const orderData = order.toObject();
      delete orderData._id;
      delete orderData.__v;
      orderData.status = status;
      orderData.completedAt = new Date();
      orderData.reportDate = new Date().toISOString().split('T')[0];

      const completedOrder = new CompletedOrder(orderData);
      await completedOrder.save();
      await Order.findByIdAndDelete(objectId);

      logger.info('SuperAdmin moved order to completed', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Pedido movido a completados con estado "${status}"`,
        order: { ...completedOrder.toObject(), _collection: 'completedorders' },
        moved: true
      });
    } else if (!shouldBeCompleted && !isCurrentlyInOrders) {
      // Move from completedorders -> orders (reactivating)
      const orderData = order.toObject();
      delete orderData._id;
      delete orderData.__v;
      delete orderData.completedAt;
      delete orderData.reportDate;
      delete orderData.includedInReport;
      orderData.status = status;

      const activeOrder = new Order(orderData);
      await activeOrder.save();
      await CompletedOrder.findByIdAndDelete(objectId);

      logger.info('SuperAdmin moved order back to active', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Pedido reactivado con estado "${status}"`,
        order: { ...activeOrder.toObject(), _collection: 'orders' },
        moved: true
      });
    } else {
      // Same collection, just update status
      order.status = status;
      if (shouldBeCompleted && !order.completedAt) {
        order.completedAt = new Date();
      }
      await order.save();

      logger.info('SuperAdmin updated order status', { orderId: id, oldStatus, newStatus: status });
      return res.json({
        success: true,
        message: `Estado actualizado a "${status}"`,
        order: { ...order.toObject(), _collection: sourceCollection },
        moved: false
      });
    }
  } catch (error) {
    logger.error('Error updating order status (superadmin)', error, req);
    res.status(500).json({ message: 'Error al actualizar pedido' });
  }
});

module.exports = router; 