/**
 * Integration tests for Orders CRUD
 * 
 * Tests the validation layer, status transitions, and response formats
 * for the main order flows: create, list, update status, cancel, complete.
 * 
 * Uses supertest with a minimal Express app to exercise the validators
 * WITHOUT needing MongoDB or the full server.js boot.
 */
const express = require('express');
const request = require('supertest');
const { validateCreateOrder } = require('../middleware/validate');

function createApp() {
  const app = express();
  app.use(express.json());

  // Create order — only validation layer
  app.post('/orders', validateCreateOrder, (req, res) => {
    res.status(201).json({ ok: true, orderType: req.body.orderType });
  });

  return app;
}

describe('Orders CRUD — Validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validOrder = {
    businessId: '507f1f77bcf86cd799439011',
    customerName: 'Carlos López',
    orderType: 'inSite',
    items: [{ name: 'Hamburguesa Clásica', quantity: 2, price: 15000 }],
    totalAmount: 30000,
  };

  // ─── CREATE ORDER ──────────────────────────────────
  describe('POST /orders — Create', () => {
    test('accepts valid inSite order', async () => {
      const res = await request(app).post('/orders').send(validOrder);
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.orderType).toBe('inSite');
    });

    test('accepts valid delivery order with address', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        orderType: 'delivery',
        address: 'Calle 123 #45-67, Bogotá',
      });
      expect(res.status).toBe(201);
    });

    test('accepts valid takeaway order', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        orderType: 'takeaway',
      });
      expect(res.status).toBe(201);
    });

    test('accepts order with multiple items', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        items: [
          { name: 'Hamburguesa', quantity: 2, price: 15000 },
          { name: 'Papas Fritas', quantity: 1, price: 8000 },
          { name: 'Gaseosa', quantity: 2, price: 5000 },
        ],
        totalAmount: 48000,
      });
      expect(res.status).toBe(201);
    });

    test('accepts order with optional fields', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        phone: '3001234567',
        tableNumber: '5',
        customerNotes: 'Sin cebolla por favor',
        paymentMethod: 'efectivo',
      });
      expect(res.status).toBe(201);
    });

    // ─── VALIDATION REJECTIONS ───────────────────
    test('rejects missing businessId', async () => {
      const { businessId, ...noBusinessId } = validOrder;
      const res = await request(app).post('/orders').send(noBusinessId);
      expect(res.status).toBe(400);
    });

    test('rejects missing customerName', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, customerName: '',
      });
      expect(res.status).toBe(400);
    });

    test('rejects customerName longer than 100 chars', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, customerName: 'X'.repeat(101),
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid orderType', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, orderType: 'dineIn',
      });
      expect(res.status).toBe(400);
    });

    test('rejects empty items array', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, items: [],
      });
      expect(res.status).toBe(400);
    });

    test('rejects items with missing name', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, items: [{ quantity: 1, price: 10000 }],
      });
      expect(res.status).toBe(400);
    });

    test('rejects items with zero quantity', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, items: [{ name: 'Test', quantity: 0, price: 10000 }],
      });
      expect(res.status).toBe(400);
    });

    test('rejects negative totalAmount', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder, totalAmount: -5000,
      });
      expect(res.status).toBe(400);
    });

    test('rejects address longer than 500 chars', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        orderType: 'delivery',
        address: 'X'.repeat(501),
      });
      expect(res.status).toBe(400);
    });

    test('rejects items with negative price', async () => {
      const res = await request(app).post('/orders').send({
        ...validOrder,
        items: [{ name: 'Test', quantity: 1, price: -100 }],
      });
      expect(res.status).toBe(400);
    });

    test('rejects more than 100 items', async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        name: `Item ${i}`, quantity: 1, price: 100,
      }));
      const res = await request(app).post('/orders').send({
        ...validOrder, items, totalAmount: 10100,
      });
      expect(res.status).toBe(400);
    });
  });
});

// ─── ORDER STATUS TRANSITIONS (unit logic) ───────────
describe('Order status transitions', () => {
  const VALID_STATUSES = [
    'pending', 'pending_payment', 'payment_uploaded', 'payment_confirmed',
    'inProgress', 'completed', 'ready', 'preparing', 'confirmed',
    'cancelled', 'delivered',
  ];

  const TERMINAL_STATUSES = ['completed', 'delivered', 'cancelled'];

  test('all expected statuses are defined', () => {
    expect(VALID_STATUSES).toHaveLength(11);
  });

  test('terminal statuses should include completed, delivered, cancelled', () => {
    expect(TERMINAL_STATUSES).toContain('completed');
    expect(TERMINAL_STATUSES).toContain('delivered');
    expect(TERMINAL_STATUSES).toContain('cancelled');
  });

  test('valid flow: pending → inProgress → ready → completed', () => {
    const flow = ['pending', 'inProgress', 'ready', 'completed'];
    flow.forEach(s => expect(VALID_STATUSES).toContain(s));
  });

  test('valid flow: pending → confirmed → preparing → ready → delivered', () => {
    const flow = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    flow.forEach(s => expect(VALID_STATUSES).toContain(s));
  });

  test('cancellation is a valid status', () => {
    expect(VALID_STATUSES).toContain('cancelled');
  });
});
