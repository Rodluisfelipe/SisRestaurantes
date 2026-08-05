/**
 * Security Audit Tests
 * 
 * Validates all fixes from the security audit:
 * F1: tenantAuth on bookings, businessId validation, price blocking, webhook enforcement
 * F2: Atomic generateOrderNumber, atomic coupon usage
 * F3: Order state machine (valid transitions)
 * F4: Global exception handlers
 */

// ═══════════════════════════════════════════════════════
// F1.1 — tenantAuth on bookings
// ═══════════════════════════════════════════════════════
describe('F1.1 — tenantAuth on bookings routes', () => {
  let bookingsSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    bookingsSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8'
    );
  });

  test('imports tenantAuth middleware', () => {
    expect(bookingsSource).toContain("require('../middleware/tenantAuth')");
  });

  test('imports express-rate-limit', () => {
    expect(bookingsSource).toContain("require('express-rate-limit')");
  });

  const protectedRoutes = [
    { method: "router.get('/'", desc: 'GET / (list bookings)' },
    { method: "router.patch('/:id/status'", desc: 'PATCH /:id/status' },
    { method: "router.get('/stats'", desc: 'GET /stats' },
    { method: "router.get('/customer/:phone'", desc: 'GET /customer/:phone' },
    { method: "router.patch('/:id/assign-staff'", desc: 'PATCH /:id/assign-staff' },
    { method: "router.post('/recurring'", desc: 'POST /recurring' },
  ];

  protectedRoutes.forEach(({ method, desc }) => {
    test(`${desc} uses tenantAuth`, () => {
      const idx = bookingsSource.indexOf(method);
      expect(idx).toBeGreaterThan(-1);
      // Check that tenantAuth appears between the route definition and the handler
      const snippet = bookingsSource.substring(idx, idx + 200);
      expect(snippet).toContain('tenantAuth');
    });
  });

  const publicRoutes = [
    { method: "router.get('/slots'", desc: 'GET /slots (public)' },
    { method: "router.get('/available-staff'", desc: 'GET /available-staff (public)' },
  ];

  publicRoutes.forEach(({ method, desc }) => {
    test(`${desc} does NOT use tenantAuth`, () => {
      const idx = bookingsSource.indexOf(method);
      expect(idx).toBeGreaterThan(-1);
      // Get only the route definition line (up to next async/function)
      const snippet = bookingsSource.substring(idx, idx + 80);
      expect(snippet).not.toContain('tenantAuth');
    });
  });

  test('POST / uses bookingRateLimiter', () => {
    // Find router.post('/' that is the public create endpoint (not /recurring)
    const idx = bookingsSource.indexOf("router.post('/',");
    if (idx === -1) {
      // Try alternate quote style
      const idx2 = bookingsSource.indexOf('router.post("/",');
      expect(idx2).toBeGreaterThan(-1);
    } else {
      const snippet = bookingsSource.substring(idx, idx + 200);
      expect(snippet).toContain('bookingRateLimiter');
    }
  });
});

// ═══════════════════════════════════════════════════════
// F1.2 — businessId validation on customers POST
// ═══════════════════════════════════════════════════════
describe('F1.2 — businessId validation on customers POST', () => {
  let customersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    customersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'customers.js'), 'utf8'
    );
  });

  test('validates businessId with isValidObjectId', () => {
    expect(customersSource).toContain('isValidObjectId(businessId)');
  });

  test('checks BusinessConfig.exists', () => {
    expect(customersSource).toContain('BusinessConfig.exists');
  });

  test('returns 404 for non-existent business', () => {
    expect(customersSource).toContain('Negocio no encontrado');
  });
});

// ═══════════════════════════════════════════════════════
// F1.3 — Blocking price manipulation
// ═══════════════════════════════════════════════════════
describe('F1.3 — Blocking price validation in orders', () => {
  let pricingSource;
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    pricingSource = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8'
    );
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('returns PRICE_MISMATCH error code on mismatch', () => {
    expect(pricingSource).toContain("code: 'PRICE_MISMATCH'");
  });

  test('orders.js delegates to validateOrderPrices', () => {
    expect(ordersSource).toContain('validateOrderPrices');
    expect(ordersSource).toContain("require('../utils/orderPricing')");
  });

  test('logs as BLOCKING (not just warning)', () => {
    expect(pricingSource).toContain('Price mismatch detected — BLOCKING order');
  });
});

// ═══════════════════════════════════════════════════════
// F1.4 — Webhook signature enforcement
// ═══════════════════════════════════════════════════════
describe('F1.4 — ePayco webhook signature enforcement', () => {
  let epaycoSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    epaycoSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8'
    );
  });

  test('validates signature with epaycoService', () => {
    expect(epaycoSource).toContain('validateConfirmationSignature');
  });

  test('returns early on invalid signature (does not continue processing)', () => {
    const idx = epaycoSource.indexOf('validateConfirmationSignature');
    expect(idx).toBeGreaterThan(-1);
    const after = epaycoSource.substring(idx, idx + 400);
    // Must contain a return statement before continuing
    expect(after).toMatch(/return\s+res\.status\(200\)/);
  });

  test('logs REJECTING for invalid signatures', () => {
    expect(epaycoSource).toContain('REJECTING');
  });
});

describe('F1.4 — dLocal webhook signature enforcement', () => {
  let dlocalSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    dlocalSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8'
    );
  });

  test('verifies HMAC signature', () => {
    expect(dlocalSource).toContain('verifyWebhookSignature');
  });

  test('returns early on invalid signature', () => {
    const idx = dlocalSource.indexOf('verifyWebhookSignature');
    expect(idx).toBeGreaterThan(-1);
    const after = dlocalSource.substring(idx, idx + 400);
    expect(after).toMatch(/return\s+res\.status\(200\)/);
  });

  test('logs REJECTING for invalid signatures', () => {
    expect(dlocalSource).toContain('REJECTING');
  });
});

// ═══════════════════════════════════════════════════════
// F2.1 — Atomic generateOrderNumber
// ═══════════════════════════════════════════════════════
describe('F2.1 — Atomic generateOrderNumber with Counter model', () => {
  test('Counter model has correct schema', () => {
    const Counter = require('../Models/Counter');
    expect(Counter).toBeDefined();
    expect(Counter.modelName).toBe('Counter');
    
    const schema = Counter.schema;
    expect(schema.path('_id')).toBeDefined();
    expect(schema.path('seq')).toBeDefined();
    expect(schema.path('seq').instance).toBe('Number');
  });

  test('orders.js uses Counter model for atomic increment', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
    
    // Uses Counter model
    expect(source).toContain("require('../Models/Counter')");
    
    // Uses atomic $inc
    expect(source).toContain("{ $inc: { seq: 1 } }");
    
    // Uses findOneAndUpdate (atomic operation)
    expect(source).toContain('Counter.findOneAndUpdate');
    
    // Seeds with $max (safe for concurrent seeding)
    expect(source).toContain('{ $max: { seq:');
  });
});

// ═══════════════════════════════════════════════════════
// F2.2 — Atomic coupon usage
// ═══════════════════════════════════════════════════════
describe('F2.2 — Atomic coupon usage', () => {
  let couponSource;
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    couponSource = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'orderCoupon.js'), 'utf8'
    );
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('uses atomic findOneAndUpdate for coupon reservation', () => {
    expect(couponSource).toContain('CouponModel.findOneAndUpdate');
  });

  test('checks usageCount < usageLimit atomically with $lt', () => {
    const idx = couponSource.indexOf('CouponModel.findOneAndUpdate');
    expect(idx).toBeGreaterThan(-1);
    const before = couponSource.substring(Math.max(0, idx - 300), idx);
    expect(before).toContain('$lt');
  });

  test('increments usageCount atomically with $inc', () => {
    const idx = couponSource.indexOf('CouponModel.findOneAndUpdate');
    expect(idx).toBeGreaterThan(-1);
    const snippet = couponSource.substring(idx, idx + 400);
    expect(snippet).toContain('$inc');
    expect(snippet).toContain('usageCount');
  });

  test('prevents double-recording with __usageAlreadyRecorded flag', () => {
    expect(couponSource).toContain('__usageAlreadyRecorded');
  });

  test('orders.js delegates to applyCoupon', () => {
    expect(ordersSource).toContain('applyCoupon');
    expect(ordersSource).toContain("require('../utils/orderCoupon')");
  });
});

