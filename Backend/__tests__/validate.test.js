/**
 * Unit tests for validation middleware (express-validator chains)
 *
 * Uses supertest with a minimal Express app to exercise the validators
 * WITHOUT needing MongoDB or the full server.js boot.
 */
const express = require('express');
const request = require('supertest');
const {
  validateRegister,
  validateLogin,
  validateCreateOrder,
} = require('../middleware/validate');

/* -------- tiny Express app for testing -------- */
function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/register', validateRegister, (req, res) => res.json({ ok: true }));
  app.post('/login', validateLogin, (req, res) => res.json({ ok: true }));
  app.post('/order', validateCreateOrder, (req, res) => res.json({ ok: true }));

  return app;
}

/* ============================================== */
/*                 REGISTER                        */
/* ============================================== */
describe('POST /register validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const valid = {
    name: 'Juan',
    businessName: 'Mi Restaurante',
    email: 'juan@test.com',
    password: 'MiPass123',
    phone: '+57 300 123 4567',
  };

  test('accepts valid payload', async () => {
    const res = await request(app).post('/register').send(valid);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects missing name', async () => {
    const res = await request(app).post('/register').send({ ...valid, name: '' });
    expect(res.status).toBe(400);
  });

  test('rejects missing email', async () => {
    const res = await request(app).post('/register').send({ ...valid, email: '' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid email format', async () => {
    const res = await request(app).post('/register').send({ ...valid, email: 'not-email' });
    expect(res.status).toBe(400);
  });

  test('rejects short password', async () => {
    const res = await request(app).post('/register').send({ ...valid, password: '1234' });
    expect(res.status).toBe(400);
  });

  test('rejects missing businessName', async () => {
    const res = await request(app).post('/register').send({ ...valid, businessName: '' });
    expect(res.status).toBe(400);
  });

  test('rejects name longer than 100 chars', async () => {
    const res = await request(app).post('/register').send({ ...valid, name: 'A'.repeat(101) });
    expect(res.status).toBe(400);
  });
});

/* ============================================== */
/*                   LOGIN                         */
/* ============================================== */
describe('POST /login validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  test('accepts valid credentials', async () => {
    const res = await request(app).post('/login').send({ username: 'admin@test.com', password: 'Secret123' });
    expect(res.status).toBe(200);
  });

  test('rejects missing username', async () => {
    const res = await request(app).post('/login').send({ username: '', password: 'Secret123' });
    expect(res.status).toBe(400);
  });

  test('rejects missing password', async () => {
    const res = await request(app).post('/login').send({ username: 'admin@test.com', password: '' });
    expect(res.status).toBe(400);
  });

  test('rejects username longer than 100 chars', async () => {
    const res = await request(app).post('/login').send({ username: 'a'.repeat(101), password: 'x' });
    expect(res.status).toBe(400);
  });
});

/* ============================================== */
/*              CREATE ORDER                       */
/* ============================================== */
describe('POST /order validation', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const valid = {
    businessId: '507f1f77bcf86cd799439011',
    customerName: 'María',
    orderType: 'inSite',
    items: [{ name: 'Hamburguesa', quantity: 1, price: 15000 }],
    totalAmount: 15000,
  };

  test('accepts valid order', async () => {
    const res = await request(app).post('/order').send(valid);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects missing businessId', async () => {
    const res = await request(app).post('/order').send({ ...valid, businessId: '' });
    expect(res.status).toBe(400);
  });

  test('rejects missing customerName', async () => {
    const res = await request(app).post('/order').send({ ...valid, customerName: '' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid orderType', async () => {
    const res = await request(app).post('/order').send({ ...valid, orderType: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('rejects empty items array', async () => {
    const res = await request(app).post('/order').send({ ...valid, items: [] });
    expect(res.status).toBe(400);
  });

  test('rejects item without name', async () => {
    const res = await request(app).post('/order').send({
      ...valid,
      items: [{ name: '', quantity: 1, price: 100 }],
    });
    expect(res.status).toBe(400);
  });

  test('rejects item with quantity 0', async () => {
    const res = await request(app).post('/order').send({
      ...valid,
      items: [{ name: 'Agua', quantity: 0, price: 100 }],
    });
    expect(res.status).toBe(400);
  });

  test('rejects negative totalAmount', async () => {
    const res = await request(app).post('/order').send({ ...valid, totalAmount: -1 });
    expect(res.status).toBe(400);
  });

  test('rejects address longer than 500 chars', async () => {
    const res = await request(app).post('/order').send({
      ...valid,
      orderType: 'delivery',
      address: 'X'.repeat(501),
    });
    expect(res.status).toBe(400);
  });

  test('accepts delivery order with valid address', async () => {
    const res = await request(app).post('/order').send({
      ...valid,
      orderType: 'delivery',
      address: 'Calle 100 #10-20, Bogotá',
    });
    expect(res.status).toBe(200);
  });

  test('accepts takeaway order', async () => {
    const res = await request(app).post('/order').send({ ...valid, orderType: 'takeaway' });
    expect(res.status).toBe(200);
  });

  test('accepts customerName with max 100 chars', async () => {
    const res = await request(app).post('/order').send({ ...valid, customerName: 'A'.repeat(100) });
    expect(res.status).toBe(200);
  });

  test('rejects customerName longer than 100 chars', async () => {
    const res = await request(app).post('/order').send({ ...valid, customerName: 'A'.repeat(101) });
    expect(res.status).toBe(400);
  });
});
