/**
 * El CRM que la caja necesita: identificar al cliente y no perderle los puntos.
 *
 * Lo que se prueba acá es lo que se rompe en silencio:
 *
 * 1. Que un cliente pueda identificarse por documento sin que el índice único
 *    reviente con el segundo cliente que no tiene ninguno —que son casi todos—.
 * 2. Que el saldo a favor no pueda volverse negativo: ese campo es plata que el
 *    negocio le debe al cliente, no una línea de crédito.
 * 3. Que un canje reintentado por la cola de la caja cuente una sola vez.
 * 4. Que la duración de la toma llegue acotada y no ensucie el promedio.
 */
const mongoose = require('mongoose');
const Customer = require('../Models/Customer');
const LoyaltyTransaction = require('../Models/LoyaltyTransaction');
const { validarVenta } = require('../utils/pos');

const NEGOCIO = new mongoose.Types.ObjectId();

describe('la ficha del cliente', () => {
  it('acepta documento y tipo de documento', () => {
    const c = new Customer({
      businessId: NEGOCIO,
      phone: '3001234567',
      name: 'Marcela Ruiz',
      documento: '1017234567',
      tipoDocumento: 'CC',
    });

    expect(c.validateSync()).toBeUndefined();
    expect(c.documento).toBe('1017234567');
  });

  it('un cliente sin documento es lo normal y no falla', () => {
    /* La inmensa mayoría de los clientes de un restaurante nunca dan cédula.
       Si el campo fuera obligatorio, la caja no podría crear a nadie. */
    const c = new Customer({ businessId: NEGOCIO, phone: '3009999999', name: 'Mostrador' });

    expect(c.validateSync()).toBeUndefined();
    expect(c.documento).toBe('');
    expect(c.tipoDocumento).toBe('CC');
  });

  it('el índice de documento es parcial: no choca entre los que no lo tienen', () => {
    /* Sin `partialFilterExpression`, el segundo cliente sin documento tendría
       la misma cadena vacía que el primero y el índice único lo rechazaría.
       En un negocio con mil clientes eso significa poder crear exactamente
       uno. */
    const indices = Customer.schema.indexes();
    const porDocumento = indices.find(([campos]) => campos.documento === 1);

    expect(porDocumento).toBeDefined();
    expect(porDocumento[1].partialFilterExpression).toEqual({ documento: { $gt: '' } });
  });

  it('hay un índice por fecha de cambio, que es lo que la caja pide', () => {
    /* Sin él, cada sincronización de cada terminal recorre la colección
       entera. Con veinte terminales y veinte mil clientes eso es la base de
       datos ocupada todo el día. */
    const indices = Customer.schema.indexes();
    const porFecha = indices.find(
      ([campos]) => campos.businessId === 1 && campos.updatedAt === 1,
    );

    expect(porFecha).toBeDefined();
  });

  it('el saldo a favor no puede ser negativo', () => {
    /* Un saldo negativo significaría que el cliente le debe al negocio, que es
       cartera: otro problema, con vencimientos y cobranza. Mezclarlos en un
       campo termina en clientes con deuda que nadie cobra. */
    const c = new Customer({
      businessId: NEGOCIO,
      phone: '3001234567',
      name: 'Marcela',
      saldoFavor: -5000,
    });

    const error = c.validateSync();
    expect(error).toBeDefined();
    expect(error.errors.saldoFavor).toBeDefined();
  });
});

