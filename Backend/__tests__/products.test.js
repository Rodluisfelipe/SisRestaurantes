/**
 * Unit tests for product validation
 * 
 * Tests the validateProductInput middleware used in products.js routes
 * for creating and updating products.
 */
const express = require('express');
const request = require('supertest');

// Replicate the inline validateProductInput from products.js
// (it's not exported, so we recreate the logic for isolated testing)
const validateProductInput = (req, res, next) => {
  const errors = [];
  let { name, price, businessId } = req.body;

  if (!name) {
    errors.push({ field: 'name', message: 'name es requerido' });
  } else if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name debe ser un string no vacío' });
  }

  if (price === undefined || price === null) {
    errors.push({ field: 'price', message: 'price es requerido' });
  } else {
    if (typeof price === 'string') {
      price = parseFloat(price);
      req.body.price = price;
    }
    if (typeof price !== 'number' || isNaN(price) || price < 0) {
      errors.push({ field: 'price', message: 'price debe ser un número >= 0' });
    }
  }

  if (req.method === 'POST') {
    if (!businessId) {
      errors.push({ field: 'businessId', message: 'businessId es requerido' });
    } else if (typeof businessId !== 'string') {
      errors.push({ field: 'businessId', message: 'businessId debe ser un string' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Errores de validación', errors });
  }
  next();
};

function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/products', validateProductInput, (req, res) => {
    res.status(201).json({ ok: true, name: req.body.name, price: req.body.price });
  });

  app.put('/products/:id', validateProductInput, (req, res) => {
    res.json({ ok: true, id: req.params.id, name: req.body.name });
  });

  // Simulate toggle active
  app.patch('/products/:id/toggle', (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    res.json({ ok: true, id, active: false });
  });

  // Simulate delete
  app.delete('/products/:id', (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    res.json({ ok: true, deleted: id });
  });

  return app;
}

describe('Products CRUD — Validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validProduct = {
    name: 'Hamburguesa BBQ',
    price: 25000,
    businessId: '507f1f77bcf86cd799439011',
  };

  // ─── CREATE PRODUCT ────────────────────────────
  describe('POST /products — Create', () => {
    test('accepts valid product', async () => {
      const res = await request(app).post('/products').send(validProduct);
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.name).toBe('Hamburguesa BBQ');
      expect(res.body.price).toBe(25000);
    });

    test('accepts product with price 0 (free item)', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, price: 0,
      });
      expect(res.status).toBe(201);
    });

    test('accepts product with string price (FormData)', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, price: '18500',
      });
      expect(res.status).toBe(201);
      expect(res.body.price).toBe(18500);
    });

    test('accepts product with optional fields', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct,
        description: 'Deliciosa hamburguesa con salsa BBQ',
        category: '507f1f77bcf86cd799439022',
        image: 'https://example.com/burger.jpg',
      });
      expect(res.status).toBe(201);
    });

    test('rejects missing name', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, name: undefined,
      });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].field).toBe('name');
    });

    test('rejects empty name', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, name: '   ',
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing price', async () => {
      const res = await request(app).post('/products').send({
        name: 'Test', businessId: validProduct.businessId,
      });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].field).toBe('price');
    });

    test('rejects negative price', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, price: -5000,
      });
      expect(res.status).toBe(400);
    });

    test('rejects NaN price', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, price: 'abc',
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing businessId on POST', async () => {
      const res = await request(app).post('/products').send({
        name: 'Test', price: 10000,
      });
      expect(res.status).toBe(400);
      expect(res.body.errors.some(e => e.field === 'businessId')).toBe(true);
    });

    test('rejects non-string businessId', async () => {
      const res = await request(app).post('/products').send({
        ...validProduct, businessId: 12345,
      });
      expect(res.status).toBe(400);
    });

    test('rejects multiple validation errors at once', async () => {
      const res = await request(app).post('/products').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── UPDATE PRODUCT ────────────────────────────
  describe('PUT /products/:id — Update', () => {
    test('accepts valid update (businessId not required for PUT)', async () => {
      const res = await request(app).put('/products/507f1f77bcf86cd799439033').send({
        name: 'Hamburguesa BBQ Especial',
        price: 28000,
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.name).toBe('Hamburguesa BBQ Especial');
    });

    test('rejects update with empty name', async () => {
      const res = await request(app).put('/products/507f1f77bcf86cd799439033').send({
        name: '', price: 28000,
      });
      expect(res.status).toBe(400);
    });

    test('rejects update with negative price', async () => {
      const res = await request(app).put('/products/507f1f77bcf86cd799439033').send({
        name: 'Test', price: -100,
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── TOGGLE ACTIVE ─────────────────────────────
  describe('PATCH /products/:id/toggle — Deactivate/Activate', () => {
    test('accepts valid ObjectId', async () => {
      const res = await request(app).patch('/products/507f1f77bcf86cd799439033/toggle');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('rejects invalid ID format', async () => {
      const res = await request(app).patch('/products/invalid-id/toggle');
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE PRODUCT ────────────────────────────
  describe('DELETE /products/:id — Delete', () => {
    test('accepts valid product ID', async () => {
      const res = await request(app).delete('/products/507f1f77bcf86cd799439033');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe('507f1f77bcf86cd799439033');
    });

    test('rejects invalid ID format', async () => {
      const res = await request(app).delete('/products/bad-id');
      expect(res.status).toBe(400);
    });
  });
});
