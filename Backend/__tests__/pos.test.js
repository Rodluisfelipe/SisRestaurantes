/**
 * La caja nativa contra la nube.
 *
 * Dos cosas se prueban acá, que son las dos que cuestan plata:
 *
 * 1. Que el servidor no acepte una venta incoherente. La caja ya cobró, así que
 *    el servidor no corrige precios —eso sería reescribir lo que el cliente
 *    pagó— pero sí rechaza lo que no cuadra consigo mismo.
 * 2. Que el catálogo baje aplanado y completo, incluidos los apagados: si solo
 *    bajaran los activos, un producto descontinuado se quedaría para siempre en
 *    la caja y se seguiría vendiendo.
 */
const { validarVenta, validarCierre, aplanarCatalogo } = require('../utils/pos');

const VENTA = {
  id: '0192f8a1-7c4e-7000-8000-abcdef123456',   // UUIDv7 de la caja
  consecutivo: 143,
  total: 14500,
  iva: 0,
  medio_pago: 'efectivo',
  cajero: 'Ana',
  turno_id: 't1',
  creada_en: '2026-09-20T15:04:05-05:00',
  items: [
    { producto_id: 'p1', nombre: 'Café', variante: '', precio: 5000, cantidad: 2 },
    { producto_id: 'p2', nombre: 'Pan', variante: '', precio: 1500, cantidad: 3 },
  ],
};

const venta = (cambios = {}) => ({ ...VENTA, ...cambios });

describe('lo que la caja sube', () => {
  it('una venta coherente pasa', () => {
    const r = validarVenta(VENTA);
    expect(r.ok).toBe(true);
    expect(r.venta.total).toBe(14500);
    expect(r.venta.items).toHaveLength(2);
    expect(r.venta.items[0].quantity).toBe(2);
  });

  it('sin id no hay idempotencia, así que no entra', () => {
    // Sin id, un reintento crearía una segunda venta y el negocio cobraría dos veces en sus reportes.
    expect(validarVenta(venta({ id: '' })).ok).toBe(false);
    expect(validarVenta(venta({ id: 'x' })).ok).toBe(false);
  });

  it('el total tiene que ser la suma de sus líneas', () => {
    const r = validarVenta(venta({ total: 99000 }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no cuadra');
  });

  it('no acepta cantidades que no son cantidades', () => {
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: 0 }] })).ok).toBe(false);
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: -3 }] })).ok).toBe(false);
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: 1000, cantidad: 1.5 }] })).ok).toBe(false);
  });

  it('no acepta precios negativos', () => {
    expect(validarVenta(venta({ items: [{ nombre: 'X', precio: -1000, cantidad: 1 }], total: -1000 })).ok).toBe(false);
  });

  it('una venta sin líneas no es una venta', () => {
    expect(validarVenta(venta({ items: [] })).ok).toBe(false);
    expect(validarVenta(null).ok).toBe(false);
  });

  it('respeta la hora de la caja, no la del servidor', () => {
    // Una venta hecha sin internet a las 3 de la tarde no puede aparecer a las
    // 9 de la noche, cuando volvió la señal.
    const r = validarVenta(VENTA);
    expect(r.venta.creadaEn.toISOString()).toBe('2026-09-20T20:04:05.000Z');
  });

  it('la variante viaja para que el stock baje de la talla correcta', () => {
    const r = validarVenta(venta({
      items: [{ producto_id: 'p1', nombre: 'Camiseta', variante: 'M', precio: 40000, cantidad: 1 }],
      total: 40000,
    }));
    expect(r.venta.items[0].variante).toEqual({ valores: ['M'], sku: '' });
  });

  it('no acepta una venta con miles de líneas', () => {
    const muchas = Array.from({ length: 201 }, () => ({ nombre: 'X', precio: 100, cantidad: 1 }));
    expect(validarVenta(venta({ items: muchas, total: 20100 })).ok).toBe(false);
  });
});

