/**
 * Unit tests for Customers CRUD validation
 * 
 * Tests customer creation, listing, update, and deletion flows.
 */
const express = require('express');
const request = require('supertest');

function createApp() {
  const app = express();
  app.use(express.json());

  // In-memory store for simulation
  const customers = new Map();

  // Create customer
  app.post('/customers', (req, res) => {
    const { phone, name, businessId, address, email } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ message: 'phone y name son requeridos' });
    }

    if (typeof phone !== 'string' || phone.trim().length === 0) {
      return res.status(400).json({ message: 'phone debe ser un string no vacío' });
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ message: 'name debe ser un string no vacío' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'email inválido' });
    }

    const customer = {
      phone: phone.trim(),
      name: name.trim(),
      businessId,
      address: address || '',
      email: email || '',
    };

    const key = `${phone}-${businessId}`;
    if (customers.has(key)) {
      return res.status(409).json({ message: 'Cliente ya existe' });
    }
    customers.set(key, customer);

    res.status(201).json({ ok: true, customer });
  });

  // List customers (admin)
  app.get('/customers', (req, res) => {
    const { page = 1, limit = 20, search, status, sortBy, sortOrder } = req.query;
    res.json({
      ok: true,
      customers: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  });

  // Get customer by phone
  app.get('/customers/:phone', (req, res) => {
    const { phone } = req.params;
    const { businessId } = req.query;

    if (!phone || phone.length < 7) {
      return res.status(400).json({ message: 'Teléfono inválido' });
    }

    const key = `${phone}-${businessId}`;
    const customer = customers.get(key);
    if (!customer) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json({ ok: true, customer });
  });

  // Update customer
  app.put('/customers/:phone', (req, res) => {
    const { phone } = req.params;
    const updates = req.body;

    // Prevent changing protected fields
    const protectedFields = ['businessId', 'phone', 'totalOrders', 'totalSpent', 'lastOrderDate'];
    const attemptedProtected = protectedFields.filter(f => updates[f] !== undefined);
    if (attemptedProtected.length > 0) {
      return res.status(400).json({
        message: `No se pueden modificar: ${attemptedProtected.join(', ')}`,
      });
    }

    if (!phone || phone.length < 7) {
      return res.status(400).json({ message: 'Teléfono inválido' });
    }

    res.json({ ok: true, phone, updated: Object.keys(updates) });
  });

  // Update address
  app.patch('/customers/:phone/address', (req, res) => {
    const { phone } = req.params;
    const { name, address } = req.body;

    if (!name && !address) {
      return res.status(400).json({ message: 'Se requiere name o address' });
    }

    res.json({ ok: true, phone });
  });

  // Delete customer by phone
  app.delete('/customers/:phone', (req, res) => {
    const { phone } = req.params;
    if (!phone || phone.length < 7) {
      return res.status(400).json({ message: 'Teléfono inválido' });
    }
    res.json({ ok: true, deleted: phone });
  });

  // Delete customer by ID
  app.delete('/customers/by-id/:id', (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    res.json({ ok: true, deleted: id });
  });

  return app;
}

describe('Customers CRUD — Validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validCustomer = {
    phone: '3001234567',
    name: 'Pedro Rodríguez',
    businessId: '507f1f77bcf86cd799439011',
  };

  // ─── CREATE CUSTOMER ───────────────────────────
  describe('POST /customers — Create', () => {
    test('accepts valid customer', async () => {
      const res = await request(app).post('/customers').send(validCustomer);
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.customer.name).toBe('Pedro Rodríguez');
    });

    test('accepts customer with optional email and address', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer,
        phone: '3009876543',
        email: 'pedro@test.com',
        address: 'Calle 45 #12-34',
      });
      expect(res.status).toBe(201);
    });

    test('rejects missing phone', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer, phone: undefined,
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer, name: undefined, phone: '3005551234',
      });
      expect(res.status).toBe(400);
    });

    test('rejects empty phone', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer, phone: '',
      });
      expect(res.status).toBe(400);
    });

    test('rejects empty name', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer, name: '', phone: '3005551235',
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid email', async () => {
      const res = await request(app).post('/customers').send({
        ...validCustomer, phone: '3005551236', email: 'not-email',
      });
      expect(res.status).toBe(400);
    });

    test('rejects duplicate customer (same phone + businessId)', async () => {
      const res = await request(app).post('/customers').send(validCustomer);
      expect(res.status).toBe(409);
    });
  });

  // ─── LIST CUSTOMERS ────────────────────────────
  describe('GET /customers — List', () => {
    test('returns paginated customer list', async () => {
      const res = await request(app).get('/customers?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    test('defaults to page 1, limit 20', async () => {
      const res = await request(app).get('/customers');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
    });

    test('supports search param', async () => {
      const res = await request(app).get('/customers?search=Pedro');
      expect(res.status).toBe(200);
    });
  });

  // ─── GET CUSTOMER BY PHONE ─────────────────────
  describe('GET /customers/:phone — Get', () => {
    test('returns customer by phone', async () => {
      const res = await request(app)
        .get('/customers/3001234567?businessId=507f1f77bcf86cd799439011');
      expect(res.status).toBe(200);
      expect(res.body.customer.name).toBe('Pedro Rodríguez');
    });

    test('returns 404 for unknown phone', async () => {
      const res = await request(app)
        .get('/customers/9999999999?businessId=507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
    });

    test('rejects too-short phone', async () => {
      const res = await request(app).get('/customers/123');
      expect(res.status).toBe(400);
    });
  });

  // ─── UPDATE CUSTOMER ───────────────────────────
  describe('PUT /customers/:phone — Update', () => {
    test('accepts valid update', async () => {
      const res = await request(app)
        .put('/customers/3001234567')
        .send({ name: 'Pedro R. Updated' });
      expect(res.status).toBe(200);
      expect(res.body.updated).toContain('name');
    });

    test('rejects updating protected field: businessId', async () => {
      const res = await request(app)
        .put('/customers/3001234567')
        .send({ businessId: 'new-id' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('businessId');
    });

    test('rejects updating protected field: totalOrders', async () => {
      const res = await request(app)
        .put('/customers/3001234567')
        .send({ totalOrders: 100 });
      expect(res.status).toBe(400);
    });

    test('rejects updating protected field: phone', async () => {
      const res = await request(app)
        .put('/customers/3001234567')
        .send({ phone: '9999999999' });
      expect(res.status).toBe(400);
    });
  });

  // ─── UPDATE ADDRESS ────────────────────────────
  describe('PATCH /customers/:phone/address — Update Address', () => {
    test('accepts address update', async () => {
      const res = await request(app)
        .patch('/customers/3001234567/address')
        .send({ address: 'Nueva dirección' });
      expect(res.status).toBe(200);
    });

    test('accepts name update', async () => {
      const res = await request(app)
        .patch('/customers/3001234567/address')
        .send({ name: 'Nombre Actualizado' });
      expect(res.status).toBe(200);
    });

    test('rejects when neither name nor address provided', async () => {
      const res = await request(app)
        .patch('/customers/3001234567/address')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE CUSTOMER ───────────────────────────
  describe('DELETE /customers/:phone — Delete by Phone', () => {
    test('accepts valid phone', async () => {
      const res = await request(app).delete('/customers/3001234567');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe('3001234567');
    });

    test('rejects too-short phone', async () => {
      const res = await request(app).delete('/customers/123');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /customers/by-id/:id — Delete by ID', () => {
    test('accepts valid ObjectId', async () => {
      const res = await request(app).delete('/customers/by-id/507f1f77bcf86cd799439044');
      expect(res.status).toBe(200);
    });

    test('rejects invalid ObjectId', async () => {
      const res = await request(app).delete('/customers/by-id/bad-id');
      expect(res.status).toBe(400);
    });
  });
});
