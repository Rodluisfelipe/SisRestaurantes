/**
 * Una caja registradora no es una persona.
 *
 * El middleware de autenticación comprueba que quien trae un token siga
 * existiendo como Admin. Para el dueño eso es correcto: si se borra la cuenta,
 * su sesión tiene que morir. Para una caja no, porque el token de una caja lo
 * firma el negocio para una terminal y su `id` es el del negocio.
 *
 * Esto no es hipotético: el emparejamiento por código firmaba
 * `id: String(businessId)`, el middleware lo buscaba en la colección de
 * administradores, no lo encontraba, y toda caja vinculada con un código
 * respondía 401 "User no longer exists" al intentar sincronizar. La caja
 * quedaba conectada según el panel y no subía una sola venta.
 *
 * El camino de soporte —cambiar la sesión del panel por el token— no fallaba,
 * porque ahí el `id` sí era el de un Admin de verdad. Por eso pasó la primera
 * prueba de humo y se cayó en la instalación real.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

/* Los modelos se sustituyen para no necesitar Mongo: lo que se prueba es a
   quién se le consulta la existencia, no cómo responde la base. */
jest.mock('../Models/Admin', () => ({ exists: jest.fn() }));
jest.mock('../Models/SuperAdmin', () => ({ exists: jest.fn() }));

const Admin = require('../Models/Admin');
const authMiddleware = require('../middleware/authMiddleware');

const NEGOCIO = '507f1f77bcf86cd799439011';

const firmar = (carga) => jwt.sign(carga, process.env.JWT_SECRET, { expiresIn: '1h' });

/* Tal cual lo firma POST /api/pos/vincular: el `id` es el del negocio porque
   en ese momento no hay ninguna persona autenticada — la caja llega con un
   código de ocho caracteres, no con una sesión. */
const tokenCaja = firmar({
  id: NEGOCIO,
  businessId: NEGOCIO,
  role: 'admin',
  scope: 'pos',
  caja: 'Caja principal',
  jti: 'abc-123',
});

const tokenPanel = firmar({ id: 'admin-1', businessId: NEGOCIO, role: 'admin' });

function servidor() {
  const app = express();
  app.use(express.json());
  app.get('/probar', authMiddleware, (req, res) => res.json({ scope: req.user.scope || null }));
  return app;
}

describe('el token de una caja atraviesa la autenticación', () => {
  let app;
  beforeEach(() => {
    app = servidor();
    jest.clearAllMocks();
  });

  it('entra aunque su id no sea el de ningún administrador', async () => {
    // Que es el caso real: el id es el del negocio.
    Admin.exists.mockResolvedValue(null);

    const r = await request(app).get('/probar').set('Authorization', `Bearer ${tokenCaja}`);

    expect(r.status).toBe(200);
    expect(r.body.scope).toBe('pos');
  });

  it('ni siquiera le pregunta a la colección de administradores', async () => {
    /* No es una optimización, es la prueba de que se está mirando lo correcto:
       una caja se verifica contra las cajas del negocio, no contra su gente. */
    Admin.exists.mockResolvedValue(null);

    await request(app).get('/probar').set('Authorization', `Bearer ${tokenCaja}`);

    expect(Admin.exists).not.toHaveBeenCalled();
  });
});

describe('lo que esta excepción no puede aflojar', () => {
  let app;
  beforeEach(() => {
    app = servidor();
    jest.clearAllMocks();
  });

  it('una sesión de panel de alguien que ya no existe sigue cayendo', async () => {
    /* La comprobación original tiene su razón de ser: un empleado despedido no
       puede seguir entrando con el token que se llevó. La excepción de la caja
       no puede abrir esa puerta. */
    Admin.exists.mockResolvedValue(null);

    const r = await request(app).get('/probar').set('Authorization', `Bearer ${tokenPanel}`);

    expect(r.status).toBe(401);
    expect(Admin.exists).toHaveBeenCalled();
  });

  it('una sesión de panel válida sigue entrando', async () => {
    Admin.exists.mockResolvedValue({ _id: 'admin-1' });

    await request(app).get('/probar').set('Authorization', `Bearer ${tokenPanel}`).expect(200);
  });

  it('un scope inventado no se cuela por la excepción', async () => {
    /* La excepción es para el valor exacto 'pos' y nada más. Si bastara con
       traer cualquier `scope`, saltarse la comprobación de existencia sería
       tan fácil como firmar un token con uno. */
    Admin.exists.mockResolvedValue(null);

    const conScopeRaro = firmar({ id: 'quien-sea', businessId: NEGOCIO, role: 'admin', scope: 'pos-admin' });
    const r = await request(app).get('/probar').set('Authorization', `Bearer ${conScopeRaro}`);

    expect(r.status).toBe(401);
  });
});
