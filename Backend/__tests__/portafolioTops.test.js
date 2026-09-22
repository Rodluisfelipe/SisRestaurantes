/**
 * La fila de "lo más pedido" debajo de cada negocio del portafolio.
 *
 * Es la misma sección que ya existe en la carta de cada negocio, así que lo
 * que importa es que respete sus reglas —que el negocio pueda apagarla, que el
 * plan la gobierne— y que un negocio que falle no deje sin fila a los demás:
 * esto llega después de que la página ya está pintada.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');

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
const { isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const { buildPopularPayload } = require('../Routes/products');

const app = express();
app.use(express.json());
app.use('/', require('../Routes/portafolios'));

const NEGOCIO = '6a90e02df6be190e3d31dda8';
const OTRO = '6a90d2ddf6be190e3d31b9bc';

/** Las cadenas de mongoose que usa la ruta. */
const conLean = (valor) => ({ lean: async () => valor });
const conSelect = (valor) => ({ select: () => conLean(valor) });

const pedirTops = (portafolio, negocios) => {
  Portafolio.findOne.mockReturnValue(conSelect(portafolio));
  BusinessConfig.find.mockReturnValue(conSelect(negocios));
  return request(app).get('/tura/tops');
};

const UN_NEGOCIO = [{ _id: NEGOCIO, currency: 'COP', popularSection: {} }];

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabledForPlan.mockReturnValue(true);
  buildPopularPayload.mockResolvedValue({
    products: [{
      _id: 'p1', name: 'Bowl', price: 26000, image: 'b.jpg',
      popular: { rank: 1, isTopSeller: true },
    }],
  });
});

describe('la fila de lo más pedido', () => {
  it('mira la semana y no el mes', async () => {
    /* Es lo que la fila promete. El negocio puede tener 30 días configurados
       para su propia carta, y acá se pide la semana igual. */
    await pedirTops({ negocios: [NEGOCIO] }, UN_NEGOCIO);

    expect(buildPopularPayload).toHaveBeenCalledWith(
      NEGOCIO,
      expect.objectContaining({ windowDays: 7 }),
    );
  });

  it('manda solo lo que la fila dibuja', async () => {
    /* El ranking devuelve el producto entero, con sus grupos de toppings. Son
       varios negocios en una sola respuesta: mandarlo completo multiplica el
       peso de la página por algo que no se ve. */
    const r = await pedirTops({ negocios: [NEGOCIO] }, UN_NEGOCIO);

    expect(r.body.tops[NEGOCIO].productos[0]).toEqual({
      _id: 'p1', name: 'Bowl', price: 26000, image: 'b.jpg', rank: 1, esTop: true,
    });
    expect(r.body.tops[NEGOCIO].moneda).toBe('COP');
  });

  it('si el negocio apagó su sección, no aparece', async () => {
    /* Un negocio que no muestra "los más pedidos" en su propia carta tampoco
       los muestra acá: es la misma decisión suya. */
    const r = await pedirTops(
      { negocios: [NEGOCIO] },
      [{ _id: NEGOCIO, popularSection: { enabled: false } }],
    );

    expect(r.body.tops).toEqual({});
    expect(buildPopularPayload).not.toHaveBeenCalled();
  });

  it('si el plan no la incluye, no aparece', async () => {
    isFeatureEnabledForPlan.mockReturnValue(false);

    const r = await pedirTops({ negocios: [NEGOCIO] }, UN_NEGOCIO);

    expect(r.body.tops).toEqual({});
  });

  it('un negocio sin ventas no deja un título con nada debajo', async () => {
    buildPopularPayload.mockResolvedValue({ products: [] });

    const r = await pedirTops({ negocios: [NEGOCIO] }, UN_NEGOCIO);

    expect(r.body.tops[NEGOCIO]).toBeUndefined();
  });

  it('que un negocio falle no deja sin fila a los demás', async () => {
    /* La página ya está pintada cuando esto llega: es un añadido, y el error
       de uno no puede volverse una respuesta vacía para todos. */
    buildPopularPayload
      .mockRejectedValueOnce(new Error('se cayó la agregación'))
      .mockResolvedValueOnce({ products: [{ _id: 'p2', name: 'Perro', price: 9000 }] });

    const r = await pedirTops(
      { negocios: [NEGOCIO, OTRO] },
      [{ _id: NEGOCIO, popularSection: {} }, { _id: OTRO, popularSection: {} }],
    );

    expect(r.status).toBe(200);
    expect(r.body.tops[OTRO].productos).toHaveLength(1);
    expect(r.body.tops[NEGOCIO]).toBeUndefined();
  });

  it('una página que no existe responde 404', async () => {
    const r = await pedirTops(null, []);

    expect(r.status).toBe(404);
  });
});

describe('la tarjeta que dibuja la página', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'portafolios.js'), 'utf8');

  it('manda la calificación, que es lo que la tarjeta pinta', () => {
    /* La página usa la misma tarjeta del marketplace, y esa dibuja la
       estrella. El campo ya venía seleccionado en `CAMPOS_VITRINA` y solo
       faltaba pasarlo: sin él, las tarjetas del portafolio salen sin
       calificación y las del catálogo con ella. */
    expect(src).toContain('reviewStats: b.reviewStats');
  });
});
