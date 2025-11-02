const express = require('express');
const router = express.Router();
const socketService = require('../services/socketService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

/**
 * Debug routes for Socket.IO troubleshooting
 */

// Proteger endpoints de debug con autenticación
router.use(authMiddleware);

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
    logger.error('Error getting clients info', error, req);
    res.status(500).json(formatHttpError(req, error.message, 500));
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
    
    logger.debug('Test socket emission sent', { businessId }, req);
    res.json({
      success: true,
      message: `Test event emitted to business ${businessId}`,
      data: testData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error testing socket emission', error, req);
    res.status(500).json(formatHttpError(req, error.message, 500));
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
    
    logger.debug('Test order emission sent', { businessId }, req);
    res.json({
      success: true,
      message: `Test order event emitted to business ${businessId}`,
      order: testOrder,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error testing order emission', error, req);
    res.status(500).json(formatHttpError(req, error.message, 500));
  }
});

module.exports = router;
