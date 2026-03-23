/**
 * Unit tests for Auth validation (register + login)
 * 
 * Tests the express-validator chains for registration and login flows.
 */
const express = require('express');
const request = require('supertest');
const { validateRegister, validateLogin } = require('../middleware/validate');

function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/register', validateRegister, (req, res) => {
    res.status(201).json({ ok: true, email: req.body.email });
  });

  app.post('/login', validateLogin, (req, res) => {
    res.json({ ok: true, username: req.body.username });
  });

  return app;
}

describe('Auth — Registration Flow', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validRegister = {
    name: 'María García',
    businessName: 'Café de María',
    email: 'maria@test.com',
    password: 'MyPass123',
    phone: '+57 300 123 4567',
  };

  test('accepts valid registration', async () => {
    const res = await request(app).post('/register').send(validRegister);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.email).toBe('maria@test.com');
  });

  test('accepts registration with optional businessType', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, businessType: 'restaurante',
    });
    expect(res.status).toBe(201);
  });

  test('rejects empty name', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, name: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects name longer than 100 chars', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, name: 'A'.repeat(101),
    });
    expect(res.status).toBe(400);
  });

  test('rejects empty businessName', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, businessName: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects businessName longer than 100 chars', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, businessName: 'B'.repeat(101),
    });
    expect(res.status).toBe(400);
  });

  test('rejects invalid email format', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, email: 'not-an-email',
    });
    expect(res.status).toBe(400);
  });

  test('rejects missing email', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, email: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects password shorter than 8 chars', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, password: 'Ab1',
    });
    expect(res.status).toBe(400);
  });

  test('rejects missing password', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, password: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects missing phone', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, phone: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects phone shorter than 7 chars', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, phone: '123',
    });
    expect(res.status).toBe(400);
  });

  test('normalizes email to lowercase', async () => {
    const res = await request(app).post('/register').send({
      ...validRegister, email: 'MARIA@TEST.COM',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('maria@test.com');
  });
});

describe('Auth — Login Flow', () => {
  let app;
  beforeAll(() => { app = createApp(); });

  const validLogin = {
    username: 'maria@test.com',
    password: 'MyPass123',
  };

  test('accepts valid login', async () => {
    const res = await request(app).post('/login').send(validLogin);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects empty username', async () => {
    const res = await request(app).post('/login').send({
      ...validLogin, username: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects missing password', async () => {
    const res = await request(app).post('/login').send({
      ...validLogin, password: '',
    });
    expect(res.status).toBe(400);
  });

  test('rejects username longer than 100 chars', async () => {
    const res = await request(app).post('/login').send({
      ...validLogin, username: 'x'.repeat(101),
    });
    expect(res.status).toBe(400);
  });

  test('trims whitespace from username', async () => {
    const res = await request(app).post('/login').send({
      ...validLogin, username: '  maria@test.com  ',
    });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('maria@test.com');
  });
});
