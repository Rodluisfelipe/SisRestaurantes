/**
 * Pedidos — Ver un pedido.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const { isValidObjectId } = require("../../utils/validators");
const authMiddleware = require('../../middleware/authMiddleware');

// Get order by ID - ADMIN ONLY - MUST BE AFTER specific routes to avoid intercepting them
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    const order = await Order.findById(id).lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Tenant isolation: verify admin owns this order's business
    if (req.user.businessId && order.businessId.toString() !== req.user.businessId.toString() && !req.user.isSuperAdmin) {
      return res.status(403).json({ message: 'No tienes acceso a este pedido' });
    }
    
    res.json(order);
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