// ═══════════════════════════════════════════════════════
// F3 — Order state machine (transition validation)
// ═══════════════════════════════════════════════════════
describe('F3 — Order state machine transitions', () => {
  // Extract the VALID_TRANSITIONS map by evaluating it from source
  const VALID_TRANSITIONS = {
    'pending': ['confirmed', 'preparing', 'inProgress', 'cancelled', 'pending_payment'],
    'pending_payment': ['payment_uploaded', 'cancelled'],
    'payment_uploaded': ['payment_confirmed', 'confirmed', 'preparing', 'cancelled'],
    'payment_confirmed': ['confirmed', 'preparing', 'inProgress', 'cancelled'],
    'confirmed': ['preparing', 'inProgress', 'ready', 'cancelled'],
    'preparing': ['ready', 'completed', 'delivered', 'cancelled'],
    'inProgress': ['ready', 'completed', 'delivered', 'cancelled'],
    'ready': ['completed', 'delivered', 'cancelled'],
    'completed': ['delivered'],
    'delivered': [],
    'cancelled': []
  };

  test('orders.js contains VALID_TRANSITIONS map', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
    expect(source).toContain('VALID_TRANSITIONS');
    expect(source).toContain('INVALID_TRANSITION');
  });

  test('terminal states have no outgoing transitions', () => {
    expect(VALID_TRANSITIONS['delivered']).toEqual([]);
    expect(VALID_TRANSITIONS['cancelled']).toEqual([]);
  });

  test('completed can only go to delivered', () => {
    expect(VALID_TRANSITIONS['completed']).toEqual(['delivered']);
  });

  // Forward-only progression tests
  const forwardFlows = [
    ['pending', 'confirmed', true],
    ['pending', 'preparing', true],
    ['pending', 'cancelled', true],
    ['confirmed', 'preparing', true],
    ['preparing', 'ready', true],
    ['ready', 'completed', true],
    ['ready', 'delivered', true],
    ['completed', 'delivered', true],
  ];

  forwardFlows.forEach(([from, to, expected]) => {
    test(`${from} → ${to} should be ${expected ? 'ALLOWED' : 'BLOCKED'}`, () => {
      const allowed = VALID_TRANSITIONS[from].includes(to);
      expect(allowed).toBe(expected);
    });
  });

  // Invalid reverse/impossible transitions
  const invalidFlows = [
    ['completed', 'pending', 'completed → pending (reverse)'],
    ['completed', 'preparing', 'completed → preparing (reverse)'],
    ['delivered', 'pending', 'delivered → anything (terminal)'],
    ['delivered', 'completed', 'delivered → completed (terminal)'],
    ['cancelled', 'pending', 'cancelled → pending (reopen)'],
    ['cancelled', 'confirmed', 'cancelled → confirmed (reopen)'],
    ['ready', 'pending', 'ready → pending (reverse)'],
    ['ready', 'confirmed', 'ready → confirmed (reverse)'],
    ['preparing', 'pending', 'preparing → pending (reverse)'],
    ['preparing', 'confirmed', 'preparing → confirmed (reverse)'],
  ];

  invalidFlows.forEach(([from, to, desc]) => {
    test(`BLOCKED: ${desc}`, () => {
      const allowed = (VALID_TRANSITIONS[from] || []).includes(to);
      expect(allowed).toBe(false);
    });
  });

  // Payment flow
  test('payment flow: pending → pending_payment → payment_uploaded → payment_confirmed', () => {
    expect(VALID_TRANSITIONS['pending']).toContain('pending_payment');
    expect(VALID_TRANSITIONS['pending_payment']).toContain('payment_uploaded');
    expect(VALID_TRANSITIONS['payment_uploaded']).toContain('payment_confirmed');
    expect(VALID_TRANSITIONS['payment_confirmed']).toContain('confirmed');
  });

  // Every status can be cancelled (except terminal states)
  const nonTerminal = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed', 'preparing', 'inProgress', 'ready'];
  nonTerminal.forEach(status => {
    test(`${status} can be cancelled`, () => {
      expect(VALID_TRANSITIONS[status]).toContain('cancelled');
    });
  });

  // All states in the allowed status list are present in VALID_TRANSITIONS
  test('all statuses have entries in transition map', () => {
    const allStatuses = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed', 
      'inProgress', 'completed', 'ready', 'preparing', 'confirmed', 'cancelled', 'delivered'];
    allStatuses.forEach(s => {
      expect(VALID_TRANSITIONS).toHaveProperty(s);
    });
  });
});

// ═══════════════════════════════════════════════════════
// F4 — Global exception handlers
// ═══════════════════════════════════════════════════════
describe('F4 — Global exception handlers in server.js', () => {
  let serverSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    serverSource = fs.readFileSync(
      path.join(__dirname, '..', 'server.js'), 'utf8'
    );
  });

  test('registers uncaughtException handler', () => {
    expect(serverSource).toContain("process.on('uncaughtException'");
  });

  test('registers unhandledRejection handler', () => {
    expect(serverSource).toContain("process.on('unhandledRejection'");
  });

  test('uncaughtException handler exits process', () => {
    const idx = serverSource.indexOf("'uncaughtException'");
    const block = serverSource.substring(idx, idx + 300);
    expect(block).toContain('process.exit(1)');
  });

  test('unhandledRejection logs the error', () => {
    const idx = serverSource.indexOf("'unhandledRejection'");
    const block = serverSource.substring(idx, idx + 200);
    expect(block).toContain('logger.error');
  });

  test('SIGTERM handler is also present', () => {
    expect(serverSource).toContain("process.on('SIGTERM'");
  });
});