describe('el catálogo que baja a la caja', () => {
  const CATEGORIAS = { c1: 'Bebidas' };

  const producto = (extra = {}) => ({
    _id: 'p1',
    name: 'Café',
    price: 4500,
    category: 'c1',
    active: true,
    sku: 'CAF-01',
    updatedAt: new Date('2026-09-20T10:00:00Z'),
    ...extra,
  });

  it('un producto simple es una fila', () => {
    const [fila] = aplanarCatalogo([producto()], CATEGORIAS);
    expect(fila).toMatchObject({
      id: 'p1', nombre: 'Café', precio: 4500, categoria: 'Bebidas', sku: 'CAF-01', variante: '', activo: true,
    });
    expect(fila.actualizado).toBe('2026-09-20T10:00:00.000Z');
  });

  it('un producto con tallas baja como una fila por talla', () => {
    // En la caja se toca "Camiseta · M", no "Camiseta".
    const filas = aplanarCatalogo([producto({
      name: 'Camiseta',
      price: 40000,
      variantes: [
        { valores: ['M'], precio: null, sku: 'CAM-M', activo: true },
        { valores: ['L'], precio: 42000, sku: 'CAM-L', activo: true },
      ],
    })], CATEGORIAS);

    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ id: 'p1:M', variante: 'M', precio: 40000, sku: 'CAM-M' });
    expect(filas[1]).toMatchObject({ id: 'p1:L', variante: 'L', precio: 42000 });
  });

  it('la talla sin precio propio hereda el del producto', () => {
    const [fila] = aplanarCatalogo([producto({
      price: 40000,
      variantes: [{ valores: ['M'], precio: '', activo: true }],
    })]);
    expect(fila.precio).toBe(40000);
  });

  it('lo apagado también baja, marcado', () => {
    // Si no bajara, se quedaría para siempre en la caja vendiéndose.
    const [fila] = aplanarCatalogo([producto({ active: false })]);
    expect(fila.activo).toBe(false);
  });

  it('una talla apagada no se vende aunque el producto esté activo', () => {
    const filas = aplanarCatalogo([producto({
      variantes: [
        { valores: ['M'], activo: true },
        { valores: ['L'], activo: false },
      ],
    })]);
    expect(filas.map((f) => f.activo)).toEqual([true, false]);
  });

  it('un producto apagado apaga todas sus tallas', () => {
    const filas = aplanarCatalogo([producto({
      active: false,
      variantes: [{ valores: ['M'], activo: true }, { valores: ['L'], activo: true }],
    })]);
    expect(filas.every((f) => f.activo === false)).toBe(true);
  });

  it('el id compuesto distingue combinaciones de varios ejes', () => {
    const [fila] = aplanarCatalogo([producto({
      variantes: [{ valores: ['M', 'Negro'], activo: true }],
    })]);
    expect(fila.id).toBe('p1:M|Negro');
    expect(fila.variante).toBe('M · Negro');
  });
});

describe('el arqueo que sube la caja', () => {
  const CIERRE = {
    turno_id: '0192f8a1-7c4e-7000-8000-000000000001',
    cajero: 'Ana',
    abierto_en: '2026-09-20T08:00:00-05:00',
    cerrado_en: '2026-09-20T18:00:00-05:00',
    fondo_inicial: 100000,
    ventas_efectivo: 30000,
    ventas_otros: 20000,
    entradas: 50000,
    salidas: 10000,
    esperado: 170000,
    contado: 170000,
    diferencia: 0,
    ventas: 2,
  };
  const cierre = (cambios = {}) => ({ ...CIERRE, ...cambios });

  it('un arqueo que cuadra pasa', () => {
    const r = validarCierre(CIERRE);
    expect(r.ok).toBe(true);
    expect(r.cierre.diferencia).toBe(0);
  });

  it('un faltante entra como faltante, no se corrige', () => {
    // Es el dato del que depende todo el control de pérdidas.
    const r = validarCierre(cierre({ contado: 150000, diferencia: -20000 }));
    expect(r.ok).toBe(true);
    expect(r.cierre.diferencia).toBe(-20000);
  });

  it('rechaza un esperado que no sale de sus propios números', () => {
    expect(validarCierre(cierre({ esperado: 999999 })).ok).toBe(false);
  });

  it('rechaza una diferencia que no cuadra con el conteo', () => {
    // Sin esto, una caja alterada podría reportar faltante cero contando de menos.
    expect(validarCierre(cierre({ contado: 150000, diferencia: 0 })).ok).toBe(false);
  });

  it('el servidor NO recalcula el esperado con lo que alcanzó a subir', () => {
    /* Un turno con ventas todavía en cola saldría con un faltante enorme que no
       existe, y alguien terminaría acusado de robar. */
    const r = validarCierre(CIERRE);
    expect(r.cierre.ventasEfectivo).toBe(30000);
    expect(r.cierre.esperado).toBe(170000);
  });

  it('sin turno no hay arqueo', () => {
    expect(validarCierre(cierre({ turno_id: '' })).ok).toBe(false);
    expect(validarCierre(null).ok).toBe(false);
  });

  it('no acepta un fondo o un conteo negativo', () => {
    expect(validarCierre(cierre({ contado: -1, diferencia: -170001 })).ok).toBe(false);
  });
});