describe('el registro de canjes', () => {
  it('es único por venta y recompensa: un reintento no cuenta dos veces', () => {
    /* La cola de la caja reintenta hasta que confirmemos. Sin este índice, un
       reintento descontaría los puntos otra vez y el cliente pagaría dos veces
       por el mismo café. */
    const indices = LoyaltyTransaction.schema.indexes();
    const idempotencia = indices.find(
      ([campos]) => campos.posSaleId === 1 && campos.rewardId === 1,
    );

    expect(idempotencia).toBeDefined();
    expect(idempotencia[1].unique).toBe(true);
    // Parcial: los canjes del menú web no traen venta de caja.
    expect(idempotencia[1].partialFilterExpression).toEqual({ posSaleId: { $gt: '' } });
  });

  it('guarda quién autorizó y desde qué terminal', () => {
    const t = new LoyaltyTransaction({
      businessId: NEGOCIO,
      tipo: 'REDENCION',
      telefono: '3001234567',
      puntos: -100,
      origen: 'pos',
      autorizadoPor: 'Ana',
      cajaTokenId: 'jti-1',
      cajaNombre: 'Caja 1',
      posSaleId: '0192f8a1-7c4e-7000-8000-abcdef123456',
    });

    expect(t.validateSync()).toBeUndefined();
    expect(t.autorizadoPor).toBe('Ana');
    expect(t.cajaNombre).toBe('Caja 1');
  });

  it('un movimiento sin teléfono no se puede registrar', () => {
    /* El programa lleva los puntos por teléfono. Un movimiento sin él es un
       apunte contable que no se puede atribuir a nadie. */
    const t = new LoyaltyTransaction({ businessId: NEGOCIO, tipo: 'REDENCION', puntos: -100 });

    expect(t.validateSync().errors.telefono).toBeDefined();
  });
});

describe('la telemetría de la toma', () => {
  const VENTA = {
    id: '0192f8a1-7c4e-7000-8000-abcdef123456',
    total: 10000,
    creada_en: '2026-09-20T15:04:05-05:00',
    items: [{ producto_id: 'p1', nombre: 'Café', precio: 10000, cantidad: 1 }],
  };

  it('pasa tal cual cuando es razonable', () => {
    const r = validarVenta({ ...VENTA, duracion_toma_segundos: 47 });
    expect(r.ok).toBe(true);
    expect(r.venta.duracionTomaSegundos).toBe(47);
  });

  it('una venta que no la trae vale cero, no rompe nada', () => {
    /* Las cajas que todavía no se actualizaron siguen subiendo ventas sin este
       campo, y tienen que entrar igual. */
    const r = validarVenta(VENTA);
    expect(r.ok).toBe(true);
    expect(r.venta.duracionTomaSegundos).toBe(0);
  });

  it('una caja olvidada encendida no ensucia el promedio', () => {
    /* Cinco horas no es una toma: es una pantalla que quedó prendida desde la
       mañana. Ese único valor arruina el promedio del día. */
    const r = validarVenta({ ...VENTA, duracion_toma_segundos: 86400 });
    expect(r.venta.duracionTomaSegundos).toBe(7200);
  });

  it('basura o negativos valen cero', () => {
    expect(validarVenta({ ...VENTA, duracion_toma_segundos: -30 }).venta.duracionTomaSegundos).toBe(0);
    expect(validarVenta({ ...VENTA, duracion_toma_segundos: 'ayer' }).venta.duracionTomaSegundos).toBe(0);
  });
});

describe('las marcas de tiempo del pedido', () => {
  it('una venta de mostrador nace aceptada y entregada', () => {
    /* El cliente estaba ahí: no hay espera que medir entre esos dos puntos.
       Las marcas de cocina quedan vacías porque nunca ocurrieron, y vale más
       un hueco honesto que una hora inventada que después alguien promedia. */
    const CompletedOrder = require('../Models/CompletedOrder');
    const cuando = new Date('2026-09-20T20:04:05.000Z');

    const o = new CompletedOrder({
      businessId: NEGOCIO,
      orderNumber: 1,
      customerName: 'Mostrador',
      totalAmount: 10000,
      orderType: 'takeaway',
      createdAt: cuando,
      marcasTiempo: { aceptado: cuando, entregado: cuando, duracionTomaSegundos: 47 },
    });

    expect(o.validateSync()).toBeUndefined();
    expect(o.marcasTiempo.aceptado).toEqual(cuando);
    expect(o.marcasTiempo.listo).toBeNull();
    expect(o.marcasTiempo.duracionTomaSegundos).toBe(47);
  });

  it('el pedido vivo y el archivado se miden igual', () => {
    /* Si cada modelo llevara su propia copia, la primera marca que alguien
       agregue a uno solo haría que los informes mintieran en la mitad de los
       casos. */
    const Order = require('../Models/Order');
    const CompletedOrder = require('../Models/CompletedOrder');

    const campos = (M) =>
      Object.keys(M.schema.paths)
        .filter((p) => p.startsWith('marcasTiempo.'))
        .sort();

    expect(campos(Order)).toEqual(campos(CompletedOrder));
    expect(campos(Order).length).toBeGreaterThan(0);
  });
});
