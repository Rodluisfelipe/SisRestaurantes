/**
 * Las herramientas de la vitrina: banners, burbuja de ayuda y tops.
 *
 * Son cosas que configura el dueño desde su panel y que ve un cliente que
 * entró por un enlace de WhatsApp. Lo que se prueba acá es lo que separa esas
 * dos puntas: que lo que el dueño apagó no salga, que un botón de ayuda no
 * lleve a un WhatsApp roto, y que la fila de "lo más pedido" respete que un
 * negocio la haya apagado o que su plan no la incluya.
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
const Admin = require('../Models/Admin');
const { isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');
const { buildPopularPayload } = require('../Routes/products');

const app = express();
app.use(express.json());
app.use('/', require('../Routes/portafolios'));

const NEGOCIO = '6a90e02df6be190e3d31dda8';
const OTRO = '6a90d2ddf6be190e3d31b9bc';

/** Un `.lean()` al final de la cadena, como devuelve mongoose. */
const conLean = (valor) => ({ lean: async () => valor });
const conSelect = (valor) => ({ select: () => conLean(valor) });

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabledForPlan.mockReturnValue(true);

  /* El dueño tiene los dos negocios. */
  Admin.findById.mockReturnValue(conLean({ businessId: NEGOCIO, accessibleBusinessIds: [OTRO] }));
  Portafolio.findOneAndUpdate.mockImplementation((filtro, { $set }) => conLean({ ...$set }));
});

describe('los banners que se guardan', () => {
  const guardar = (banners) =>
    request(app).put('/').send({ nombre: 'Tura', slug: 'tura', negocios: [], banners });

  it('descarta el banner sin imagen', async () => {
    /* Un banner vacío es un hueco en el carrusel: el cliente desliza y
       encuentra un rectángulo gris. Pasa solo con darle "agregar" y no subir
       nada antes de guardar. */
    const r = await guardar([{ imagen: '', titulo: 'Sin foto' }, { imagen: 'https://x/a.jpg' }]);

    expect(r.status).toBe(200);
    expect(r.body.portafolio.banners).toHaveLength(1);
    expect(r.body.portafolio.banners[0].imagen).toBe('https://x/a.jpg');
  });

  it('no admite más de ocho', async () => {
    /* Nadie desliza más que eso, y sin tope el documento crece sin control. */
    const r = await guardar(Array.from({ length: 20 }, (_, i) => ({ imagen: `https://x/${i}.jpg` })));

    expect(r.body.portafolio.banners).toHaveLength(8);
  });

  it('nace visible si no dicen lo contrario', async () => {
    const r = await guardar([{ imagen: 'https://x/a.jpg' }]);

    expect(r.body.portafolio.banners[0].activo).toBe(true);
  });

  it('respeta el apagado', async () => {
    const r = await guardar([{ imagen: 'https://x/a.jpg', activo: false }]);

    expect(r.body.portafolio.banners[0].activo).toBe(false);
  });
});

describe('la burbuja de ayuda', () => {
  const guardar = (ayuda) =>
    request(app).put('/').send({ nombre: 'Tura', slug: 'tura', negocios: [], ayuda });

  it('no se enciende sin número', async () => {
    /* Es el punto entero del botón: sin número no lleva a ningún lado, y un
       botón de ayuda que no hace nada es peor que no ofrecer ayuda. */
    const r = await guardar({ activa: true, telefono: '' });

    expect(r.body.portafolio.ayuda.activa).toBe(false);
  });

  it('se enciende con número', async () => {
    const r = await guardar({ activa: true, telefono: '3154087774', mensaje: 'Hola' });

    expect(r.body.portafolio.ayuda).toMatchObject({
      activa: true,
      telefono: '3154087774',
      mensaje: 'Hola',
    });
  });

  it('guardar el número sin encenderla la deja apagada', async () => {
    /* Dejar el número listo y encenderla después es una forma legítima de
       usar la pantalla. */
    const r = await guardar({ activa: false, telefono: '3154087774' });

    expect(r.body.portafolio.ayuda.activa).toBe(false);
    expect(r.body.portafolio.ayuda.telefono).toBe('3154087774');
  });
});

