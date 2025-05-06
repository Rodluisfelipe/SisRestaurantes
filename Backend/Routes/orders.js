const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../Models/Order");
const CompletedOrder = require("../Models/CompletedOrder");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = mongoose;
const socketService = require("../services/socketService");

// Helper function to get order number
const generateOrderNumber = async (businessId) => {
  try {
    // Find the highest order number for this business and increment
    const latestOrder = await Order.findOne({ businessId })
      .sort({ createdAt: -1 })
      .limit(1);
    
    if (!latestOrder) {
      return "1"; // Start from 1
    }
    
    // Extract the number and increment
    const lastNumber = parseInt(latestOrder.orderNumber, 10);
    return (lastNumber + 1).toString();
  } catch (error) {
    console.error("Error generating order number:", error);
    // Fallback to timestamp-based order number
    return Date.now().toString();
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
    
    // Create update object
    const updateData = { 
      status,
      updatedAt: new Date()
    };
    
    // If status is changing to inProgress, set sentToKitchen to true
    if (status === "inProgress") {
      updateData.sentToKitchen = true;
    }
    
    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    
    // If order is completed, move it to CompletedOrders collection
    if (status === "completed") {
      try {
        // Convert Mongoose document to plain object
        const orderData = updatedOrder.toObject();
        
        // Create a new completed order
        const completedOrder = new CompletedOrder({
          ...orderData,
          completedAt: new Date(),
          status: "completed"
        });
        
        // Save completed order
        await completedOrder.save();
        
        // Wait a bit to ensure clients receive the update before removing from active orders
        setTimeout(async () => {
          try {
            // Remove from active orders
            await Order.findByIdAndDelete(id);
            socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_deleted", { _id: id });
          } catch (err) {
            console.error("Error removing completed order from active orders:", err);
          }
        }, 5000); // 5 seconds delay
      } catch (err) {
        console.error("Error saving to CompletedOrder:", err);
        // Continue with response even if saving to CompletedOrder fails
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: error.message });
  }
});

// Send order to kitchen without changing status
router.patch("/:id/send-to-kitchen", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    // Update only the sentToKitchen field
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { 
        sentToKitchen: true,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error sending order to kitchen:", error);
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

// Generate daily sales report and close day
router.post("/daily-closing", async (req, res) => {
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
      const BusinessConfig = require('../Models/BusinessConfig');
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      businessObjectId = business._id;
    }
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow's date at midnight
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Query completed orders for today that haven't been included in a report
    const completedOrders = await CompletedOrder.find({
      businessId: businessObjectId,
      completedAt: { $gte: today, $lt: tomorrow }
    });
    
    if (completedOrders.length === 0) {
      return res.status(404).json({ 
        message: "No completed orders found for today", 
        orders: [], 
        stats: { 
          totalOrders: 0, 
          totalSales: 0, 
          ordersByType: {
            inSite: { count: 0, total: 0 },
            takeaway: { count: 0, total: 0 },
            delivery: { count: 0, total: 0 }
          } 
        }
      });
    }
    
    // Calculate report statistics
    const stats = {
      totalOrders: completedOrders.length,
      totalSales: 0,
      ordersByType: {
        inSite: { count: 0, total: 0 },
        takeaway: { count: 0, total: 0 },
        delivery: { count: 0, total: 0 }
      },
      topSellingItems: {}
    };
    
    // Process orders
    completedOrders.forEach(order => {
      // Add to total sales
      stats.totalSales += order.totalAmount;
      
      // Add to orders by type
      const type = order.orderType;
      stats.ordersByType[type].count += 1;
      stats.ordersByType[type].total += order.totalAmount;
      
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
        stats.topSellingItems[itemName].total += (item.price * item.quantity);
      });
    });
    
    // Convert top selling items to array and sort
    stats.topSellingItems = Object.entries(stats.topSellingItems)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 items
    
    // Mark orders as included in report
    await CompletedOrder.updateMany(
      { 
        _id: { $in: completedOrders.map(order => order._id) } 
      },
      { includedInReport: true }
    );
    
    res.json({
      message: "Daily closing report generated successfully",
      reportDate: today,
      orders: completedOrders,
      stats
    });
  } catch (error) {
    console.error("Error generating daily closing report:", error);
    res.status(500).json({ message: error.message });
  }
});

// Cleanup completed orders after viewing report
router.post("/cleanup-completed", async (req, res) => {
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
      const BusinessConfig = require('../Models/BusinessConfig');
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
    console.error("Error cleaning up completed orders:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 