const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const { printEmitter } = require('../services/socketService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { getPlanLimitStatus } = require('../utils/subscriptionHelper');

// Tracks active Print Agent SSE connections per business to enforce plan-based autoprint limits.
const activePrintAgentConnections = new Map();

function getActiveAgentCount(businessId) {
  return activePrintAgentConnections.get(String(businessId))?.size || 0;
}

function registerAgentConnection(businessId, connectionId) {
  const key = String(businessId);
  const existing = activePrintAgentConnections.get(key) || new Set();
  existing.add(connectionId);
  activePrintAgentConnections.set(key, existing);
}

function unregisterAgentConnection(businessId, connectionId) {
  const key = String(businessId);
  const existing = activePrintAgentConnections.get(key);
  if (!existing) return;

  existing.delete(connectionId);
  if (existing.size === 0) {
    activePrintAgentConnections.delete(key);
  }
}

// Helper: resolve businessId from JWT, body, query, or DB lookup
async function resolveBusinessId(req) {
  const bizId = req.user.businessId || req.body?.businessId || req.query?.businessId;
  if (bizId) return bizId;
  // Fallback: look up Admin record to get businessId (not for superadmin)
  if (req.user.id && req.user.role !== 'superadmin') {
    const admin = await Admin.findById(req.user.id).select('businessId').lean();
    if (admin?.businessId) return admin.businessId.toString();
  }
  return null;
}

// POST /api/print-agent/generate-key — Generate a new print agent key (authed admin)
router.post('/generate-key', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const key = crypto.randomBytes(32).toString('hex');
    await BusinessConfig.findByIdAndUpdate(businessId, { printAgentKey: key });

    res.json({ key });
  } catch (error) {
    logger.error('Error generating print agent key', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* GET /api/print-agent/key — la clave del negocio, solo para su panel.
   Antes se leía de /api/business-config, que es público: cualquiera que
   abriera el menú podía sacarla y conectarse al flujo de pedidos en vivo. */
router.get('/key', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const config = await BusinessConfig.findById(businessId).select('printAgentKey').lean();
    res.json({ key: config?.printAgentKey || null });
  } catch (error) {
    logger.error('Error getting print agent key', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/print-agent/revoke-key — Revoke the print agent key
router.delete('/revoke-key', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    await BusinessConfig.findByIdAndUpdate(businessId, { printAgentKey: null });
    res.json({ message: 'Key revoked' });
  } catch (error) {
    logger.error('Error revoking print agent key', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/print-agent/mode — Update the auto-print mode (authed admin)
router.put('/mode', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const { mode } = req.body;
    if (!['comanda', 'recibo', 'both'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be: comanda, recibo, or both' });
    }

    await BusinessConfig.findByIdAndUpdate(businessId, { printAgentMode: mode });
    res.json({ mode });
  } catch (error) {
    logger.error('Error updating print agent mode', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/print-agent/mode — Get the current auto-print mode (authed admin)
router.get('/mode', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const config = await BusinessConfig.findById(businessId).select('printAgentMode').lean();
    res.json({ mode: config?.printAgentMode || 'both' });
  } catch (error) {
    logger.error('Error getting print agent mode', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* GET /api/print-agent/status — ¿hay un agente conectado ahora mismo?
   El POS lo consulta para saber si el ticket ya va a salir solo: si hay agente,
   no tiene sentido pedirle al cajero que confirme una impresión que ya ocurrió.
   La única fuente real es el registro en memoria de conexiones SSE. */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
    if (!businessId) return res.status(400).json({ error: 'No business associated' });

    const config = await BusinessConfig.findById(businessId).select('printAgentMode').lean();
    const agents = getActiveAgentCount(businessId);

    res.json({ connected: agents > 0, agents, mode: config?.printAgentMode || 'both' });
  } catch (error) {
    logger.error('Error getting print agent status', error);
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
      .select('_id businessName address phone nit slug printAgentMode')
      .lean();

    if (!business) {
      return res.status(401).json({ error: 'Invalid key' });
    }

    const businessId = business._id.toString();
    const activeAgents = getActiveAgentCount(businessId);
    const autoprintLimitStatus = await getPlanLimitStatus({
      businessId,
      resourceKey: 'autoprintPrinters',
      currentCount: activeAgents
    });

    if (autoprintLimitStatus.limitReached) {
      return res.status(403).json({
        error: autoprintLimitStatus.message,
        code: 'PLAN_LIMIT_REACHED',
        resource: 'autoprintPrinters',
        plan: autoprintLimitStatus.commercialPlan,
        limit: autoprintLimitStatus.limitValue,
        current: activeAgents
      });
    }

    const connectionId = crypto.randomUUID();
    registerAgentConnection(businessId, connectionId);

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering for SSE
    });
    res.flushHeaders();

    // Send initial connection event with business info
    const connData = JSON.stringify({
      businessId,
      businessName: business.businessName,
      address: business.address,
      phone: business.phone,
      nit: business.nit,
      slug: business.slug,
      printMode: business.printAgentMode || 'both'
    });
    res.write(`event: connected\ndata: ${connData}\n\n`);
    if (res.flush) res.flush();

    logger.info('Print agent connected via SSE', {
      businessId,
      slug: business.slug,
      connectionId,
      activeAgents: getActiveAgentCount(businessId)
    });

    // Keep-alive every 25 seconds
    const keepalive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 25000);

    // Listen for new orders (comanda)
    const orderHandler = (order) => {
      try {
        res.write(`event: order_created\ndata: ${JSON.stringify(order)}\n\n`);
        if (res.flush) res.flush();
      } catch (e) {
        logger.error('Error writing SSE order event', { error: e.message });
      }
    };

    // Listen for receipt print requests
    const receiptHandler = (order) => {
      try {
        res.write(`event: print_receipt\ndata: ${JSON.stringify(order)}\n\n`);
        if (res.flush) res.flush();
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
      unregisterAgentConnection(businessId, connectionId);
      logger.info('Print agent disconnected', {
        businessId,
        connectionId,
        activeAgents: getActiveAgentCount(businessId)
      });
    });

  } catch (error) {
    logger.error('Error in print agent stream', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/print-agent/test-print — Send a test order to the print agent (authed admin)
router.post('/test-print', authenticateToken, async (req, res) => {
  try {
    const businessId = await resolveBusinessId(req);
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
    const { orderId } = req.params;
    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');

    let order = await Order.findById(orderId).lean();
    if (!order) {
      order = await CompletedOrder.findById(orderId).lean();
    }
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const businessId = order.businessId?.toString();
    if (!businessId) return res.status(400).json({ error: 'Order has no business' });

    printEmitter.emit(`receipt:${businessId}`, order);
    res.json({ message: 'Receipt sent to printer' });
  } catch (error) {
    logger.error('Error printing receipt', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/print-agent/print-comanda/:orderId — Print comanda for a specific order (authed admin)
router.post('/print-comanda/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');

    let order = await Order.findById(orderId).lean();
    if (!order) {
      order = await CompletedOrder.findById(orderId).lean();
    }
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const businessId = order.businessId?.toString();
    if (!businessId) return res.status(400).json({ error: 'Order has no business' });

    printEmitter.emit(`print:${businessId}`, order);
    res.json({ message: 'Comanda sent to printer' });
  } catch (error) {
    logger.error('Error printing comanda', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* Resumen de agentes conectados ahora mismo, para el estado del sistema.
   Se lee del registro en memoria de conexiones SSE, que es la única fuente
   real: no hay latido persistido en la base. */
router.getPrintAgentStats = function getPrintAgentStats() {
  let agents = 0;
  for (const set of activePrintAgentConnections.values()) agents += set.size;
  return { businessesOnline: activePrintAgentConnections.size, agentsOnline: agents };
};

module.exports = router;
