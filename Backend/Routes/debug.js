const express = require('express');
const router = express.Router();
const socketService = require('../services/socketService');

/**
 * Debug routes for Socket.IO troubleshooting
 */

// Get connected clients information
router.get('/socket/clients', (req, res) => {
  try {
    const clientsInfo = socketService.getConnectedClientsInfo();
    res.json({
      success: true,
      data: clientsInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting clients info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test socket emission to a specific business
router.post('/socket/test/:businessId', (req, res) => {
  try {
    const { businessId } = req.params;
    const testData = req.body.data || { 
      message: 'Test message from debug endpoint', 
      timestamp: new Date().toISOString() 
    };
    
    socketService.testEmitToBusiness(businessId, testData);
    
    res.json({
      success: true,
      message: `Test event emitted to business ${businessId}`,
      data: testData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing socket emission:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test order creation event
router.post('/socket/test-order/:businessId', (req, res) => {
  try {
    const { businessId } = req.params;
    const testOrder = {
      _id: 'test_order_' + Date.now(),
      businessId,
      orderNumber: Math.floor(Math.random() * 1000),
      customerName: 'Cliente de Prueba',
      orderType: 'delivery',
      items: [
        {
          name: 'Producto de Prueba',
          quantity: 1,
          price: 10000
        }
      ],
      totalAmount: 10000,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    socketService.emitToBusiness(businessId, 'order_created', testOrder);
    
    res.json({
      success: true,
      message: `Test order event emitted to business ${businessId}`,
      order: testOrder,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing order emission:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
