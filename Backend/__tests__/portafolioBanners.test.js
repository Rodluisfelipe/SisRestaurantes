/**
 * Los banners de la vitrina.
 *
 * Los pone el dueño desde su panel y los ve un cliente que entró por un enlace
 * de WhatsApp. Lo que se prueba es lo que separa esas dos puntas: que lo que
 * él apagó no salga, y que lo que dejó a medias no se convierta en un
 * rectángulo gris en mitad del carrusel.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../middleware/tenantAuth', () => ({
  tenantAuth: (req, res, next) => { req.user = { id: 'admin-1' }; next(); },
}));
jest.mock('../utils/marketplace', () => ({
  CAMPOS_VITRINA: 'businessName slug',
  filtroVisible: (extra) => extra,
}));
jest.mock('../Models/Portafolio', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../Models/BusinessConfig', () => ({ find: jest.fn() }));
jest.mock('../Models/Admin', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../utils/subscriptionHelper', () => ({
  getSubscriptionForBusiness: jest.fn(async () => ({ planConfig: {} })),
  isFeatureEnabledForPlan: jest.fn(() => true),
}));
jest.mock('../Routes/products', () => ({ buildPopularPayload: jest.fn() }));

const Portafolio = require('../Models/Portafolio');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');

const app = express();
app.use(express.json());
app.use('/', require('../Routes/portafolios'));

const conLean = (valor) => ({ lean: async () => valor });
const conSelect = (valor) => ({ select: () => conLean(valor) });

beforeEach(() => {
  jest.clearAllMocks();
  Admin.findById.mockReturnValue(conLean({ businessId: 'n1', accessibleBusinessIds: [] }));
  Portafolio.findOneAndUpdate.mockImplementation((filtro, { $set }) => conLean({ ...$set }));
});

const guardar = (banners) =>
  request(app).put('/').send({ nombre: 'Tura', slug: 'tura', negocios: [], banners });

describe('lo que se guarda', () => {
  it('descarta el banner sin imagen', async () => {
    /* Se crea con solo darle a "agregar" y guardar sin subir nada. Guardado,
       sería un rectángulo gris que el cliente desliza sin entender. */
    const r = await guardar([{ imagen: '', titulo: 'a medias' }, { imagen: 'https://x/a.jpg' }]);

    expect(r.status).toBe(200);
    expect(r.body.portafolio.banners).toHaveLength(1);
    expect(r.body.portafolio.banners[0].imagen).toBe('https://x/a.jpg');
  });

  it('no admite más de ocho', async () => {
    /* Nadie desliza más que eso, y sin tope el documento crece sin control. */
    const r = await guardar(Array.from({ length: 30 }, (_, i) => ({ imagen: `https://x/${i}.jpg` })));

    expect(r.body.portafolio.banners).toHaveLength(8);
  });

  it('conserva el orden en que los puso', async () => {
    /* El orden del arreglo es el orden del carrusel: es la única forma que
       tiene el dueño de decidir cuál se ve primero. */
    const r = await guardar([
      { imagen: 'https://x/1.jpg' },
      { imagen: 'https://x/2.jpg' },
      { imagen: 'https://x/3.jpg' },
    ]);

    expect(r.body.portafolio.banners.map((b) => b.imagen)).toEqual([
      'https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg',
    ]);
  });

  it('nace visible si no dicen lo contrario', async () => {
    const r = await guardar([{ imagen: 'https://x/a.jpg' }]);

    expect(r.body.portafolio.banners[0].activo).toBe(true);
  });

  it('respeta el apagado', async () => {
    const r = await guardar([{ imagen: 'https://x/a.jpg', activo: false }]);

    expect(r.body.portafolio.banners[0].activo).toBe(false);
  });

  it('un banner sin enlace se guarda igual', async () => {
    /* Hay quien los usa para anunciar un horario, no para llevar a ningún
       lado. Ese banner se dibuja pero no es clicable. */
    const r = await guardar([{ imagen: 'https://x/a.jpg', titulo: 'Cerrado el lunes' }]);

    expect(r.body.portafolio.banners[0].enlace).toBe('');
  });
});

describe('lo que ve el cliente', () => {
  const pagina = (banners) => {
    Portafolio.findOne.mockReturnValue(conLean({ slug: 'tura', negocios: [], banners }));
    BusinessConfig.find.mockReturnValue(conSelect([]));
    return request(app).get('/tura');
  };

  it('los apagados no salen', async () => {
    /* Apagar un banner es cómo se guarda el de la próxima promoción sin
       volver a subir la imagen. Si saliera igual, apagarlo no serviría. */
    const r = await pagina([
      { imagen: 'a.jpg', activo: true },
      { imagen: 'b.jpg', activo: false },
      { imagen: 'c.jpg', activo: true },
    ]);

    expect(r.body.portafolio.banners.map((b) => b.imagen)).toEqual(['a.jpg', 'c.jpg']);
  });

  it('una página sin banners responde una lista vacía, no un hueco', async () => {
    /* Los portafolios de antes de esta función no tienen el campo, y el
       carrusel del frontend hace `.length` sobre lo que llegue. */
    const r = await pagina(undefined);

    expect(r.body.portafolio.banners).toEqual([]);
  });
});

describe('el modelo', () => {
  const Modelo = jest.requireActual('../Models/Portafolio');

  it('un banner sin imagen no es válido', () => {
    const p = new Modelo({
      nombre: 'Tura', slug: 'tura', adminId: new mongoose.Types.ObjectId(),
      banners: [{ titulo: 'sin imagen' }],
    });

    expect(p.validateSync()?.errors?.['banners.0.imagen']).toBeDefined();
  });

  it('los portafolios de antes siguen valiendo', () => {
    /* El campo es nuevo: si fuera obligatorio, los que ya existen dejarían de
       poder guardarse. */
    const p = new Modelo({ nombre: 'Tura', slug: 'tura', adminId: new mongoose.Types.ObjectId() });

    expect(p.validateSync()).toBeUndefined();
    expect(p.banners).toHaveLength(0);
  });
});
