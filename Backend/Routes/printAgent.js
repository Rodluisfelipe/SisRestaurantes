const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const BusinessConfig = require('../Models/BusinessConfig');
const { printEmitter } = require('../services/socketService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// POST /api/print-agent/generate-key — Generate a new print agent key (authed admin)
router.post('/generate-key', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const key = crypto.randomBytes(32).toString('hex');
    await BusinessConfig.findByIdAndUpdate(businessId, { printAgentKey: key });

    res.json({ key });
  } catch (error) {
    logger.error('Error generating print agent key', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/print-agent/revoke-key — Revoke the print agent key
router.delete('/revoke-key', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    await BusinessConfig.findByIdAndUpdate(businessId, { printAgentKey: null });
    res.json({ message: 'Key revoked' });
  } catch (error) {
    logger.error('Error revoking print agent key', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/print-agent/stream?key=<key> — SSE stream of new orders
router.get('/stream', async (req, res) => {
  const key = req.query.key;
  if (!key || typeof key !== 'string' || key.length !== 64) {
    return res.status(401).json({ error: 'Invalid key' });
  }

  try {
    const business = await BusinessConfig.findOne({ printAgentKey: key })
      .select('_id businessName address phone nit slug')
      .lean();

    if (!business) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const businessId = business._id.toString();

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering for SSE
    });

    // Send initial connection event with business info
    res.write(`event: connected\ndata: ${JSON.stringify({
      businessId,
      businessName: business.businessName,
      address: business.address,
      phone: business.phone,
      nit: business.nit,
      slug: business.slug
    })}\n\n`);

    logger.info('Print agent connected via SSE', { businessId, slug: business.slug });

    // Keep-alive every 25 seconds
    const keepalive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 25000);

    // Listen for new orders (comanda)
    const orderHandler = (order) => {
      try {
        res.write(`event: order_created\ndata: ${JSON.stringify(order)}\n\n`);
      } catch (e) {
        logger.error('Error writing SSE order event', { error: e.message });
      }
    };

    // Listen for receipt print requests
    const receiptHandler = (order) => {
      try {
        res.write(`event: print_receipt\ndata: ${JSON.stringify(order)}\n\n`);
      } catch (e) {
        logger.error('Error writing SSE receipt event', { error: e.message });
      }
    };

    printEmitter.on(`print:${businessId}`, orderHandler);
    printEmitter.on(`receipt:${businessId}`, receiptHandler);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepalive);
      printEmitter.off(`print:${businessId}`, orderHandler);
      printEmitter.off(`receipt:${businessId}`, receiptHandler);
      logger.info('Print agent disconnected', { businessId });
    });

  } catch (error) {
    logger.error('Error in print agent stream', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/print-agent/test-print — Send a test order to the print agent (authed admin)
router.post('/test-print', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const testOrder = {
      _id: 'test-' + Date.now(),
      orderNumber: 'TEST',
      customerName: 'Pedido de Prueba',
      phone: '0000000000',
      orderType: 'inSite',
      tableNumber: '1',
      paymentMethod: 'cash',
      items: [
        { name: 'Producto de Prueba', price: 10000, quantity: 2, selectedToppings: [] },
        { name: 'Otro Producto', price: 5000, quantity: 1, selectedToppings: [
          { groupName: 'Extras', optionName: 'Queso', price: 2000 }
        ] }
      ],
      totalAmount: 27000,
      deliveryFee: 0,
      discountAmount: 0,
      finalAmount: 27000,
      createdAt: new Date().toISOString(),
      isTest: true
    };

    printEmitter.emit(`print:${businessId.toString()}`, testOrder);
    res.json({ message: 'Test print sent' });
  } catch (error) {
    logger.error('Error sending test print', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/print-agent/print-receipt/:orderId — Print receipt for a specific order (authed admin)
router.post('/print-receipt/:orderId', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId || req.body.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const { orderId } = req.params;
    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');

    // Search in active orders first, then completed
    let order = await Order.findOne({ _id: orderId, businessId }).lean();
    if (!order) {
      order = await CompletedOrder.findOne({ _id: orderId, businessId }).lean();
    }
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    printEmitter.emit(`receipt:${businessId.toString()}`, order);
    res.json({ message: 'Receipt sent to printer' });
  } catch (error) {
    logger.error('Error printing receipt', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
