/**
 * Cuentas del Panel LIVE desde el SuperAdmin.
 *
 * El panel confía en esta colección para dejar entrar a alguien, así que lo
 * que importa es que solo un admin la cambie, que el hash de la contraseña
 * nunca salga por la API y que los correos queden en la forma exacta con la
 * que el panel los busca (minúsculas, sin espacios).
 */
const express = require('express');
const request = require('supertest');

jest.mock('../middleware/authSuperAdmin', () => {
  const NIVEL = { auditor: 1, support: 2, admin: 3, owner: 4 };
  return {
    protectSuperAdmin: (req, res, next) => {
      req.user = { email: 'sa@menuby.tech', superAdminRole: req.headers['x-rol'] || 'admin' };
      next();
    },
    requireRole: (minimo) => (req, res, next) =>
      (NIVEL[req.user.superAdminRole] >= NIVEL[minimo] ? next() : res.status(403).json({ message: 'rol' })),
  };
});
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../Models/PanelLiveAcceso', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const PanelLiveAcceso = require('../Models/PanelLiveAcceso');

const app = express();
app.use(express.json());
app.use('/', require('../Routes/panelLive'));

const ID = '64b000000000000000000001';

afterEach(() => jest.clearAllMocks());

describe('quién puede administrar las cuentas', () => {
  it('support y auditor no pueden ver ni cambiar nada', async () => {
    for (const rol of ['support', 'auditor']) {
      expect((await request(app).get('/accesos').set('x-rol', rol)).status).toBe(403);
      expect((await request(app).post('/accesos').set('x-rol', rol).send({ email: 'a@b.co' })).status).toBe(403);
    }
    expect(PanelLiveAcceso.create).not.toHaveBeenCalled();
  });
});

describe('listar', () => {
  it('dice quién ya se registró sin devolver el hash', async () => {
    const lean = jest.fn().mockResolvedValue([
      { _id: '1', email: 'con@clave.co', passwordHash: 'scrypt$secreto', activo: false },
      { _id: '2', email: 'sin@clave.co', activo: true },
    ]);
    PanelLiveAcceso.find.mockReturnValue({ sort: () => ({ select: () => ({ lean }) }) });

    const res = await request(app).get('/accesos');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('scrypt');
    expect(res.body.accesos.map((a) => a.registrado)).toEqual([true, false]);
  });
});

describe('alta previa', () => {
  it('guarda el correo en minúsculas, ya aprobado y con quién lo dio', async () => {
    PanelLiveAcceso.create.mockImplementation(async (doc) => ({ _id: ID, ...doc }));
    const res = await request(app).post('/accesos').send({ email: '  Amigo@Gmail.COM ', nota: 'moderador' });
    expect(res.status).toBe(201);
    expect(PanelLiveAcceso.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'amigo@gmail.com', nota: 'moderador', activo: true, agregadoPor: 'sa@menuby.tech',
    }));
    expect(PanelLiveAcceso.create.mock.calls[0][0].aprobadoEn).toBeInstanceOf(Date);
  });

  it('rechaza correos inválidos y avisa si ya existe', async () => {
    for (const email of ['', 'sin-arroba', 'a@b', 'a b@c.co']) {
      expect((await request(app).post('/accesos').send({ email })).status).toBe(400);
    }
    PanelLiveAcceso.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    expect((await request(app).post('/accesos').send({ email: 'a@b.co' })).status).toBe(409);
  });
});

describe('aprobar, pausar y borrar', () => {
  const cuenta = (datos) => ({ email: 'a@b.co', save: jest.fn().mockResolvedValue(), ...datos });

  it('aprobar una cuenta pendiente marca cuándo se aprobó', async () => {
    const pendiente = cuenta({ activo: false, aprobadoEn: null });
    PanelLiveAcceso.findById.mockResolvedValue(pendiente);
    expect((await request(app).patch(`/accesos/${ID}`).send({ activo: true })).status).toBe(200);
    expect(pendiente.activo).toBe(true);
    expect(pendiente.aprobadoEn).toBeInstanceOf(Date);
  });

  it('pausar conserva la fecha de aprobación', async () => {
    const aprobada = new Date('2026-01-01');
    const activa = cuenta({ activo: true, aprobadoEn: aprobada });
    PanelLiveAcceso.findById.mockResolvedValue(activa);
    expect((await request(app).patch(`/accesos/${ID}`).send({ activo: false })).status).toBe(200);
    expect(activa.aprobadoEn).toBe(aprobada);
  });

  it('valida id y booleano; borrar una que no existe da 404', async () => {
    expect((await request(app).patch('/accesos/no-es-id').send({ activo: false })).status).toBe(400);
    expect((await request(app).patch(`/accesos/${ID}`).send({ activo: 'false' })).status).toBe(400);
    expect(PanelLiveAcceso.findById).not.toHaveBeenCalled();

    PanelLiveAcceso.findByIdAndDelete.mockResolvedValue(null);
    expect((await request(app).delete(`/accesos/${ID}`)).status).toBe(404);
  });
});