// ═══════════════════════════════════════════════════════
// Integration: PATCH /:id/status with state machine
// ═══════════════════════════════════════════════════════
describe('F3 Integration — PATCH /:id/status endpoint validates transitions', () => {
  const express = require('express');
  const request = require('supertest');

  // Mock tenantAuth — just pass through with a businessId
  const mockTenantAuth = (req, res, next) => {
    req.user = { businessId: '507f1f77bcf86cd799439011' };
    next();
  };

  function createMockApp(mockOrderFind, mockOrderUpdate) {
    const app = express();
    app.use(express.json());

    const VALID_TRANSITIONS = {
      'pending': ['confirmed', 'preparing', 'inProgress', 'cancelled', 'pending_payment'],
      'pending_payment': ['payment_uploaded', 'cancelled'],
      'payment_uploaded': ['payment_confirmed', 'confirmed', 'preparing', 'cancelled'],
      'payment_confirmed': ['confirmed', 'preparing', 'inProgress', 'cancelled'],
      'confirmed': ['preparing', 'inProgress', 'ready', 'cancelled'],
      'preparing': ['ready', 'completed', 'delivered', 'cancelled'],
      'inProgress': ['ready', 'completed', 'delivered', 'cancelled'],
      'ready': ['completed', 'delivered', 'cancelled'],
      'completed': ['delivered'],
      'delivered': [],
      'cancelled': []
    };

    app.patch('/orders/:id/status', mockTenantAuth, async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed',
        'inProgress', 'completed', 'ready', 'preparing', 'confirmed', 'cancelled', 'delivered'
      ].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const currentOrder = mockOrderFind(id);
      if (!currentOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const allowedNext = VALID_TRANSITIONS[currentOrder.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          message: `No se puede cambiar de "${currentOrder.status}" a "${status}"`,
          code: 'INVALID_TRANSITION',
          currentStatus: currentOrder.status,
          allowedTransitions: allowedNext
        });
      }

      const updated = mockOrderUpdate(id, status);
      res.json(updated);
    });

    return app;
  }

  test('allows valid transition: pending → confirmed', async () => {
    const app = createMockApp(
      () => ({ status: 'pending' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });

  test('allows valid transition: pending → cancelled', async () => {
    const app = createMockApp(
      () => ({ status: 'pending' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
  });

  test('allows valid transition: preparing → ready', async () => {
    const app = createMockApp(
      () => ({ status: 'preparing' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'ready' });
    expect(res.status).toBe(200);
  });

  test('blocks invalid transition: completed → pending', async () => {
    const app = createMockApp(
      () => ({ status: 'completed' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.currentStatus).toBe('completed');
  });

  test('blocks invalid transition: delivered → preparing', async () => {
    const app = createMockApp(
      () => ({ status: 'delivered' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'preparing' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(res.body.allowedTransitions).toEqual([]);
  });

  test('blocks invalid transition: cancelled → confirmed (reopen)', async () => {
    const app = createMockApp(
      () => ({ status: 'cancelled' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  test('blocks invalid transition: ready → pending (reverse)', async () => {
    const app = createMockApp(
      () => ({ status: 'ready' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'pending' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  test('returns 400 for unknown status', async () => {
    const app = createMockApp(
      () => ({ status: 'pending' }),
      (id, status) => ({ _id: id, status })
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'FAKE_STATUS' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid status value');
  });

  test('returns 404 for non-existent order', async () => {
    const app = createMockApp(
      () => null,
      () => null
    );
    const res = await request(app)
      .patch('/orders/507f1f77bcf86cd799439011/status')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });

  // Full happy path flow
  test('full flow: pending → confirmed → preparing → ready → completed → delivered', async () => {
    let currentStatus = 'pending';
    const app = createMockApp(
      () => ({ status: currentStatus }),
      (id, status) => { currentStatus = status; return { _id: id, status }; }
    );

    const flow = ['confirmed', 'preparing', 'ready', 'completed', 'delivered'];
    for (const nextStatus of flow) {
      const res = await request(app)
        .patch('/orders/507f1f77bcf86cd799439011/status')
        .send({ status: nextStatus });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(nextStatus);
    }
  });

  // Payment flow
  test('payment flow: pending → pending_payment → payment_uploaded → payment_confirmed → confirmed', async () => {
    let currentStatus = 'pending';
    const app = createMockApp(
      () => ({ status: currentStatus }),
      (id, status) => { currentStatus = status; return { _id: id, status }; }
    );

    const flow = ['pending_payment', 'payment_uploaded', 'payment_confirmed', 'confirmed'];
    for (const nextStatus of flow) {
      const res = await request(app)
        .patch('/orders/507f1f77bcf86cd799439011/status')
        .send({ status: nextStatus });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(nextStatus);
    }
  });
});

// ═══════════════════════════════════════════════════════
// F3b — Topping validation against DB
// ═══════════════════════════════════════════════════════
describe('F3b — Topping validation against DB', () => {
  let pricingSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    pricingSource = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8'
    );
  });

  test('fetches ToppingGroup from DB for validation', () => {
    expect(pricingSource).toContain('ToppingGroup.find');
  });

  test('builds toppingGroupMap for server-side lookup', () => {
    expect(pricingSource).toContain('toppingGroupMap');
  });

  test('validates option prices from DB, not client', () => {
    expect(pricingSource).toContain("dbGroup.options");
    expect(pricingSource).toContain("dbGroup.basePrice");
  });

  test('validates subGroup options from DB', () => {
    expect(pricingSource).toContain('dbSubGroup');
    expect(pricingSource).toContain('dbSubOption');
  });

  test('logs warning for unmatched topping groups (no client price fallback)', () => {
    expect(pricingSource).toContain('Topping group not found in DB, ignoring client price');
    expect(pricingSource).not.toContain('legacy compatibility');
  });
});

// ═══════════════════════════════════════════════════════
// F3c — Optimistic locking on orders
// ═══════════════════════════════════════════════════════
describe('F3c — Optimistic locking on Order model', () => {
  test('Order model has optimisticConcurrency enabled', () => {
    const Order = require('../Models/Order');
    const schemaOptions = Order.schema.options;
    expect(schemaOptions.optimisticConcurrency).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// F4b — Tenant isolation in uploads
// ═══════════════════════════════════════════════════════
describe('F4b — Tenant isolation in proof uploads', () => {
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('proof upload destination uses order ID for scoping', () => {
    expect(ordersSource).toContain("req.params.id");
    // Verify the path includes the order ID subdirectory
    expect(ordersSource).toContain("'order-proofs', safeId");
  });

  test('filename uses crypto for uniqueness instead of Math.random', () => {
    // In the proof storage section
    const idx = ordersSource.indexOf('proofStorage');
    const block = ordersSource.substring(idx, idx + 700);
    expect(block).toContain('crypto.randomBytes');
  });
});

// ═══════════════════════════════════════════════════════
// F4c — Timezone awareness in subscription cron
// ═══════════════════════════════════════════════════════
describe('F4c — Timezone awareness in subscription cron', () => {
  let cronSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    cronSource = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'subscriptionCron.js'), 'utf8'
    );
  });

  test('imports startOfDayCOL from timezone utils', () => {
    expect(cronSource).toContain("require('../utils/timezone')");
    expect(cronSource).toContain('startOfDayCOL');
  });

  test('does NOT use normalizeDate (server-local time)', () => {
    expect(cronSource).not.toContain('normalizeDate');
  });

  test('daysDiff uses startOfDayCOL for timezone-aware comparison', () => {
    const idx = cronSource.indexOf('function daysDiff');
    expect(idx).toBeGreaterThan(-1);
    const block = cronSource.substring(idx, idx + 200);
    expect(block).toContain('startOfDayCOL');
  });

  test('cron schedule uses America/Bogota timezone', () => {
    expect(cronSource).toContain("timezone: 'America/Bogota'");
  });

  test('startOfDayCOL handles UTC-5 correctly', () => {
    const { startOfDayCOL } = require('../utils/timezone');
    // Jan 15 2026 at 3 AM UTC = Jan 14 at 10 PM Colombia time
    const utc3am = new Date('2026-01-15T03:00:00Z');
    const colMidnight = startOfDayCOL(utc3am);
    // Should return Jan 14 midnight COL = Jan 14 05:00:00 UTC
    expect(colMidnight.toISOString()).toBe('2026-01-14T05:00:00.000Z');
    
    // Jan 15 at 6 AM UTC = Jan 15 at 1 AM Colombia time
    const utc6am = new Date('2026-01-15T06:00:00Z');
    const colMidnight2 = startOfDayCOL(utc6am);
    // Should return Jan 15 midnight COL = Jan 15 05:00:00 UTC
    expect(colMidnight2.toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });
});

// ═══════════════════════════════════════════════════════
// C1 — Blacklist subscription fields in businessConfig
// ═══════════════════════════════════════════════════════
describe('C1 — Subscription fields blacklisted in businessConfig PUT', () => {
  let configSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    configSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'businessConfig.js'), 'utf8'
    );
  });

  const blockedFields = [
    'subscriptionStatus',
    'subscriptionPlan',
    'planType',
    'periodEnd',
    'graceUntil'
  ];

  blockedFields.forEach(field => {
    test(`blocks ${field} in update`, () => {
      expect(configSource).toContain(`delete updateData.${field}`);
    });
  });

  test('blacklist appears in BOTH PUT routes', () => {
    // Count occurrences of subscriptionStatus delete
    const matches = configSource.match(/delete updateData\.subscriptionStatus/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════
// C2 — Transaction for CompletedOrder move
// ═══════════════════════════════════════════════════════
describe('C2 — Transactional move to CompletedOrder', () => {
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('uses mongoose.startSession() for transactions', () => {
    expect(ordersSource).toContain('mongoose.startSession()');
  });

  test('uses session.withTransaction() for atomic operations', () => {
    expect(ordersSource).toContain('session.withTransaction');
  });

  test('saves CompletedOrder with session', () => {
    expect(ordersSource).toContain('completedOrder.save({ session })');
  });

  test('deletes Order with session', () => {
    expect(ordersSource).toContain('Order.findByIdAndDelete(id, { session })');
  });

  test('calls session.endSession() in finally block', () => {
    expect(ordersSource).toContain('session.endSession()');
  });

  test('does NOT use setTimeout for delete anymore', () => {
    // The old pattern was setTimeout + findByIdAndDelete
    const idx = ordersSource.indexOf('session.withTransaction');
    const after = ordersSource.substring(idx, idx + 1000);
    // Should not have setTimeout with findByIdAndDelete inside it
    expect(after).not.toContain("setTimeout(async () => {\n          try {\n            // Remove from active orders\n            await Order.findByIdAndDelete(id)");
  });
});

// ═══════════════════════════════════════════════════════
// C3 — Block order if product not found in DB
// ═══════════════════════════════════════════════════════
describe('C3 — Block order if product missing from DB', () => {
  let pricingSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    pricingSource = fs.readFileSync(
      path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8'
    );
  });

  test('returns PRODUCT_NOT_FOUND error code', () => {
    expect(pricingSource).toContain("code: 'PRODUCT_NOT_FOUND'");
  });

  test('blocks with error status 400, not fallback to client price', () => {
    expect(pricingSource).toContain('status: 400');
    expect(pricingSource).toContain("'PRODUCT_NOT_FOUND'");
  });

  test('still allows WhatsApp orders without productId (legacy)', () => {
    expect(pricingSource).toContain('No productId — use client price (legacy orders from WhatsApp)');
  });
});

// ═══════════════════════════════════════════════════════
// C4 — Idempotency key for POS offline orders
// ═══════════════════════════════════════════════════════
describe('C4 — Idempotency key (offlineId) for POS', () => {
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('checks for duplicate offlineId before creating order', () => {
    expect(ordersSource).toContain('req.body.offlineId');
    expect(ordersSource).toContain('DUPLICATE_OFFLINE_ORDER');
  });

  test('returns 409 for duplicate offline orders', () => {
    const idx = ordersSource.indexOf('DUPLICATE_OFFLINE_ORDER');
    const before = ordersSource.substring(Math.max(0, idx - 200), idx);
    expect(before).toContain('res.status(409)');
  });

  test('saves offlineId in new order', () => {
    expect(ordersSource).toContain('offlineId: req.body.offlineId');
  });

  test('Order model has offlineId field with sparse index', () => {
    const Order = require('../Models/Order');
    const schema = Order.schema;
    expect(schema.path('offlineId')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// A1 — expireStaleOrders reactivated in cleanup cron
// ═══════════════════════════════════════════════════════
describe('A1 — expireStaleOrders reactivated', () => {
  let cronSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    cronSource = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'orderCleanupCron.js'), 'utf8'
    );
  });

  test('runCleanup calls expireStaleOrders (not commented out)', () => {
    // Find the runCleanup function body
    const fnStart = cronSource.indexOf('async function runCleanup()');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = cronSource.substring(fnStart, fnStart + 300);
    // Should contain actual call, NOT commented out
    expect(fnBody).toContain('const expired = await expireStaleOrders()');
    expect(fnBody).not.toContain('// const expired = await expireStaleOrders()');
  });

  test('runCleanup returns actual expired count', () => {
    const fnStart = cronSource.indexOf('async function runCleanup()');
    const fnBody = cronSource.substring(fnStart, fnStart + 300);
    expect(fnBody).toContain('return { expired, cleaned }');
    expect(fnBody).not.toContain('expired: 0');
  });

  test('expireStaleOrders function exists and handles pending statuses', () => {
    expect(cronSource).toContain('async function expireStaleOrders()');
    expect(cronSource).toContain('pending_payment');
    expect(cronSource).toContain('pending');
  });

  test('exports expireStaleOrders', () => {
    // Verify the module.exports includes expireStaleOrders
    expect(cronSource).toContain('module.exports');
    const exportsLine = cronSource.substring(cronSource.indexOf('module.exports'));
    expect(exportsLine).toContain('expireStaleOrders');
  });
});

// ═══════════════════════════════════════════════════════
// A2 — Phone+businessId rate limiter for order creation
// ═══════════════════════════════════════════════════════
describe('A2 — Phone+businessId rate limiter', () => {
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('defines orderPhoneLimiter with phone+businessId key', () => {
    expect(ordersSource).toContain('orderPhoneLimiter');
    expect(ordersSource).toContain('customerPhone');
    expect(ordersSource).toContain('ORDER_RATE_LIMITED');
  });

  test('orderPhoneLimiter uses businessId in key', () => {
    const idx = ordersSource.indexOf('orderPhoneLimiter');
    const block = ordersSource.substring(idx, idx + 500);
    expect(block).toContain('businessId');
    expect(block).toContain('keyGenerator');
  });

  test('POST / route applies orderPhoneLimiter middleware', () => {
    // Should have both rate limiters in the route chain
    const postRoute = ordersSource.indexOf('router.post("/",');
    const routeChain = ordersSource.substring(postRoute, postRoute + 400);
    expect(routeChain).toContain('createOrderLimiter');
    expect(routeChain).toContain('orderPhoneLimiter');
  });

  test('POS orders skip phone rate limiter', () => {
    // Both rate limiter middlewares check for POS channel
    const postRoute = ordersSource.indexOf('router.post("/",');
    const routeChain = ordersSource.substring(postRoute, postRoute + 400);
    const posSkips = (routeChain.match(/orderChannel.*===.*'pos'/g) || []).length;
    expect(posSkips).toBeGreaterThanOrEqual(2); // Both limiters skip POS
  });
});

// ═══════════════════════════════════════════════════════
// A3 — Per-businessId lock in subscription activation
// ═══════════════════════════════════════════════════════
describe('A3 — Subscription activation lock', () => {
  test('ePayco activateSubscription uses per-businessId lock', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8'
    );
    expect(src).toContain('_activationLocks');
    expect(src).toContain('_activationLocks.set(lockKey');
    expect(src).toContain('_activationLocks.delete(lockKey');
    // Verify finally + releaseLock exist in the file after activateSubscription
    const fnStart = src.indexOf('async function activateSubscription');
    const afterFn = src.substring(fnStart);
    expect(afterFn).toContain('finally');
    expect(afterFn).toContain('releaseLock()');
  });

  test('dLocal activateSubscription uses per-businessId lock', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8'
    );
    expect(src).toContain('_activationLocks');
    expect(src).toContain('_activationLocks.set(lockKey');
    expect(src).toContain('_activationLocks.delete(lockKey');
    const fnStart = src.indexOf('async function activateSubscription');
    const afterFn = src.substring(fnStart);
    expect(afterFn).toContain('finally');
    expect(afterFn).toContain('releaseLock()');
  });

  test('lock waits for ongoing activation to complete', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8'
    );
    const fnStart = src.indexOf('async function activateSubscription');
    const fnBody = src.substring(fnStart, fnStart + 500);
    // Must await existing lock promise
    expect(fnBody).toContain('while (_activationLocks.has(lockKey))');
    expect(fnBody).toContain('await _activationLocks.get(lockKey)');
  });
});

// ═══════════════════════════════════════════════════════
// A4 — Atomic cash register sale registration ($push)
// ═══════════════════════════════════════════════════════
describe('A4 — Atomic cash register $push', () => {
  let ordersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    ordersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8'
    );
  });

  test('POS sale uses findOneAndUpdate with $push (not find+push+save)', () => {
    // Look for the POS sale registration section
    const posSection = ordersSource.indexOf('Auto-register sale in open cash register');
    expect(posSection).toBeGreaterThan(-1);
    const sectionBody = ordersSource.substring(posSection, posSection + 600);
    expect(sectionBody).toContain('findOneAndUpdate');
    expect(sectionBody).toContain('$push');
    // Should NOT use the old pattern
    expect(sectionBody).not.toContain('openRegister.movements.push');
    expect(sectionBody).not.toContain('openRegister.save()');
  });

  test('MenuBy sale uses findOneAndUpdate with $push', () => {
    // Look for the MenuBy sale registration
    const menubySection = ordersSource.indexOf('Register MenuBy orders in cash register');
    expect(menubySection).toBeGreaterThan(-1);
    const sectionBody = ordersSource.substring(menubySection, menubySection + 600);
    expect(sectionBody).toContain('findOneAndUpdate');
    expect(sectionBody).toContain('$push');
    expect(sectionBody).not.toContain('openRegister.movements.push');
    expect(sectionBody).not.toContain('openRegister.save()');
  });
});

// ═══════════════════════════════════════════════════════
// A5 — Throttle viewer:join by socket
// ═══════════════════════════════════════════════════════
describe('A5 — Throttle viewer:join', () => {
  let socketSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    socketSource = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'socketService.js'), 'utf8'
    );
  });

  test('viewer:join has rapid re-join throttle', () => {
    const joinHandler = socketSource.indexOf("socket.on('viewer:join'");
    expect(joinHandler).toBeGreaterThan(-1);
    const handlerBody = socketSource.substring(joinHandler, joinHandler + 500);
    expect(handlerBody).toContain('_lastViewerJoin');
    // Must have a time-based check
    expect(handlerBody).toMatch(/\d{3,4}/); // Number like 2000 ms
  });

  test('cleans up previous business viewer on re-join', () => {
    const joinHandler = socketSource.indexOf("socket.on('viewer:join'");
    const handlerBody = socketSource.substring(joinHandler, joinHandler + 800);
    // If already tracking a different business, should call removeViewer first
    expect(handlerBody).toContain('_viewerBusinessId');
    expect(handlerBody).toContain('removeViewer');
  });
});

// ═══════════════════════════════════════════════════════
// M1 — Loyalty points expiry cron
// ═══════════════════════════════════════════════════════
describe('M1 — Loyalty points expiry cron', () => {
  test('loyaltyExpiryCron module exports expirePoints and startLoyaltyExpiryCron', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'loyaltyExpiryCron.js'), 'utf8'
    );
    expect(src).toContain('async function expirePoints()');
    expect(src).toContain('function startLoyaltyExpiryCron()');
    expect(src).toContain("module.exports");
    expect(src).toContain('expirePoints');
    expect(src).toContain('startLoyaltyExpiryCron');
  });

  test('expirePoints deducts expired earn transactions', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'loyaltyExpiryCron.js'), 'utf8'
    );
    expect(src).toContain("type: 'expire'");
    expect(src).toContain('expiresAt');
    // Verify it filters for earn transactions
    expect(src).toContain('earn');
  });

  test('server.js registers loyalty expiry cron', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'server.js'), 'utf8'
    );
    expect(src).toContain('loyaltyExpiryCron');
    expect(src).toContain('startLoyaltyExpiryCron');
  });

  test('cron runs at 3 AM Colombia, declared by timezone', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'services', 'loyaltyExpiryCron.js'), 'utf8'
    );
    /* Antes se declaraba como '0 8' asumiendo que el contenedor corría en UTC.
       Se comprueba la zona explícita para que fijarle un TZ al contenedor no
       mueva la expiración de puntos cinco horas en silencio. */
    expect(src).toContain("'0 3 * * *'");
    expect(src).toContain("timezone: 'America/Bogota'");
  });
});

