/**
 * Comprobantes de pago: el token va en la cabecera, nunca en la dirección.
 * Con ?token=… quedaba en el historial del navegador y en los registros.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'prueba';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const proofAuth = require('../middleware/proofAuth');

const app = express();
app.use('/uploads/proofs', proofAuth('subscription'), (req, res) => res.send('archivo'));

const token = jwt.sign({ id: 'x', role: 'superadmin' }, process.env.JWT_SECRET);

describe('proofAuth', () => {
  it('entra con la sesión en la cabecera', async () => {
    const r = await request(app).get('/uploads/proofs/a.jpg').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('no acepta el token en la dirección', async () => {
    const r = await request(app).get(`/uploads/proofs/a.jpg?token=${token}`);
    expect(r.status).toBe(401);
  });

  it('sin sesión, nada', async () => {
    const r = await request(app).get('/uploads/proofs/a.jpg');
    expect(r.status).toBe(401);
  });
});
