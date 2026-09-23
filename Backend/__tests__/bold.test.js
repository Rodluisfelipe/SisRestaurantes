/**
 * Cobrar con tarjeta en el menú, por Bold.
 *
 * Lo que se prueba acá es dinero, así que el orden de importancia es:
 *
 *   1. Que el monto que se firma salga de la base y no del navegador. La firma
 *      existe para que el monto no se pueda alterar; firmarle al cliente lo
 *      que él mande sería ponerle llave a la puerta y dejarla abierta.
 *   2. Que un aviso de pago no pueda confirmar el pedido de otro negocio, ni
 *      confirmar dos veces, ni confirmar por un monto distinto.
 *   3. Que la llave secreta no salga nunca del servidor.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';
/* 32 bytes en hex: lo que secretBox exige para cifrar. */
process.env.SECRET_BOX_KEY = 'a'.repeat(64);

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../middleware/tenantAuth', () => ({
  tenantAuth: (req, res, next) => { req.user = { businessId: 'neg-1' }; next(); },
}));
jest.mock('../services/socketService', () => ({ emitToBusiness: jest.fn() }));
jest.mock('../Models/Order', () => ({ findById: jest.fn() }));
jest.mock('../Models/BoldCuenta', () => ({ findOne: jest.fn() }));
jest.mock('../Models/BusinessConfig', () => ({ findById: jest.fn() }));

const Order = require('../Models/Order');
const BoldCuenta = require('../Models/BoldCuenta');
const BusinessConfig = require('../Models/BusinessConfig');
const socketService = require('../services/socketService');

const app = express();
app.use(express.json());
app.use('/', require('../Routes/bold'));

const SECRETA = 'S9dblmIZOw6EzxuV8AuoQw';
const TOKEN = 'f'.repeat(48);
const PEDIDO = '6a90e02df6be190e3d31dda8';
const NEGOCIO = 'neg-1';

/** Una cuenta lista para cobrar. */
const cuentaLista = (extra = {}) => ({
  businessId: NEGOCIO,
  identidad: 'H1BUdSA_rX1NGf2FKuFvVC4vUiaX2K_dXTswUq4tDXE',
  webhookToken: TOKEN,
  lista: () => true,
  getSecreta: () => SECRETA,
  save: jest.fn(),
  ...extra,
});

/** Un pedido esperando pago: total 26.000 más 3.000 de domicilio. */
const pedidoEsperando = (extra = {}) => ({
  _id: PEDIDO,
  businessId: NEGOCIO,
  orderNumber: 42,
  totalAmount: 26000,
  deliveryFee: 3000,
  finalAmount: 29000,
  status: 'pending_payment',
  save: jest.fn(),
  ...extra,
});

/** Como lo devuelve mongoose cuando la ruta encadena select/lean. */
const comoLean = (valor) => ({ select: () => ({ lean: () => ({ catch: async () => valor }) }) });

/* En beta solo go-burger. La lista vive en el entorno para que sumar un
   negocio sea configuracion y no despliegue. */
process.env.BOLD_BETA_SLUGS = 'go-burger';
const comoSlug = (slug) => ({ select: () => ({ lean: async () => ({ slug }) }) });

beforeEach(() => {
  jest.clearAllMocks();
  BoldCuenta.findOne.mockResolvedValue(cuentaLista());
  BusinessConfig.findById.mockReturnValue(comoSlug('go-burger'));
});

