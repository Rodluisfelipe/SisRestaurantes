/**
 * Unit tests for Categories CRUD validation
 * 
 * Tests category creation, update, reorder, and deletion flows.
 */
const express = require('express');
const request = require('supertest');

// Simulate basic category validation (inline in categories.js)
function validateCategory(req, res, next) {
  const { name } = req.body;
  if (!name || (typeof name === 'string' && name.trim().length === 0)) {
    return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
  }
  if (typeof name === 'string' && name.trim().length > 100) {
    return res.status(400).json({ message: 'Nombre demasiado largo' });
  }
  next();
}

function createApp() {
  const app = express();
  app.use(express.json());

  // Create category
  app.post('/categories', validateCategory, (req, res) => {
    res.status(201).json({
      ok: true,
      name: req.body.name.trim(),
      businessId: req.body.businessId,
    });
  });

  // Reorder categories (MUST be before :id routes)
  app.put('/categories/reorder', (req, res) => {
    const { categories } = req.body;
    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ message: 'categories debe ser un array' });
    }
    res.json({ ok: true, count: categories.length });
  });

  // Update category
  app.put('/categories/:id', validateCategory, (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    res.json({ ok: true, id, name: req.body.name.trim() });
  });

  // List categories
  app.get('/categories', (req, res) => {
    const { businessId } = req.query;
    if (!businessId) {
      return res.json({ ok: true, categories: [] });
    }
    res.json({ ok: true, businessId, categories: [] });
  });

  // Delete category
  app.delete('/categories/:id', (req, res) => {
    const { id } = req.params;
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    res.json({ ok: true, deleted: id });
  });

  return app;
}

describe('Categories CRUD — Validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validCategory = {
    name: 'Hamburguesas',
    businessId: '507f1f77bcf86cd799439011',
  };

  // ─── CREATE ────────────────────────────────────
  describe('POST /categories — Create', () => {
    test('accepts valid category', async () => {
      const res = await request(app).post('/categories').send(validCategory);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Hamburguesas');
    });

    test('accepts category with description and displayOrder', async () => {
      const res = await request(app).post('/categories').send({
        ...validCategory,
        description: 'Las mejores hamburguesas',
        displayOrder: 1,
      });
      expect(res.status).toBe(201);
    });

    test('trims whitespace from name', async () => {
      const res = await request(app).post('/categories').send({
        ...validCategory, name: '  Pizzas  ',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Pizzas');
    });

    test('rejects empty name', async () => {
      const res = await request(app).post('/categories').send({
        ...validCategory, name: '',
      });
      expect(res.status).toBe(400);
    });

    test('rejects whitespace-only name', async () => {
      const res = await request(app).post('/categories').send({
        ...validCategory, name: '   ',
      });
      expect(res.status).toBe(400);
    });

    test('rejects name longer than 100 chars', async () => {
      const res = await request(app).post('/categories').send({
        ...validCategory, name: 'X'.repeat(101),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── LIST ──────────────────────────────────────
  describe('GET /categories — List', () => {
    test('returns categories for businessId', async () => {
      const res = await request(app).get('/categories?businessId=507f1f77bcf86cd799439011');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('returns empty array without businessId', async () => {
      const res = await request(app).get('/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([]);
    });
  });

  // ─── UPDATE ────────────────────────────────────
  describe('PUT /categories/:id — Update', () => {
    test('accepts valid update', async () => {
      const res = await request(app)
        .put('/categories/507f1f77bcf86cd799439022')
        .send({ name: 'Bebidas' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Bebidas');
    });

    test('rejects update with empty name', async () => {
      const res = await request(app)
        .put('/categories/507f1f77bcf86cd799439022')
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid ID format', async () => {
      const res = await request(app)
        .put('/categories/invalid')
        .send({ name: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE ────────────────────────────────────
  describe('DELETE /categories/:id — Delete', () => {
    test('accepts valid category ID', async () => {
      const res = await request(app).delete('/categories/507f1f77bcf86cd799439022');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe('507f1f77bcf86cd799439022');
    });

    test('rejects invalid ID', async () => {
      const res = await request(app).delete('/categories/bad');
      expect(res.status).toBe(400);
    });
  });

  // ─── REORDER ───────────────────────────────────
  describe('PUT /categories/reorder — Reorder', () => {
    test('accepts valid reorder payload', async () => {
      const res = await request(app).put('/categories/reorder').send({
        categories: [
          { _id: '507f1f77bcf86cd799439022', order: 0 },
          { _id: '507f1f77bcf86cd799439033', order: 1 },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test('rejects missing categories array', async () => {
      const res = await request(app).put('/categories/reorder').send({});
      expect(res.status).toBe(400);
    });

    test('rejects non-array categories', async () => {
      const res = await request(app).put('/categories/reorder').send({
        categories: 'not-array',
      });
      expect(res.status).toBe(400);
    });
  });
});