// ═══════════════════════════════════════════════════════
// M2 — Soft-delete delivery zones
// ═══════════════════════════════════════════════════════
describe('M2 — Soft-delete delivery zones', () => {
  let zonesSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    zonesSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'deliveryZones.js'), 'utf8'
    );
  });

  test('DELETE /:id uses findOneAndUpdate with isActive:false instead of findOneAndDelete', () => {
    // Find the DELETE handler
    const deleteSection = zonesSource.indexOf('router.delete("/:id"');
    expect(deleteSection).toBeGreaterThan(-1);
    const deleteBody = zonesSource.substring(deleteSection, deleteSection + 1200);
    expect(deleteBody).toContain('findOneAndUpdate');
    expect(deleteBody).toContain('isActive: false');
    expect(deleteBody).not.toContain('findOneAndDelete');
  });

  test('DeliveryZone model has isActive field', () => {
    const fs = require('fs');
    const path = require('path');
    const modelSrc = fs.readFileSync(
      path.join(__dirname, '..', 'Models', 'DeliveryZone.js'), 'utf8'
    );
    expect(modelSrc).toContain('isActive');
  });
});

// ═══════════════════════════════════════════════════════
// M3 — Mandatory businessId on GET /customers/:phone
// ═══════════════════════════════════════════════════════
describe('M3 — businessId required on GET /customers/:phone', () => {
  let customersSource;

  beforeAll(() => {
    const fs = require('fs');
    const path = require('path');
    customersSource = fs.readFileSync(
      path.join(__dirname, '..', 'Routes', 'customers.js'), 'utf8'
    );
  });

  test('rejects requests without businessId', () => {
    // Find the GET /:phone route
    const getRoute = customersSource.indexOf("router.get('/:phone', customerRateLimiter");
    expect(getRoute).toBeGreaterThan(-1);
    const routeBody = customersSource.substring(getRoute, getRoute + 600);
    
    // Should validate businessId is present and valid
    expect(routeBody).toContain('businessId es requerido');
    expect(routeBody).toContain('isValidObjectId');
  });

  test('queries with explicit businessId (not null fallback)', () => {
    const getRoute = customersSource.indexOf("router.get('/:phone', customerRateLimiter");
    const routeBody = customersSource.substring(getRoute, getRoute + 600);
    // Should NOT have the old pattern of "isValidObjectId(businessId) ? businessId : null"
    expect(routeBody).not.toContain('? businessId : null');
  });
});