describe('lo que ve el cliente en la página', () => {
  const pagina = (portafolio) => {
    Portafolio.findOne.mockReturnValue(conLean(portafolio));
    BusinessConfig.find.mockReturnValue(conSelect([]));
    return request(app).get('/tura');
  };

  it('los banners apagados no salen', async () => {
    /* Apagar un banner es cómo se guarda el de la próxima promoción sin
       volver a subir la imagen. Si saliera igual, apagarlo no serviría. */
    const r = await pagina({
      slug: 'tura', negocios: [],
      banners: [
        { imagen: 'a.jpg', activo: true },
        { imagen: 'b.jpg', activo: false },
      ],
    });

    expect(r.body.portafolio.banners).toHaveLength(1);
    expect(r.body.portafolio.banners[0].imagen).toBe('a.jpg');
  });

  it('la ayuda apagada no viaja al cliente', async () => {
    /* El teléfono del dueño no tiene por qué ir en la respuesta de una página
       pública si no puso el botón. */
    const r = await pagina({
      slug: 'tura', negocios: [],
      ayuda: { activa: false, telefono: '3154087774' },
    });

    expect(r.body.portafolio.ayuda).toBeNull();
  });

  it('la ayuda encendida sí', async () => {
    const r = await pagina({
      slug: 'tura', negocios: [],
      ayuda: { activa: true, telefono: '3154087774' },
    });

    expect(r.body.portafolio.ayuda.telefono).toBe('3154087774');
  });

  it('una página sin banners responde una lista, no un hueco', async () => {
    /* Los portafolios de antes de esta función no tienen el campo. */
    const r = await pagina({ slug: 'tura', negocios: [] });

    expect(r.body.portafolio.banners).toEqual([]);
    expect(r.body.portafolio.mostrarTops).toBe(true);
  });
});

describe('la fila de lo más pedido', () => {
  const pedirTops = (portafolio, negocios) => {
    Portafolio.findOne.mockReturnValue(conSelect(portafolio));
    BusinessConfig.find.mockReturnValue(conSelect(negocios));
    return request(app).get('/tura/tops');
  };

  const UNO = [{ _id: NEGOCIO, currency: 'COP', popularSection: {} }];

  beforeEach(() => {
    buildPopularPayload.mockResolvedValue({
      title: 'Los más pedidos',
      products: [{ _id: 'p1', name: 'Bowl', price: 26000, image: 'b.jpg', popular: { rank: 1, isTopSeller: true } }],
    });
  });

  it('mira la semana y no el mes', async () => {
    /* Es lo que la página promete. El negocio puede tener configurados 30
       días para su propia carta y acá se pide la semana igual. */
    await pedirTops({ negocios: [NEGOCIO], mostrarTops: true }, UNO);

    expect(buildPopularPayload).toHaveBeenCalledWith(NEGOCIO, expect.objectContaining({ windowDays: 7 }));
  });

  it('manda solo lo que la fila dibuja', async () => {
    /* El ranking devuelve el producto entero, con sus grupos de toppings. Son
       varios negocios en una respuesta: mandarlo completo multiplica el peso
       de la página por algo que no se ve. */
    const r = await pedirTops({ negocios: [NEGOCIO], mostrarTops: true }, UNO);
    const producto = r.body.tops[NEGOCIO].productos[0];

    expect(producto).toEqual({ _id: 'p1', name: 'Bowl', price: 26000, image: 'b.jpg', rank: 1, esTop: true });
    expect(r.body.tops[NEGOCIO].moneda).toBe('COP');
  });

  it('si el dueño apagó la fila, no se calcula nada', async () => {
    /* Y sobre todo: no se hacen las agregaciones de ventas de cada negocio
       para después tirarlas. */
    const r = await pedirTops({ negocios: [NEGOCIO], mostrarTops: false }, UNO);

    expect(r.body.tops).toEqual({});
    expect(buildPopularPayload).not.toHaveBeenCalled();
  });

  it('si el negocio apagó su sección, no aparece', async () => {
    /* Un negocio que no muestra "los más pedidos" en su propia carta tampoco
       los muestra acá: es la misma decisión suya. */
    const r = await pedirTops(
      { negocios: [NEGOCIO], mostrarTops: true },
      [{ _id: NEGOCIO, popularSection: { enabled: false } }],
    );

    expect(r.body.tops).toEqual({});
    expect(buildPopularPayload).not.toHaveBeenCalled();
  });

  it('si el plan no la incluye, no aparece', async () => {
    isFeatureEnabledForPlan.mockReturnValue(false);

    const r = await pedirTops({ negocios: [NEGOCIO], mostrarTops: true }, UNO);

    expect(r.body.tops).toEqual({});
  });

  it('que un negocio falle no deja sin fila a los demás', async () => {
    /* La página ya está pintada cuando esto llega: es un añadido, y un error
       de uno no puede volverse una respuesta vacía para todos. */
    buildPopularPayload
      .mockRejectedValueOnce(new Error('se cayó la agregación'))
      .mockResolvedValueOnce({ title: 'Los más pedidos', products: [{ _id: 'p2', name: 'Perro', price: 9000 }] });

    const r = await pedirTops(
      { negocios: [NEGOCIO, OTRO], mostrarTops: true },
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
