/**
 * Pedidos — Eliminar pedidos, cierre diario y limpieza de completados.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const BusinessConfig = require("../../Models/BusinessConfig");
const { ObjectId } = require("mongoose").Types;
const socketService = require("../../services/socketService");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const { tenantAuth } = require('../../middleware/tenantAuth');
const { validateDeleteOrder, validateDailyClosing, validateCleanupCompleted } = require('../../middleware/validators/orderValidators');
const { startOfDayCOL, endOfDayCOL } = require('../../utils/timezone');
const { sincronizarCreditoPedido } = require('../../services/credito');
const { salesOf, deliveryOf, tipsOf, chargedOf } = require('../../utils/revenue');
const { lineTotal } = require('./compartido');

// Delete an order (admin only)
router.delete("/:id", tenantAuth, validateDeleteOrder, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Compound query ensures tenant isolation
    const tenantBizIdDel = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOneAndDelete({ _id: id, ...(tenantBizIdDel ? { businessId: tenantBizIdDel } : {}) });
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    // Un pedido a crédito que se elimina ya no se le cobra al cliente.
    try {
      await sincronizarCreditoPedido(order.toObject(), { anular: true });
    } catch (e) {
      logger.error('No se pudo devolver el crédito del pedido eliminado', { error: e.message, orderId: id });
    }

    // Emit socket event
    socketService.emitToBusiness(order.businessId.toString(), "order_deleted", { _id: id });
    
    res.json({ message: "Order deleted successfully" });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Generate daily sales report and close day (admin only)
router.post("/daily-closing", tenantAuth, validateDailyClosing, async (req, res) => {
  try {
    const { businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "Missing businessId" });
    }
    
    // Handle the businessId, which could be an ObjectId or a slug
    let businessObjectId;
    
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      businessObjectId = businessId;
    } else {
      // If it's a slug, find the corresponding business to get its ObjectId
      const BusinessConfig = require('../../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Get today's date at midnight Colombia time (UTC-5)
    const today = startOfDayCOL();
    const tomorrow = endOfDayCOL();
    
    // Query completed orders for today that haven't been included in a report
    const completedOrders = await CompletedOrder.find({
      businessId: businessObjectId,
      completedAt: { $gte: today, $lt: tomorrow }
    }).populate('deliveryPersonId', 'name');
    
    if (completedOrders.length === 0) {
      return res.status(200).json({ 
        message: "No completed orders found for today", 
        orders: [], 
        stats: { 
          totalOrders: 0, 
          totalSales: 0, 
          totalAmount: 0,
          totalDelivery: 0,
          totalTips: 0,
          totalCharged: 0,
          ordersByType: {
            inSite: { count: 0, total: 0 },
            takeaway: { count: 0, total: 0 },
            delivery: { count: 0, total: 0 }
          },
          topSellingItems: []
        }
      });
    }
    
    // Calculate report statistics
    const stats = {
      totalOrders: completedOrders.length,
      totalSales: 0,
      totalAmount: 0,
      totalDelivery: 0,
      totalTips: 0,
      totalCharged: 0,
      ordersByType: {
        inSite: { count: 0, total: 0 },
        takeaway: { count: 0, total: 0 },
        delivery: { count: 0, total: 0 }
      },
      topSellingItems: {}
    };
    
    // Process orders
    completedOrders.forEach(order => {
      /* Ventas con la misma definición que el resto del sistema
         (utils/revenue): productos menos descuentos. Antes aquí no se restaba
         el descuento y el panel mostraba dos cifras distintas para el mismo
         día. Domicilios y propinas van aparte y se suman en "cobrado". */
      stats.totalSales += salesOf(order);
      stats.totalAmount += salesOf(order);
      stats.totalDelivery += deliveryOf(order);
      stats.totalTips += tipsOf(order);
      stats.totalCharged += chargedOf(order);

      const type = order.orderType;
      if (stats.ordersByType[type]) {
        stats.ordersByType[type].count += 1;
        stats.ordersByType[type].total += salesOf(order);
      }
      
      // Count items for top selling
      order.items.forEach(item => {
        const itemName = item.name;
        if (!stats.topSellingItems[itemName]) {
          stats.topSellingItems[itemName] = {
            count: 0,
            total: 0
          };
        }
        stats.topSellingItems[itemName].count += item.quantity;
        // Con sus opciones (tocineta, queso extra…), igual que el total del pedido.
        stats.topSellingItems[itemName].total += lineTotal(item);
      });
    });
    
    // Convert top selling items to array and sort
    stats.topSellingItems = Object.entries(stats.topSellingItems)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 items
    
    /* Ya no se marca `includedInReport` aquí: la pantalla llama a esta ruta
       cada vez que se abre o se actualiza, y la marca no la usa nadie. Era
       una escritura en la base por cada vistazo. */

    res.json({
      message: "Daily closing report generated successfully",
      reportDate: today,
      orders: completedOrders,
      stats
    });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Cleanup completed orders after viewing report (admin only)
router.post("/cleanup-completed", tenantAuth, validateCleanupCompleted, async (req, res) => {
  try {
    const { businessId, orderIds } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ message: "Missing businessId" });
    }
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "No order IDs provided for cleanup" });
    }
    
    // Handle the businessId, which could be an ObjectId or a slug
    let businessObjectId;
    
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      businessObjectId = businessId;
    } else {
      // If it's a slug, find the corresponding business to get its ObjectId
      const BusinessConfig = require('../../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Delete the completed orders
    const result = await CompletedOrder.deleteMany({
      businessId: businessObjectId,
      _id: { $in: orderIds.map(id => new mongoose.Types.ObjectId(id)) }
    });
    
    return res.json({
      message: "Completed orders cleaned up successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ===== IN-APP ORDERING ENDPOINTS =====

module.exports = router;