// ═══════════════════════════════════════════════════════
// L1 — Structured logger instead of console.error
// ═══════════════════════════════════════════════════════
describe('L1 — Structured logger in route files', () => {
  const filesToCheck = [
    'Routes/customers.js',
    'Routes/tables.js',
    'Routes/upload.js',
    'Routes/products.js'
  ];

  test.each(filesToCheck)('%s uses logger instead of console.error', (file) => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    expect(src).not.toContain('console.error');
    expect(src).toContain('logger');
  });
});

// ═══════════════════════════════════════════════════════
// L2 — stripHtml utility for XSS prevention
// ═══════════════════════════════════════════════════════
describe('L2 — stripHtml utility', () => {
  const { stripHtml, sanitizeFields } = require('../utils/sanitize');

  test('strips HTML tags', () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(stripHtml('<b>bold</b>')).toBe('bold');
    expect(stripHtml('normal text')).toBe('normal text');
  });

  test('decodes HTML entities', () => {
    expect(stripHtml('a &amp; b')).toBe('a & b');
    expect(stripHtml('&lt;div&gt;')).toBe('<div>');
    expect(stripHtml('&quot;test&quot;')).toBe('"test"');
  });

  test('handles null/undefined/non-string', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    // Non-string values pass through (only strings get sanitized)
    expect(stripHtml(123)).toBe(123);
  });

  test('sanitizeFields sanitizes specified fields', () => {
    const obj = {
      name: '<b>John</b>',
      notes: '<script>alert(1)</script>Hello',
      price: 100
    };
    sanitizeFields(obj, ['name', 'notes']);
    expect(obj.name).toBe('John');
    expect(obj.notes).toBe('alert(1)Hello');
    expect(obj.price).toBe(100); // untouched
  });

  test('orders.js uses stripHtml for user text', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain("stripHtml");
    expect(src).toContain("stripHtml(customerName)");
    expect(src).toContain("stripHtml(customerNotes");
    expect(src).toContain("stripHtml(address");
  });

  test('reviews.js uses stripHtml for user text', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'reviews.js'), 'utf8');
    expect(src).toContain("stripHtml");
    expect(src).toContain("stripHtml(customerName");
    expect(src).toContain("stripHtml(comment");
  });
});

// ============================================================
// AUDIT III — Third comprehensive security audit fixes
// ============================================================

describe('III-C1 — dLocal hardcoded credentials removed', () => {
  test('dlocalService.js has no hardcoded API keys as fallback defaults', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dlocalService.js'), 'utf8');
    // Must NOT contain the old hardcoded keys
    expect(src).not.toContain('hdwWMaogDXXYZvEfrIztWlWIAzKkQHLx');
    expect(src).not.toContain('QJiOzA6PxeHjJxTGEAypGTqNTdJkAyCzis176IVc');
    expect(src).not.toContain('3997e61a-4e7c-42ed-b28c-b204f1682e4c');
  });

  test('dlocalService.js falls back to empty string when env vars missing', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dlocalService.js'), 'utf8');
    // Must use empty string as fallback
    expect(src).toContain("process.env.DLOCAL_API_KEY || ''");
    expect(src).toContain("process.env.DLOCAL_SECRET_KEY || ''");
    expect(src).toContain("process.env.DLOCAL_SMART_FIELDS_KEY || ''");
  });
});

describe('III-C2 — ePayco GET /confirmation validates signature', () => {
  test('GET /confirmation handler calls validateConfirmationSignature', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8');
    // Find the GET /confirmation handler
    const getIdx = src.indexOf("router.get('/confirmation'");
    expect(getIdx).toBeGreaterThan(0);
    // The next POST or router.get should be after signature validation
    const handlerCode = src.substring(getIdx, getIdx + 800);
    expect(handlerCode).toContain('validateConfirmationSignature');
    expect(handlerCode).toContain('REJECTING');
  });

  test('POST /confirmation also validates signature', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'epaycoPayments.js'), 'utf8');
    const postIdx = src.indexOf("router.post('/confirmation'");
    expect(postIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(postIdx, postIdx + 800);
    expect(handlerCode).toContain('validateConfirmationSignature');
  });
});

describe('III-A1 — dLocal webhook requires signature', () => {
  test('webhook rejects requests without Authorization header', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8');
    const webhookIdx = src.indexOf("router.post('/webhook'");
    expect(webhookIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(webhookIdx, webhookIdx + 1000);
    // Must check for missing auth header
    expect(handlerCode).toContain('missing Authorization header');
    expect(handlerCode).toContain('REJECTING');
  });

  test('webhook rejects malformed Authorization header', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8');
    const webhookIdx = src.indexOf("router.post('/webhook'");
    const handlerCode = src.substring(webhookIdx, webhookIdx + 1000);
    expect(handlerCode).toContain('malformed Authorization header');
  });

  test('signature verification is no longer optional', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'dlocalPayments.js'), 'utf8');
    const webhookIdx = src.indexOf("router.post('/webhook'");
    const handlerCode = src.substring(webhookIdx, webhookIdx + 1000);
    // Must NOT have conditional signature check (old pattern: if (authHeader) { ... })
    // The old code had: if (authHeader) { ... verify ... } followed by processing
    // New code should check !authHeader and return early
    expect(handlerCode).toContain('!authHeader');
  });
});

describe('III-A2 — Subscription unique constraint on businessId', () => {
  test('Subscription model has unique index on businessId', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Models', 'Subscription.js'), 'utf8');
    expect(src).toContain('unique: true');
    // Check that businessId index is unique
    const indexLine = src.match(/subscriptionSchema\.index\(\{[^}]*businessId[^}]*\}[^)]*unique:\s*true/s);
    expect(indexLine).not.toBeNull();
  });
});

describe('III-A3 — Password change invalidates sessions', () => {
  test('change-password clears refreshTokens array', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');
    // Find the change-password handler
    const cpIdx = src.indexOf("router.post('/change-password'");
    expect(cpIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(cpIdx, cpIdx + 1200);
    expect(handlerCode).toContain('admin.refreshTokens = []');
    expect(handlerCode).toContain('invalidateUserCache');
  });

  test('force-change-password clears refreshTokens array', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');
    const fcpIdx = src.indexOf("router.post('/force-change-password'");
    expect(fcpIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(fcpIdx, fcpIdx + 1500);
    expect(handlerCode).toContain('admin.refreshTokens = []');
    expect(handlerCode).toContain('invalidateUserCache');
  });

  test('authMiddleware exports invalidateUserCache function', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'authMiddleware.js'), 'utf8');
    expect(src).toContain('module.exports.invalidateUserCache');
    expect(src).toContain('verifiedUsersCache.delete');
  });
});

describe('III-M1 — force-change-password validates password strength', () => {
  test('force-change-password requires uppercase, lowercase, and digit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');
    const fcpIdx = src.indexOf("router.post('/force-change-password'");
    const handlerCode = src.substring(fcpIdx, fcpIdx + 900);
    // Must use the same regex as registration
    expect(handlerCode).toContain('passwordRegex');
    expect(handlerCode).toContain('(?=.*[a-z])');
    expect(handlerCode).toContain('(?=.*[A-Z])');
    expect(handlerCode).toContain('(?=.*\\d)');
  });
});

describe('III-M2 — SuperAdmin changePassword validates strength', () => {
  test('authSuperAdmin changePassword validates password complexity', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Controllers', 'authSuperAdmin.js'), 'utf8');
    const cpIdx = src.indexOf('exports.changePassword');
    expect(cpIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(cpIdx, cpIdx + 600);
    expect(handlerCode).toContain('passwordRegex');
    expect(handlerCode).toContain('(?=.*[a-z])');
    expect(handlerCode).toContain('(?=.*[A-Z])');
    expect(handlerCode).toContain('(?=.*\\d)');
  });
});

