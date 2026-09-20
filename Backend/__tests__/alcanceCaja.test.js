/**
 * El token de una caja registradora solo sirve para la caja.
 *
 * Es la diferencia entre perder una terminal y perder la cuenta del negocio.
 * El token vive noventa días en un equipo de mostrador que cualquiera puede
 * llevarse; sin este cierre valdría lo mismo que la sesión del dueño.
 *
 * Se prueba con un servidor Express de verdad, y una de las pruebas monta las
 * rutas en el orden equivocado a propósito: ese fue el error real —el
 * middleware quedó después de media docena de rutas y no las protegía— y una
 * prueba que solo mire el caso correcto no lo habría visto.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { alcanceCaja, PERMITIDO } = require('../middleware/alcanceCaja');

const tokenDe = (extra) => jwt.sign(
  { id: 'u1', businessId: '507f1f77bcf86cd799439011', role: 'admin', ...extra },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const tokenCaja = tokenDe({ scope: 'pos', caja: 'Caja principal', jti: 'abc-123' });
const tokenPanel = tokenDe({});

function servidor() {
  const app = express();
  app.use(express.json());
  app.use(alcanceCaja);
  app.get('/api/pos/catalog', (req, res) => res.json({ ok: true, caja: req.caja || null }));
  app.post('/api/pos/sync-sale', (req, res) => res.json({ ok: true }));
  app.get('/api/products', (req, res) => res.json({ ok: true }));
  app.put('/api/business-config', (req, res) => res.json({ ok: true }));
  app.get('/api/superadmin/businesses', (req, res) => res.json({ ok: true }));
  return app;
}

describe('un token de caja solo entra a /api/pos', () => {
  let app;
  beforeAll(() => { app = servidor(); });

  it('deja pasar lo del punto de venta', async () => {
    await request(app).get('/api/pos/catalog').set('Authorization', `Bearer ${tokenCaja}`).expect(200);
    await request(app).post('/api/pos/sync-sale').set('Authorization', `Bearer ${tokenCaja}`).expect(200);
  });

  it('le dice a la ruta qué caja está hablando', async () => {
    // Es lo que después permite revocarla desde el panel.
    const r = await request(app).get('/api/pos/catalog').set('Authorization', `Bearer ${tokenCaja}`);
    expect(r.body.caja).toEqual({ tokenId: 'abc-123', nombre: 'Caja principal' });
  });

  it.each([
    ['/api/products', 'get'],
    ['/api/business-config', 'put'],
    ['/api/superadmin/businesses', 'get'],
  ])('cierra %s', async (ruta, metodo) => {
    const r = await request(app)[metodo](ruta).set('Authorization', `Bearer ${tokenCaja}`);
    expect(r.status).toBe(403);
    expect(r.body.motivo).toBe('fuera_de_alcance');
  });

  it('la sesión del panel no se ve afectada', async () => {
    // Este cierre es solo para los tokens de caja: el dueño sigue pudiendo todo.
    await request(app).get('/api/products').set('Authorization', `Bearer ${tokenPanel}`).expect(200);
    await request(app).put('/api/business-config').set('Authorization', `Bearer ${tokenPanel}`).expect(200);
  });

  it('sin token no decide nada: eso lo hace la autenticación de cada ruta', async () => {
    await request(app).get('/api/products').expect(200);
  });

  it('un token falsificado tampoco pasa por caja', async () => {
    // Firmado con otro secreto: no se decodifica, así que no obtiene el permiso.
    const falso = jwt.sign({ scope: 'pos' }, 'otro-secreto', { expiresIn: '1h' });
    const r = await request(app).get('/api/pos/catalog').set('Authorization', `Bearer ${falso}`);
    expect(r.body.caja).toBeNull();
  });
});

describe('el orden de montaje importa', () => {
  it('una ruta montada ANTES del middleware queda desprotegida', async () => {
    /* Esto pasó de verdad: el middleware quedó después de /api/orders y media
       docena más, y esas rutas seguían aceptando tokens de caja sin que nada
       fallara. La prueba documenta el modo de fallo para que el día que alguien
       mueva la línea, se entienda por qué estaba donde estaba. */
    const app = express();
    app.get('/api/orders', (req, res) => res.json({ ok: true }));   // antes
    app.use(alcanceCaja);
    app.get('/api/products', (req, res) => res.json({ ok: true })); // después

    await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenCaja}`).expect(200);
    await request(app).get('/api/products').set('Authorization', `Bearer ${tokenCaja}`).expect(403);
  });

  it('el middleware va antes de la primera ruta de la API en server.js', () => {
    // La guardia de verdad: que nadie lo mueva sin darse cuenta.
    const fs = require('fs');
    const servidor = fs.readFileSync(require.resolve('../server.js'), 'utf8');

    const middleware = servidor.indexOf('app.use(alcanceCaja)');
    const primeraRuta = servidor.search(/app\.use\("\/api\//);

    expect(middleware).toBeGreaterThan(-1);
    expect(middleware).toBeLessThan(primeraRuta);
  });
});

describe('qué cuenta como ruta del punto de venta', () => {
  it('solo /api/pos/, no algo que empiece parecido', () => {
    expect(PERMITIDO.test('/api/pos/sync-sale')).toBe(true);
    expect(PERMITIDO.test('/api/posts')).toBe(false);
    expect(PERMITIDO.test('/api/pos')).toBe(false);
  });
});
