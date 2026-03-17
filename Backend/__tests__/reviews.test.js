/**
 * Unit tests for Reviews CRUD validation
 * 
 * Tests review creation validation, duplicate prevention, and query flows.
 */
const express = require('express');
const request = require('supertest');

function createApp() {
  const app = express();
  app.use(express.json());

  // Track created reviews for duplicate check simulation
  const createdReviews = new Set();

  // Create review — simulates validation logic from reviews.js
  app.post('/reviews', (req, res) => {
    const { phone, businessId, orderId, customerName, rating, comment, thumbsUp } = req.body;

    // Required fields
    if (!phone || !businessId || !orderId || !customerName || rating === undefined) {
      return res.status(400).json({
        message: 'phone, businessId, orderId, customerName y rating son requeridos',
      });
    }

    // Validate ObjectId format (24 hex chars)
    if (!/^[a-f\d]{24}$/i.test(businessId) || !/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ message: 'businessId u orderId inválido' });
    }

    // Rating validation
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ message: 'Rating debe ser un entero entre 1 y 5' });
    }

    // Duplicate check
    if (createdReviews.has(orderId)) {
      return res.status(409).json({ message: 'Ya existe una reseña para este pedido' });
    }
    createdReviews.add(orderId);

    res.status(201).json({
      success: true,
      review: { phone, businessId, orderId, customerName, rating, comment, thumbsUp },
    });
  });

  // List reviews
  app.get('/reviews', (req, res) => {
    const { businessId, page, limit, rating } = req.query;
    if (!businessId) {
      return res.status(400).json({ message: 'businessId es requerido' });
    }
    res.json({
      success: true,
      reviews: [],
      total: 0,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
  });

  // Check existing review for order
  app.get('/reviews/check/:orderId', (req, res) => {
    const { orderId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return res.status(400).json({ message: 'orderId inválido' });
    }
    const hasReview = createdReviews.has(orderId);
    res.json({ hasReview });
  });

  return app;
}

describe('Reviews CRUD — Validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validReview = {
    phone: '3001234567',
    businessId: '507f1f77bcf86cd799439011',
    orderId: '507f1f77bcf86cd799439099',
    customerName: 'Ana Martínez',
    rating: 5,
    comment: 'Excelente comida, muy recomendado!',
  };

  // ─── CREATE REVIEW ─────────────────────────────
  describe('POST /reviews — Create', () => {
    test('accepts valid 5-star review', async () => {
      const res = await request(app).post('/reviews').send(validReview);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.review.rating).toBe(5);
    });

    test('accepts review with thumbsUp', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview,
        orderId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        thumbsUp: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.review.thumbsUp).toBe(true);
    });

    test('accepts 1-star review', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview,
        orderId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        rating: 1,
        comment: 'Mala experiencia',
      });
      expect(res.status).toBe(201);
    });

    test('accepts review without comment', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview,
        orderId: 'cccccccccccccccccccccccc',
        comment: undefined,
      });
      expect(res.status).toBe(201);
    });

    // ─── DUPLICATE PREVENTION ────────────────────
    test('rejects duplicate review for same orderId', async () => {
      // First review for this order was already created in the first test
      const res = await request(app).post('/reviews').send(validReview);
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Ya existe');
    });

    // ─── VALIDATION REJECTIONS ───────────────────
    test('rejects missing phone', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, phone: undefined, orderId: 'dddddddddddddddddddddddd',
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing businessId', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, businessId: undefined, orderId: 'eeeeeeeeeeeeeeeeeeeeeeee',
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing orderId', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, orderId: undefined,
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing customerName', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, customerName: undefined, orderId: 'ffffffffffffffffffffffffffffff'.slice(0,24),
      });
      expect(res.status).toBe(400);
    });

    test('rejects missing rating', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, rating: undefined, orderId: '111111111111111111111111',
      });
      expect(res.status).toBe(400);
    });

    test('rejects invalid businessId format', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, businessId: 'not-an-objectid', orderId: '222222222222222222222222',
      });
      expect(res.status).toBe(400);
    });

    test('rejects rating 0', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, rating: 0, orderId: '333333333333333333333333',
      });
      expect(res.status).toBe(400);
    });

    test('rejects rating 6', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, rating: 6, orderId: '444444444444444444444444',
      });
      expect(res.status).toBe(400);
    });

    test('rejects non-integer rating', async () => {
      const res = await request(app).post('/reviews').send({
        ...validReview, rating: 3.5, orderId: '555555555555555555555555',
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── LIST REVIEWS ──────────────────────────────
  describe('GET /reviews — List', () => {
    test('returns reviews for businessId', async () => {
      const res = await request(app).get('/reviews?businessId=507f1f77bcf86cd799439011');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.reviews)).toBe(true);
    });

    test('supports pagination params', async () => {
      const res = await request(app).get('/reviews?businessId=507f1f77bcf86cd799439011&page=2&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    test('rejects missing businessId', async () => {
      const res = await request(app).get('/reviews');
      expect(res.status).toBe(400);
    });
  });

  // ─── CHECK EXISTING REVIEW ─────────────────────
  describe('GET /reviews/check/:orderId — Check', () => {
    test('returns true for order that already has review', async () => {
      const res = await request(app).get('/reviews/check/507f1f77bcf86cd799439099');
      expect(res.status).toBe(200);
      expect(res.body.hasReview).toBe(true);
    });

    test('returns false for order without review', async () => {
      const res = await request(app).get('/reviews/check/999999999999999999999999');
      expect(res.status).toBe(200);
      expect(res.body.hasReview).toBe(false);
    });

    test('rejects invalid orderId format', async () => {
      const res = await request(app).get('/reviews/check/bad-id');
      expect(res.status).toBe(400);
    });
  });
});