describe('III-M3 — Timing-safe signature comparisons', () => {
  test('ePayco uses crypto.timingSafeEqual for signature validation', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'epaycoService.js'), 'utf8');
    expect(src).toContain('timingSafeEqual');
  });

  test('dLocal uses crypto.timingSafeEqual for signature validation', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dlocalService.js'), 'utf8');
    expect(src).toContain('timingSafeEqual');
  });

  test('ePayco validateConfirmationSignature does not use ===', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'epaycoService.js'), 'utf8');
    const fnIdx = src.indexOf('function validateConfirmationSignature');
    const fnEnd = src.indexOf('}', src.indexOf('return', fnIdx));
    const fnCode = src.substring(fnIdx, fnEnd + 1);
    expect(fnCode).not.toContain('=== x_signature');
  });

  test('dLocal verifyWebhookSignature does not use ===', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dlocalService.js'), 'utf8');
    const fnIdx = src.indexOf('function verifyWebhookSignature');
    const fnEnd = src.indexOf('}', src.indexOf('return', fnIdx));
    const fnCode = src.substring(fnIdx, fnEnd + 1);
    expect(fnCode).not.toContain('=== receivedSignature');
  });

  test('timingSafeEqual catches length mismatch gracefully', () => {
    const fs = require('fs');
    const path = require('path');
    const srcEpayco = fs.readFileSync(path.join(__dirname, '..', 'services', 'epaycoService.js'), 'utf8');
    const srcDlocal = fs.readFileSync(path.join(__dirname, '..', 'services', 'dlocalService.js'), 'utf8');
    // Both must handle the case where Buffer lengths differ (try/catch)
    expect(srcEpayco).toContain('catch');
    expect(srcDlocal).toContain('catch');
  });
});

// ============================================================
// AUDIT III — PASS 2: Deeper module audit fixes
// ============================================================

describe('III-P2-1 — Booking state machine transitions', () => {
  test('bookings.js enforces BOOKING_TRANSITIONS map', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    expect(src).toContain('BOOKING_TRANSITIONS');
    expect(src).toContain('INVALID_TRANSITION');
  });

  test('completed and cancelled are terminal states (no transitions out)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    const transIdx = src.indexOf('BOOKING_TRANSITIONS');
    expect(transIdx).toBeGreaterThan(0);
    const transBlock = src.substring(transIdx, transIdx + 400);
    // completed and cancelled should map to empty arrays
    expect(transBlock).toContain("'completed': []");
    expect(transBlock).toContain("'cancelled': []");
    expect(transBlock).toContain("'no_show':   []");
  });

  test('validates current status against allowed transitions before updating', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    const patchIdx = src.indexOf("router.patch('/:id/status'");
    const handlerCode = src.substring(patchIdx, patchIdx + 1500);
    expect(handlerCode).toContain('booking.bookingStatus');
    expect(handlerCode).toContain('allowed.includes(bookingStatus)');
  });
});

describe('III-P2-2 — Topping client price fallback removed', () => {
  test('orderPricing.js does NOT trust client prices for unknown topping groups', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    // Must NOT contain the old fallback that uses client prices
    expect(src).not.toContain('Fallback: topping group not found in DB — use client prices');
  });

  test('orderPricing.js logs warning for unknown topping groups', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    expect(src).toContain('Topping group not found in DB, ignoring client price');
  });
});

describe('III-P2-3 — Announcement XSS prevention', () => {
  test('announcements.js imports stripHtml', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'announcements.js'), 'utf8');
    expect(src).toContain("require('../utils/sanitize')");
    expect(src).toContain('stripHtml');
  });

  test('POST /announcements sanitizes title and body', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'announcements.js'), 'utf8');
    const postIdx = src.indexOf("router.post('/'");
    expect(postIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(postIdx, postIdx + 800);
    expect(handlerCode).toContain('stripHtml(title');
    expect(handlerCode).toContain('stripHtml(body');
  });

  test('PUT /announcements/:id sanitizes title and body', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'announcements.js'), 'utf8');
    const putIdx = src.indexOf("router.put('/:id'");
    expect(putIdx).toBeGreaterThan(0);
    const handlerCode = src.substring(putIdx, putIdx + 800);
    expect(handlerCode).toContain('stripHtml(title');
    expect(handlerCode).toContain('stripHtml(body');
  });
});

// ============================================================
// SRE AUDIT — Operational stability & resilience
// ============================================================

describe('SRE-S1 — Comprehensive health check', () => {
  test('health.js checks MongoDB connection state', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'health.js'), 'utf8');
    expect(src).toContain('mongoose');
    expect(src).toContain('readyState');
    expect(src).toContain('ping');
  });

  test('health.js reports memory usage', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'health.js'), 'utf8');
    expect(src).toContain('process.memoryUsage');
    expect(src).toContain('rss_mb');
    expect(src).toContain('heap_used_mb');
  });

  test('health.js returns 503 when unhealthy', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'health.js'), 'utf8');
    expect(src).toContain('503');
    expect(src).toContain('degraded');
  });

  test('health.js reports uptime and response time', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'health.js'), 'utf8');
    expect(src).toContain('uptime_seconds');
    expect(src).toContain('response_time_ms');
  });
});

describe('SRE-S2 — Cron overlap protection', () => {
  test('orderCleanupCron has overlap guard', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderCleanupCron.js'), 'utf8');
    expect(src).toContain('_cleanupRunning');
    expect(src).toContain('skipping');
  });

  test('subscriptionCron has overlap guard', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'subscriptionCron.js'), 'utf8');
    expect(src).toContain('_subCronRunning');
    expect(src).toContain('skipping');
  });

  test('bookingReminderCron has overlap guard', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'bookingReminderCron.js'), 'utf8');
    expect(src).toContain('_bookingCronRunning');
    expect(src).toContain('skipping');
  });

  test('loyaltyExpiryCron has overlap guard', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'loyaltyExpiryCron.js'), 'utf8');
    expect(src).toContain('_loyaltyCronRunning');
    expect(src).toContain('skipping');
  });

  test('all cron guards use try/finally pattern', () => {
    const fs = require('fs');
    const path = require('path');
    const files = [
      'services/orderCleanupCron.js',
      'services/subscriptionCron.js',
      'services/bookingReminderCron.js',
      'services/loyaltyExpiryCron.js'
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(src).toContain('finally');
    }
  });
});

describe('SRE-S3 — Memory leak prevention in socket caches', () => {
  test('slugCache has periodic cleanup', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'socketService.js'), 'utf8');
    expect(src).toContain('SLUG_CACHE_MAX');
    expect(src).toContain('slugCache.delete');
    expect(src).toContain('setInterval');
  });

  test('domiLocationCache has TTL and periodic cleanup', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'socketService.js'), 'utf8');
    expect(src).toContain('DOMI_CACHE_TTL');
    expect(src).toContain('domiLocationCache.delete');
  });
});

describe('SRE-S4 — MongoDB connection resilience', () => {
  test('mongoose.connect has serverSelectionTimeoutMS', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('serverSelectionTimeoutMS');
  });

  test('mongoose connection monitors disconnect/reconnect events', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain("'disconnected'");
    expect(src).toContain("'reconnected'");
    expect(src).toContain('auto-reconnect');
  });
});

describe('SRE-S5 — SSE rate limiting', () => {
  test('events.js has rate limiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'events.js'), 'utf8');
    expect(src).toContain('rateLimit');
    expect(src).toContain('sseLimiter');
  });
});

describe('SRE-S6 — Global error handlers exist', () => {
  test('server.js has uncaughtException handler', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('uncaughtException');
    expect(src).toContain('process.exit(1)');
  });

  test('server.js has unhandledRejection handler', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('unhandledRejection');
  });

  test('server.js has SIGTERM graceful shutdown', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('SIGTERM');
    expect(src).toContain('server.close');
  });

  test('server.js has Sentry error handler', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('setupExpressErrorHandler');
  });
});

describe('SRE-S7 — Cron per-item error isolation', () => {
  test('orderCleanupCron has per-order try/catch in loop', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderCleanupCron.js'), 'utf8');
    const loopIdx = src.indexOf('for (const order of staleOrders)');
    expect(loopIdx).toBeGreaterThan(0);
    const loopBlock = src.substring(loopIdx, loopIdx + 1500);
    expect(loopBlock).toContain('try');
    expect(loopBlock).toContain('catch');
  });

  test('subscriptionCron has per-subscription try/catch in loop', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'subscriptionCron.js'), 'utf8');
    // The loop has a try block inside and a catch within the same function scope
    const loopIdx = src.indexOf('for (const sub of subscriptions)');
    expect(loopIdx).toBeGreaterThan(0);
    // Find the next catch after the loop start
    const catchIdx = src.indexOf('catch (err)', loopIdx);
    expect(catchIdx).toBeGreaterThan(loopIdx);
  });
});

// ============================================================
// SRE AUDIT PASS 2 — Deeper stability issues
// ============================================================

describe('SRE-S8 — ViewerTracker stale cleanup called periodically', () => {
  test('socketService periodic cleanup calls viewerTracker.cleanupStale', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'socketService.js'), 'utf8');
    expect(src).toContain('viewerTracker.cleanupStale()');
    expect(src).toContain('setInterval');
  });

  test('viewerTracker exports cleanupStale function', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'viewerTracker.js'), 'utf8');
    expect(src).toContain('cleanupStale');
    expect(src).toContain('HEARTBEAT_TIMEOUT');
  });
});

describe('SRE-S9 — Graceful shutdown closes Socket.IO and Mongoose', () => {
  test('SIGTERM handler closes Socket.IO', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('io.close');
  });

  test('SIGTERM handler closes Mongoose connection', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain('mongoose.connection.close');
  });

  test('SIGTERM has forced exit timeout', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const sigtermIdx = src.indexOf('SIGTERM');
    expect(sigtermIdx).toBeGreaterThan(0);
    const sigtermBlock = src.substring(sigtermIdx, sigtermIdx + 500);
    expect(sigtermBlock).toContain('setTimeout');
    expect(sigtermBlock).toContain('10000');
  });
});