describe('la firma que se le da al menú', () => {
  const pedirFirma = (cuerpo) => request(app).post('/firma').send(cuerpo);

  it('firma el total de la base, no lo que mande el navegador', async () => {
    /* La prueba que sostiene todo. Si firmara lo que llega, cualquiera con la
       consola abierta cambia un pedido de $29.000 por uno de $1.000 y Bold lo
       acepta, porque la firma vendría correcta para ese monto. */
    Order.findById.mockReturnValue(comoLean(pedidoEsperando()));

    const r = await pedirFirma({ orderId: PEDIDO, monto: '1000', amount: '1000' });

    expect(r.status).toBe(200);
    expect(r.body.monto).toBe('29000');
  });

  it('cobra el total con domicilio, no el subtotal', async () => {
    /* `totalAmount` por convención NO incluye el envío; `finalAmount` sí.
       Firmar el primero seria regalar el domicilio en cada pedido. */
    Order.findById.mockReturnValue(comoLean(pedidoEsperando()));

    const r = await pedirFirma({ orderId: PEDIDO });

    expect(r.body.monto).toBe('29000');
    expect(r.body.monto).not.toBe('26000');
  });

  it('la firma es la que Bold acepta', async () => {
    /* sha256(orden + monto + moneda + secreta). Se averiguó probando contra
       su servidor; si alguien la "corrige", esto lo detiene. */
    Order.findById.mockReturnValue(comoLean(pedidoEsperando()));

    const r = await pedirFirma({ orderId: PEDIDO });
    const esperada = crypto.createHash('sha256')
      .update(`${PEDIDO}29000COP${SECRETA}`)
      .digest('hex');

    expect(r.body.firma).toBe(esperada);
  });

  it('nunca devuelve la llave secreta', async () => {
    Order.findById.mockReturnValue(comoLean(pedidoEsperando()));

    const r = await pedirFirma({ orderId: PEDIDO });

    expect(JSON.stringify(r.body)).not.toContain(SECRETA);
  });

  it('no vuelve a firmar un pedido ya pagado', async () => {
    /* Sin esto, el enlace de un pedido viejo sirve para cobrarlo otra vez. */
    Order.findById.mockReturnValue(comoLean(pedidoEsperando({ status: 'payment_confirmed' })));

    const r = await pedirFirma({ orderId: PEDIDO });

    expect(r.status).toBe(409);
  });

  it('no firma si el negocio no tiene el pago activo', async () => {
    BoldCuenta.findOne.mockResolvedValue(cuentaLista({ lista: () => false }));
    Order.findById.mockReturnValue(comoLean(pedidoEsperando()));

    const r = await pedirFirma({ orderId: PEDIDO });

    expect(r.status).toBe(409);
  });

  it('un pedido que no existe es 404, no un 500', async () => {
    Order.findById.mockReturnValue(comoLean(null));

    expect((await pedirFirma({ orderId: PEDIDO })).status).toBe(404);
  });
});

describe('el aviso de pago de Bold', () => {
  const avisar = (cuerpo, token = TOKEN) =>
    request(app).post(`/webhook/${token}`).send(cuerpo);

  const APROBADO = {
    reference: PEDIDO,
    status: 'APPROVED',
    amount: { total: 29000 },
  };

  it('confirma el pedido cuando el pago pasa', async () => {
    const pedido = pedidoEsperando();
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar(APROBADO);

    expect(pedido.status).toBe('payment_confirmed');
    expect(pedido.paymentMethod).toBe('bold');
    expect(pedido.save).toHaveBeenCalled();
  });

  it('le avisa al panel, que hay comida esperando', async () => {
    Order.findById.mockReturnValue({ catch: async () => pedidoEsperando() });

    await avisar(APROBADO);

    expect(socketService.emitToBusiness).toHaveBeenCalled();
  });

  it('un token desconocido no confirma nada', async () => {
    /* La única barrera mientras no esté la verificación de firma de Bold. */
    BoldCuenta.findOne.mockResolvedValue(null);
    const pedido = pedidoEsperando();
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar(APROBADO, 'e'.repeat(48));

    expect(pedido.status).toBe('pending_payment');
  });

  it('no confirma el pedido de otro negocio', async () => {
    /* Sin esto, el token de un negocio serviria para confirmar pedidos ajenos. */
    const pedido = pedidoEsperando({ businessId: 'otro-negocio' });
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar(APROBADO);

    expect(pedido.status).toBe('pending_payment');
  });

  it('no confirma si el monto avisado no coincide', async () => {
    /* La última defensa: si el aviso viniera alterado, acá se cae. */
    const pedido = pedidoEsperando();
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar({ ...APROBADO, amount: { total: 1000 } });

    expect(pedido.status).toBe('pending_payment');
  });

  it('un pago rechazado deja el pedido esperando, no lo cancela', async () => {
    /* El cliente puede reintentar con otra tarjeta; cancelarlo por él lo
       obligaria a armar el pedido de nuevo. */
    const pedido = pedidoEsperando();
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar({ ...APROBADO, status: 'REJECTED' });

    expect(pedido.status).toBe('pending_payment');
  });

  it('el aviso repetido no avanza el pedido dos veces', async () => {
    /* Bold reintenta los webhooks. */
    const pedido = pedidoEsperando({ status: 'payment_confirmed' });
    Order.findById.mockReturnValue({ catch: async () => pedido });

    await avisar(APROBADO);

    expect(pedido.save).not.toHaveBeenCalled();
  });

  it('siempre responde 200, aunque el pedido no exista', async () => {
    /* Un webhook que recibe errores se reintenta. Un reintento infinito por un
       pedido que no existe es ruido que tapa los avisos que si importan. */
    Order.findById.mockReturnValue({ catch: async () => null });

    expect((await avisar(APROBADO)).status).toBe(200);
  });
});

