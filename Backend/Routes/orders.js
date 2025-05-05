const express = require("express");
const router = express.Router();
const Order = require("../Models/Order");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("../utils/isValidObjectId");
const socketService = require("../services/socketService");

// Helper function to get order number
const generateOrderNumber = async (businessId) => {
  try {
    // Find the highest order number for this business and increment
    const latestOrder = await Order.findOne({ businessId })
      .sort({ createdAt: -1 })
      .limit(1);
    
    if (!latestOrder) {
      return "ORD-1001"; // Start from 1001
    }
    
    // Extract the number part from the last order number
    const lastNumber = parseInt(latestOrder.orderNumber.split('-')[1], 10);
    return `ORD-${lastNumber + 1}`;
  } catch (error) {
    console.error("Error generating order number:", error);
    // Fallback to timestamp-based order number
    return `ORD-${Date.now().toString().slice(-6)}`;
  }
};

// Get all orders for a business (with optional filtering)
router.get("/", async (req, res) => {
  try {
    const { businessId, status, orderType } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required" });
    }
    
    // Prepare filter
    const filter = {};
    
    // Handle the businessId, which could be an ObjectId or a slug
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      filter.businessId = businessId;
    } else {
      // If it's a slug, we need to first find the corresponding business config
      // to get its ObjectId
      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      filter.businessId = business._id;
    }
    
    // Add optional filters
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    
    // Get orders sorted by creation date (newest first)
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new order
router.post("/", async (req, res) => {
  try {
    const { businessId, customerName, orderType, items, totalAmount, tableNumber, phone, address } = req.body;
    
    if (!businessId || !customerName || !orderType || !items || !totalAmount) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // Handle the businessId, which could be an ObjectId or a slug
    let businessObjectId;
    
    if (isValidObjectId(businessId)) {
      // If it's a valid ObjectId, use it directly
      businessObjectId = businessId;
    } else {
      // If it's a slug, find the corresponding business to get its ObjectId
      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Generate order number
    const orderNumber = await generateOrderNumber(businessObjectId);
    
    // Create the order
    const newOrder = new Order({
      businessId: businessObjectId,
      orderNumber,
      customerName,
      orderType,
      items,
      totalAmount,
      tableNumber: tableNumber || "",
      phone: phone || "",
      address: address || "",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const savedOrder = await newOrder.save();
    
    // Emit socket event
    socketService.emitToBusiness(businessObjectId.toString(), "order_created", savedOrder);
    
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get order by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update order status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    if (!status || !["pending", "inProgress", "completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    
    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    
    // Delete completed orders after updating
    if (status === "completed") {
      // Wait a bit to ensure clients receive the update before deletion
      setTimeout(async () => {
        await Order.findByIdAndDelete(id);
        socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_deleted", { _id: id });
      }, 5000); // 5 seconds delay
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: error.message });
  }
});

// Delete an order
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Find order first to get businessId for socket event
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    await Order.findByIdAndDelete(id);
    
    // Emit socket event
    socketService.emitToBusiness(order.businessId.toString(), "order_deleted", { _id: id });
    
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 