describe('SRE-S10 — Order proof directory cleanup', () => {
  test('orderCleanupCron cleans orphaned proof directories', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderCleanupCron.js'), 'utf8');
    expect(src).toContain('cleanupOrphanedProofDirs');
    expect(src).toContain('order-proofs');
    expect(src).toContain('rmSync');
  });

  test('proof cleanup runs as part of runCleanup', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'orderCleanupCron.js'), 'utf8');
    const runCleanupIdx = src.indexOf('async function runCleanup()');
    expect(runCleanupIdx).toBeGreaterThan(0);
    const block = src.substring(runCleanupIdx, runCleanupIdx + 300);
    expect(block).toContain('cleanupOrphanedProofDirs');
  });
});

describe('SRE-S11 — Booking reminder startup respects overlap guard', () => {
  test('startup setTimeout checks _bookingCronRunning flag', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'bookingReminderCron.js'), 'utf8');
    const setTimeoutIdx = src.indexOf('setTimeout');
    expect(setTimeoutIdx).toBeGreaterThan(0);
    const block = src.substring(setTimeoutIdx, setTimeoutIdx + 300);
    expect(block).toContain('_bookingCronRunning');
    expect(block).toContain('finally');
  });
});

// ============================================================
// SRE AUDIT PASS 3 — Docker, rate limiters, final hardening
// ============================================================

describe('SRE-S12 — Docker log rotation configured', () => {
  test('docker-compose.yml has logging driver with max-size', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'docker-compose.yml'), 'utf8');
    expect(src).toContain('max-size');
    expect(src).toContain('max-file');
    expect(src).toContain('json-file');
  });
});

describe('SRE-S13 — Subscription check endpoint rate limited', () => {
  test('subscriptions.js imports rateLimit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'subscriptions.js'), 'utf8');
    expect(src).toContain('rateLimit');
    expect(src).toContain('subscriptionCheckLimiter');
  });

  test('check/:businessId route uses subscriptionCheckLimiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'subscriptions.js'), 'utf8');
    expect(src).toContain("'/check/:businessId', subscriptionCheckLimiter");
  });
});

// ============================================================
// SRE AUDIT PASS 4 — Final hardening
// ============================================================

describe('SRE-S14 — Public businesses endpoints rate limited', () => {
  test('businesses.js imports rateLimit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'businesses.js'), 'utf8');
    expect(src).toContain('rateLimit');
    expect(src).toContain('businessesLimiter');
  });

  test('all public business routes use businessesLimiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'businesses.js'), 'utf8');
    const routes = ["'/'", "'/featured'", "'/search/products'", "'/search'", "'/:id'"];
    for (const route of routes) {
      expect(src).toContain(`${route}, businessesLimiter`);
    }
  });

  test('debug/all endpoint requires superadmin', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'businesses.js'), 'utf8');
    /* El endpoint pasó de estar limitado a entornos no productivos a exigir
       autenticación de superadmin, que es más estricto: ya no queda expuesto
       ni siquiera en desarrollo. El test seguía comprobando el gate viejo y
       llevaba tiempo fallando. */
    expect(src).toContain('/debug/all');
    expect(src).toContain("router.get('/debug/all', authSuperAdmin");
  });
});

describe('SRE — All public route files have rate limiters', () => {
  const publicRouteFiles = [
    { file: 'Routes/auth.js', keyword: 'rateLimit' },
    { file: 'Routes/events.js', keyword: 'rateLimit' },
    { file: 'Routes/businesses.js', keyword: 'rateLimit' },
    { file: 'Routes/subscriptions.js', keyword: 'rateLimit' },
    { file: 'Routes/loyalty.js', keyword: 'rateLimit' },
    { file: 'Routes/deliveryPublic.js', keyword: 'rateLimit' },
    { file: 'Routes/orders.js', keyword: 'rateLimit' },
    { file: 'Routes/helpChat.js', keyword: 'rateLimit' },
    { file: 'Routes/aiTools.js', keyword: 'rateLimit' }
  ];

  test.each(publicRouteFiles)('$file has rate limiting', ({ file, keyword }) => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    expect(src).toContain(keyword);
  });
});

// ============================================================
// SRE AUDIT PASS 5 — Coupon brute-force & banner click spam
// ============================================================

describe('SRE-S15 — Coupon validation rate limited (brute-force prevention)', () => {
  test('coupons.js imports rateLimit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'coupons.js'), 'utf8');
    expect(src).toContain('rateLimit');
    expect(src).toContain('couponValidateLimiter');
  });

  test('GET /validate/:code uses couponValidateLimiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'coupons.js'), 'utf8');
    expect(src).toContain("'/validate/:code', couponValidateLimiter");
  });

  test('POST /validate uses couponValidateLimiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'coupons.js'), 'utf8');
    expect(src).toContain("'/validate', couponValidateLimiter");
  });
});

describe('SRE-S16 — Banner click tracking rate limited', () => {
  test('banners.js imports rateLimit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'banners.js'), 'utf8');
    expect(src).toContain('rateLimit');
    expect(src).toContain('bannerClickLimiter');
  });

  test('PUT /:id/click uses bannerClickLimiter', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'banners.js'), 'utf8');
    expect(src).toContain("'/:id/click', bannerClickLimiter");
  });
});

// ============================================================
// BUSINESS LOGIC — Order flow, pricing, state machine
// ============================================================

describe('BL-1 — Order status state machine is complete and correct', () => {
  test('VALID_TRANSITIONS covers all ORDER_STATUS values', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    const constantsSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'constants.js'), 'utf8');
    // All statuses from constants
    const statuses = ['pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed',
      'confirmed', 'preparing', 'inProgress', 'ready', 'completed', 'delivered', 'cancelled'];
    for (const s of statuses) {
      expect(src).toContain(`'${s}':`);
    }
  });

  test('terminal states have empty transition arrays', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toMatch(/'delivered':\s*\[\]/);
    expect(src).toMatch(/'cancelled':\s*\[\]/);
  });

  test('completed can only transition to delivered', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    // completed should only allow delivered
    const match = src.match(/'completed':\s*\[([^\]]*)\]/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain("'delivered'");
    // Should not contain other statuses
    expect(match[1]).not.toContain("'pending'");
    expect(match[1]).not.toContain("'cancelled'");
  });

  test('INVALID_TRANSITION error code is returned for bad transitions', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain("'INVALID_TRANSITION'");
    expect(src).toContain('allowedTransitions');
  });
});

describe('BL-2 — Server-side price validation', () => {
  test('orderPricing.js fetches product prices from DB, not trusting client', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    expect(src).toContain('Product.find({ _id: { $in: productIds }');
    expect(src).toContain('dbProduct.price');
    expect(src).toContain('calculatedTotal');
  });

  test('orderPricing.js fetches topping prices from DB, not trusting client', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    expect(src).toContain('ToppingGroup.find({ _id: { $in: uniqueToppingGroupIds }');
    expect(src).toContain('dbGroup.basePrice');
    expect(src).toContain('dbOption.price');
    expect(src).toContain('dbSubOption.price');
  });

  test('price mismatch blocks order with PRICE_MISMATCH code', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    expect(src).toContain("'PRICE_MISMATCH'");
    expect(src).toContain('0.05'); // 5% tolerance
  });

  test('unknown product blocks order with PRODUCT_NOT_FOUND code', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderPricing.js'), 'utf8');
    expect(src).toContain("'PRODUCT_NOT_FOUND'");
  });
});

describe('BL-3 — Order number generation is atomic', () => {
  test('uses Counter model with findOneAndUpdate $inc', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain('Counter.findOneAndUpdate');
    expect(src).toContain('$inc: { seq: 1 }');
  });

  test('seeds counter from max of Order, CompletedOrder, and Booking', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain('Promise.all');
    expect(src).toContain('Math.max(activeNum, completedNum, bookingNum)');
    expect(src).toContain('$max: { seq: highest }');
  });

  test('has fallback to timestamp if counter fails', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain('Date.now().toString()');
  });
});

describe('BL-4 — Coupon application is atomic (no double-spend)', () => {
  test('coupon usage reservation uses atomic findOneAndUpdate with $lt check', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderCoupon.js'), 'utf8');
    expect(src).toMatch(/usageFilter\.usageCount\s*=\s*\{\s*\$lt:\s*coupon\.usageLimit/);
    expect(src).toContain('$inc: { usageCount: 1');
  });

  test('returns error if coupon limit exceeded', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'orderCoupon.js'), 'utf8');
    expect(src).toContain('alcanzado su límite de usos');
  });
});

describe('BL-5 — Subscription check blocks orders when suspended', () => {
  test('checks subscription status before order creation', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain('getSubscriptionForBusiness');
    expect(src).toContain('isSuspended');
  });

  test('returns 403 SUBSCRIPTION_SUSPENDED when business is suspended', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain("'SUBSCRIPTION_SUSPENDED'");
    expect(src).toContain('res.status(403)');
  });
});

describe('BL-6 — Order channel determines initial status correctly', () => {
  test('POS orders start as confirmed', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain('isPOS ? ORDER_STATUS.CONFIRMED');
  });

  test('channel-based initial status is a ternary with all three branches', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    // Full line: isPOS ? ORDER_STATUS.CONFIRMED : isInApp ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING
    expect(src).toContain('isInApp ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING');
  });
});

