const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SupplierOrder = require('../Models/SupplierOrder');
const BusinessConfig = require('../Models/BusinessConfig');
const Product = require('../Models/Product');
const authMiddleware = require('../middleware/authMiddleware');
const authSuperAdmin = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');

// POST /api/supplier-orders — restaurante crea un pedido a un proveedor
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { supplierBusinessId, items, deliveryAddress, buyerNote } = req.body;
    const buyerBusinessId = req.user.businessId;

    if (!supplierBusinessId || !items?.length) {
      return res.status(400).json({ message: 'Proveedor e items son requeridos' });
    }

    const [buyer, supplier] = await Promise.all([
      BusinessConfig.findById(buyerBusinessId, 'businessName').lean(),
      BusinessConfig.findOne({ _id: supplierBusinessId, isSupplier: true, isActive: true }, 'businessName').lean()
    ]);

    if (!supplier) return res.status(404).json({ message: 'Proveedor no encontrado o no activo' });

    // Validar productos y calcular total
    const productIds = items.map(i => i.productId);
    const products = await Product.find(
      { _id: { $in: productIds }, businessId: supplierBusinessId, active: true },
      'name price'
    ).lean();
    const productMap = Object.fromEntries(products.map(p => [String(p._id), p]));

    const enrichedItems = [];
    let total = 0;
    for (const item of items) {
      const prod = productMap[String(item.productId)];
      if (!prod) return res.status(400).json({ message: `Producto ${item.productId} no válido` });
      const qty = Math.max(1, Number(item.qty) || 1);
      enrichedItems.push({
        productId: prod._id,
        name: prod.name,
        unit: item.unit || 'unidad',
        qty,
        unitPrice: prod.price
      });
      total += prod.price * qty;
    }

    const order = await SupplierOrder.create({
      buyerBusinessId,
      buyerBusinessName: buyer?.businessName || 'Negocio',
      supplierBusinessId,
      supplierBusinessName: supplier.businessName,
      items: enrichedItems,
      total,
      deliveryAddress: deliveryAddress || '',
      buyerNote: buyerNote || ''
    });

    // Notificar via socket al superadmin de nueva orden pendiente
    const io = req.app.get('io');
    if (io) io.emit('supplier-order-new', { orderId: order._id, supplierName: supplier.businessName });

    res.status(201).json({ success: true, order });
  } catch (error) {
    logger.error('Error creating supplier order', error, req);
    res.status(500).json({ message: 'Error al crear el pedido' });
  }
});

// GET /api/supplier-orders/outgoing — pedidos que hizo el restaurante
router.get('/outgoing', authMiddleware, async (req, res) => {
  try {
    const orders = await SupplierOrder.find({ buyerBusinessId: req.user.businessId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, orders });
  } catch (error) {
    logger.error('Error fetching outgoing supplier orders', error, req);
    res.status(500).json({ message: 'Error al obtener pedidos' });
  }
});

// GET /api/supplier-orders/incoming — pedidos recibidos por el proveedor
router.get('/incoming', authMiddleware, async (req, res) => {
  try {
    const supplier = await BusinessConfig.findById(req.user.businessId, 'isSupplier').lean();
    if (!supplier?.isSupplier) {
      return res.status(403).json({ message: 'Este negocio no es proveedor' });
    }
    const orders = await SupplierOrder.find({ supplierBusinessId: req.user.businessId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, orders });
  } catch (error) {
    logger.error('Error fetching incoming supplier orders', error, req);
    res.status(500).json({ message: 'Error al obtener pedidos' });
  }
});

// PATCH /api/supplier-orders/:id/approve — SuperAdmin aprueba la orden
router.patch('/:id/approve', authSuperAdmin.protectSuperAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const order = await SupplierOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'pending_approval') {
      return res.status(400).json({ message: `La orden está en estado "${order.status}"` });
    }
    order.status = 'approved';
    order.approvedAt = new Date();
    order.approvedBy = req.user?.email || 'superadmin';
    if (note) order.superadminNote = note;
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.to(String(order.supplierBusinessId)).emit('supplier-order-approved', { orderId: order._id });
      io.to(String(order.buyerBusinessId)).emit('supplier-order-approved', { orderId: order._id });
    }

    res.json({ success: true, order });
  } catch (error) {
    logger.error('Error approving supplier order', error, req);
    res.status(500).json({ message: 'Error al aprobar la orden' });
  }
});

// PATCH /api/supplier-orders/:id/cancel — SuperAdmin cancela la orden
router.patch('/:id/cancel', authSuperAdmin.protectSuperAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const order = await SupplierOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: `No se puede cancelar una orden en estado "${order.status}"` });
    }
    order.status = 'cancelled';
    if (note) order.superadminNote = note;
    await order.save();
    res.json({ success: true, order });
  } catch (error) {
    logger.error('Error cancelling supplier order', error, req);
    res.status(500).json({ message: 'Error al cancelar la orden' });
  }
});

// PATCH /api/supplier-orders/:id/status — proveedor actualiza estado (processing/delivered)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['processing', 'delivered'];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ message: 'Estado no válido para el proveedor' });
    }
    const order = await SupplierOrder.findOne({
      _id: req.params.id,
      supplierBusinessId: req.user.businessId
    });
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    if (order.status !== 'approved' && status === 'processing') {
      return res.status(400).json({ message: 'La orden debe estar aprobada para procesarla' });
    }
    if (order.status !== 'processing' && status === 'delivered') {
      return res.status(400).json({ message: 'La orden debe estar en procesamiento para marcarla como entregada' });
    }
    order.status = status;
    await order.save();

    const io = req.app.get('io');
    if (io) io.to(String(order.buyerBusinessId)).emit('supplier-order-status', { orderId: order._id, status });

    res.json({ success: true, order });
  } catch (error) {
    logger.error('Error updating supplier order status', error, req);
    res.status(500).json({ message: 'Error al actualizar estado' });
  }
});

// GET /api/supplier-orders/superadmin — SuperAdmin ve todas las órdenes pendientes
router.get('/superadmin', authSuperAdmin.protectSuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const orders = await SupplierOrder.find(query).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, orders });
  } catch (error) {
    logger.error('Error fetching all supplier orders (superadmin)', error, req);
    res.status(500).json({ message: 'Error al obtener órdenes' });
  }
});

module.exports = router;