describe('guardar las llaves desde el panel', () => {
  it('no se puede activar sin las dos llaves', async () => {
    /* El menú ofreceria tarjeta y el cliente se estrellaria al confirmar. */
    const Real = jest.requireActual('../Models/BoldCuenta');
    BoldCuenta.findOne.mockResolvedValue(new Real({ businessId: NEGOCIO, identidad: 'solo-una' }));

    const r = await request(app).put('/cuenta').send({ activa: true });

    expect(r.status).toBe(400);
  });

  it('guardar sin mandar la secreta no la borra', async () => {
    /* El formulario nunca trae la secreta de vuelta. Si el vacio se tratara
       como "borrala", cada guardado dejaria al negocio sin poder cobrar. */
    const Real = jest.requireActual('../Models/BoldCuenta');
    const cuenta = new Real({ businessId: NEGOCIO, identidad: 'abc' });
    cuenta.setSecreta(SECRETA);
    cuenta.save = jest.fn();
    BoldCuenta.findOne.mockResolvedValue(cuenta);

    await request(app).put('/cuenta').send({ identidad: 'nueva' });

    expect(cuenta.getSecreta()).toBe(SECRETA);
  });

  it('el panel nunca recibe la secreta', async () => {
    const Real = jest.requireActual('../Models/BoldCuenta');
    const cuenta = new Real({ businessId: NEGOCIO, identidad: 'abc' });
    cuenta.setSecreta(SECRETA);
    BoldCuenta.findOne.mockResolvedValue(cuenta);

    const r = await request(app).get('/cuenta');

    expect(JSON.stringify(r.body)).not.toContain(SECRETA);
    expect(r.body.cuenta.secretaPuesta).toBe(true);
    expect(r.body.cuenta.secretaPista).toBe('uoQw');
  });

  it('un negocio fuera de la beta no puede encenderlo', async () => {
    /* Mueve dinero real y todavia falta verificar la firma del webhook: se
       prueba con uno antes de abrirlo a los 26. */
    BusinessConfig.findById.mockReturnValue(comoSlug('fraise'));

    const r = await request(app).put('/cuenta').send({ identidad: 'abc' });

    expect(r.status).toBe(403);
    expect(r.body.motivo).toBe('fuera_de_beta');
  });

  it('con la lista vacia no lo enciende nadie', async () => {
    /* El valor por defecto tiene que ser el cerrado: si alguien despliega sin
       la variable, que no quede abierto para todos. */
    const antes = process.env.BOLD_BETA_SLUGS;
    process.env.BOLD_BETA_SLUGS = '';

    const r = await request(app).put('/cuenta').send({ identidad: 'abc' });

    process.env.BOLD_BETA_SLUGS = antes;
    expect(r.status).toBe(403);
  });

  it('rechaza un entorno inventado', async () => {
    /* pruebas o produccion. Un valor raro dejaria la cuenta en un estado que
       nadie sabe interpretar. */
    const r = await request(app).put('/cuenta').send({ entorno: 'casi-produccion' });

    expect(r.status).toBe(400);
  });
});

describe('la llave secreta en la base', () => {
  const Real = jest.requireActual('../Models/BoldCuenta');

  it('se guarda cifrada, no en claro', async () => {
    const cuenta = new Real({ businessId: NEGOCIO });
    cuenta.setSecreta(SECRETA);

    expect(cuenta.secretaEnc).not.toContain(SECRETA);
    expect(cuenta.getSecreta()).toBe(SECRETA);
  });

  it('cada cuenta nace con su propio token de webhook', async () => {
    const a = new Real({ businessId: 'n1' });
    const b = new Real({ businessId: 'n2' });

    expect(a.webhookToken).not.toBe(b.webhookToken);
    expect(a.webhookToken.length).toBeGreaterThanOrEqual(48);
  });
});