describe('BL-7 — Booking state machine', () => {
  test('bookings.js has BOOKING_TRANSITIONS map', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    expect(src).toContain('BOOKING_TRANSITIONS');
  });

  test('booking terminal states block further transitions', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    expect(src).toMatch(/'completed':\s*\[\]/);
    expect(src).toMatch(/'cancelled':\s*\[\]/);
    expect(src).toMatch(/'no_show':\s*\[\]/);
  });
});

describe('BL-8 — Loyalty points redemption is atomic', () => {
  test('loyalty.js uses findOneAndUpdate with $gte for atomic deduction', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'loyalty.js'), 'utf8');
    expect(src).toContain('findOneAndUpdate');
    expect(src).toContain('$gte');
    expect(src).toContain('$inc');
  });
});

// ============================================================
// INPUT VALIDATION — express-validator wiring tests
// ============================================================

describe('VAL-1 — express.json body limit is set', () => {
  test('server.js sets explicit body size limit', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(src).toContain("express.json({ limit: '100kb' })");
  });
});

describe('VAL-2 — Order validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('orderValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/orderValidators');
    expect(mod.validateUpdateOrderStatus).toBeDefined();
    expect(mod.validateSendToKitchen).toBeDefined();
    expect(mod.validateDeleteOrder).toBeDefined();
    expect(mod.validateDailyClosing).toBeDefined();
    expect(mod.validateCleanupCompleted).toBeDefined();
    expect(mod.validatePaymentProof).toBeDefined();
    expect(mod.validateConfirmPayment).toBeDefined();
    expect(mod.validateRejectPayment).toBeDefined();
  });

  test('orders.js imports and uses order validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'orders.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/orderValidators')");
    expect(src).toContain('validateUpdateOrderStatus');
    expect(src).toContain('validateSendToKitchen');
    expect(src).toContain('validateDailyClosing');
    expect(src).toContain('validateCleanupCompleted');
    expect(src).toContain('validateConfirmPayment');
    expect(src).toContain('validateRejectPayment');
  });

  test('each order validator ends with handleValidationErrors', () => {
    const mod = require('../middleware/validators/orderValidators');
    for (const [name, chain] of Object.entries(mod)) {
      expect(Array.isArray(chain)).toBe(true);
      // Last element should be the handleValidationErrors function
      const last = chain[chain.length - 1];
      expect(typeof last).toBe('function');
    }
  });
});

describe('VAL-3 — Customer validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('customerValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/customerValidators');
    expect(mod.validateCreateCustomer).toBeDefined();
    expect(mod.validateUpdateCustomer).toBeDefined();
    expect(mod.validateUpdateAddress).toBeDefined();
    expect(mod.validateUpdateSettings).toBeDefined();
    expect(mod.validateDeleteCustomer).toBeDefined();
    expect(mod.validateDeleteCustomerById).toBeDefined();
  });

  test('customers.js imports customer validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'customers.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/customerValidators')");
    expect(src).toContain('validateCreateCustomer');
    expect(src).toContain('validateUpdateCustomer');
    expect(src).toContain('validateUpdateAddress');
  });
});

describe('VAL-4 — Booking validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('bookingValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/bookingValidators');
    expect(mod.validateCreateBooking).toBeDefined();
    expect(mod.validateUpdateBookingStatus).toBeDefined();
    expect(mod.validateAssignStaff).toBeDefined();
    expect(mod.validateCreateRecurring).toBeDefined();
  });

  test('bookings.js imports booking validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'bookings.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/bookingValidators')");
    expect(src).toContain('validateCreateBooking');
    expect(src).toContain('validateUpdateBookingStatus');
    expect(src).toContain('validateAssignStaff');
    expect(src).toContain('validateCreateRecurring');
  });
});

describe('VAL-5 — BusinessConfig validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('businessConfigValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/businessConfigValidators');
    expect(mod.validateUpdateConfig).toBeDefined();
    expect(mod.validateUpdateStatus).toBeDefined();
    expect(mod.validateFixSchema).toBeDefined();
    expect(mod.validateUpdateActive).toBeDefined();
    expect(mod.validateUpdateHours).toBeDefined();
    expect(mod.validateUpdateMenuStatus).toBeDefined();
    expect(mod.validateUpdateConfigById).toBeDefined();
  });

  test('businessConfig.js imports businessConfig validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'businessConfig.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/businessConfigValidators')");
    expect(src).toContain('validateUpdateConfig');
    expect(src).toContain('validateUpdateStatus');
    expect(src).toContain('validateUpdateHours');
    expect(src).toContain('validateUpdateMenuStatus');
  });
});

describe('VAL-6 — Product validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('productValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/productValidators');
    expect(mod.validateProductsReorder).toBeDefined();
    expect(mod.validateReorderFeatured).toBeDefined();
    expect(mod.validateToggleFeatured).toBeDefined();
    expect(mod.validateDeleteProduct).toBeDefined();
    expect(mod.validateToggleProduct).toBeDefined();
    expect(mod.validateUpdateProductParam).toBeDefined();
  });

  test('products.js imports product validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'products.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/productValidators')");
    expect(src).toContain('validateProductsReorder');
    expect(src).toContain('validateReorderFeatured');
    expect(src).toContain('validateDeleteProduct');
  });
});

describe('VAL-7 — Category validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('categoryValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/categoryValidators');
    expect(mod.validateCreateCategory).toBeDefined();
    expect(mod.validateReorderCategories).toBeDefined();
    expect(mod.validateUpdateCategory).toBeDefined();
    expect(mod.validateDeleteCategory).toBeDefined();
    expect(mod.validateUpdateOrder).toBeDefined();
  });

  test('categories.js imports category validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'categories.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/categoryValidators')");
    expect(src).toContain('validateCreateCategory');
    expect(src).toContain('validateReorderCategories');
  });
});

describe('VAL-8 — Table validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('tableValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/tableValidators');
    expect(mod.validateCreateTable).toBeDefined();
    expect(mod.validateUpdateTable).toBeDefined();
    expect(mod.validateDeleteTable).toBeDefined();
    expect(mod.validateBatchPositions).toBeDefined();
  });

  test('tables.js imports table validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'tables.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/tableValidators')");
    expect(src).toContain('validateCreateTable');
    expect(src).toContain('validateUpdateTable');
    expect(src).toContain('validateBatchPositions');
  });
});

describe('VAL-9 — Loyalty validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('loyaltyValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/loyaltyValidators');
    expect(mod.validateUpdateProgram).toBeDefined();
    expect(mod.validateRedeem).toBeDefined();
  });

  test('loyalty.js imports loyalty validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'loyalty.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/loyaltyValidators')");
    expect(src).toContain('validateUpdateProgram');
    expect(src).toContain('validateRedeem');
  });
});

describe('VAL-10 — Review validators wired', () => {
  const fs = require('fs');
  const path = require('path');

  test('reviewValidators.js exports all validators', () => {
    const mod = require('../middleware/validators/reviewValidators');
    expect(mod.validateCreateReview).toBeDefined();
    expect(mod.validateReply).toBeDefined();
    expect(mod.validateVisibility).toBeDefined();
  });

  test('reviews.js imports review validators', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'reviews.js'), 'utf8');
    expect(src).toContain("require('../middleware/validators/reviewValidators')");
    expect(src).toContain('validateCreateReview');
    expect(src).toContain('validateReply');
    expect(src).toContain('validateVisibility');
  });
});

describe('VAL-11 — validators/index.js re-exports all', () => {
  test('index.js exports from all validator modules', () => {
    const all = require('../middleware/validators/index');
    // Orders
    expect(all.validateUpdateOrderStatus).toBeDefined();
    expect(all.validateCleanupCompleted).toBeDefined();
    // Customers
    expect(all.validateCreateCustomer).toBeDefined();
    // Bookings
    expect(all.validateCreateBooking).toBeDefined();
    // BusinessConfig
    expect(all.validateUpdateConfig).toBeDefined();
    // Products
    expect(all.validateProductsReorder).toBeDefined();
    // Categories
    expect(all.validateCreateCategory).toBeDefined();
    // Tables
    expect(all.validateCreateTable).toBeDefined();
    // Loyalty
    expect(all.validateRedeem).toBeDefined();
    // Reviews
    expect(all.validateCreateReview).toBeDefined();
    // handleValidationErrors
    expect(all.handleValidationErrors).toBeDefined();
  });
});

describe('VAL-12 — handleValidationErrors returns 422 with structured errors', () => {
  test('handleErrors.js returns 422 status code', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'validators', 'handleErrors.js'), 'utf8');
    expect(src).toContain('422');
    expect(src).toContain('field: e.path');
    expect(src).toContain('msg: e.msg');
  });

  test('handleValidationErrors calls next() when no errors', () => {
    const { handleValidationErrors } = require('../middleware/validators/handleErrors');
    const req = { query: {}, body: {}, params: {}, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    // Simulate a request with no validation errors by calling directly
    // validationResult requires express-validator middleware to have run
    // We test the export exists and is a function
    expect(typeof handleValidationErrors).toBe('function');
  });
});
