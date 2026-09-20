/**
 * Devoluciones y cambios.
 *
 * En una tienda de ropa devuelven todos los días, casi siempre por la talla.
 * Lo que se prueba acá es que esa operación no se pueda usar para sacar plata
 * ni unidades de la nada: el precio sale del pedido, no se puede devolver más
 * de lo que se vendió, y una M y una L del mismo producto son dos cosas
 * distintas por más que compartan nombre.
 */
const { mismaLinea, validarLineas, normalizarCambio, calcularPlata } = require('../utils/devoluciones');
const Devolucion = require('../Models/Devolucion');

const PEDIDO = {
  orderNumber: '1042',
  items: [
    { productId: 'p1', name: 'Camiseta Negra', variante: { valores: ['M'], sku: 'CN-M' }, quantity: 2, price: 40000 },
    { productId: 'p1', name: 'Camiseta Negra', variante: { valores: ['L'], sku: 'CN-L' }, quantity: 1, price: 40000 },
    { productId: 'p2', name: 'Gorra', quantity: 1, price: 25000 },
  ],
};

describe('qué línea es cuál', () => {
  it('la misma talla del mismo producto es la misma línea', () => {
    expect(mismaLinea(PEDIDO.items[0], { productId: 'p1', variante: { valores: ['m'] } })).toBe(true);
  });

  it('la M y la L del mismo producto no lo son', () => {
    expect(mismaLinea(PEDIDO.items[0], PEDIDO.items[1])).toBe(false);
  });

  it('un producto sin variantes se compara por id', () => {
    expect(mismaLinea(PEDIDO.items[2], { productId: 'p2' })).toBe(true);
  });
});

describe('el precio sale del pedido, no de quien llama', () => {
  it('ignora el precio que manden', () => {
    const r = validarLineas(PEDIDO, [], [
      { productId: 'p1', variante: { valores: ['M'] }, quantity: 1, price: 400000 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.items[0].price).toBe(40000);
  });

  it('copia el nombre y la variante tal como se vendieron', () => {
    const r = validarLineas(PEDIDO, [], [{ productId: 'p1', variante: { valores: ['L'] }, quantity: 1 }]);
    expect(r.items[0].name).toBe('Camiseta Negra');
    expect(r.items[0].variante.sku).toBe('CN-L');
  });

  it('no se puede devolver algo que no estaba en el pedido', () => {
    const r = validarLineas(PEDIDO, [], [{ productId: 'p9', name: 'Zapatos', quantity: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('no está en el pedido');
  });

  it('sin pedido de respaldo se acepta lo que mande el panel', () => {
    // Venta de mostrador vieja: o se registra así, o no se registra.
    const r = validarLineas(null, [], [{ name: 'Camiseta', quantity: 1, price: 40000 }]);
    expect(r.ok).toBe(true);
    expect(r.items[0].price).toBe(40000);
  });
});

describe('no se devuelve más de lo que se compró', () => {
  it('devolver 3 de 2 no pasa', () => {
    const r = validarLineas(PEDIDO, [], [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 3 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('se vendieron 2');
  });

  it('cuenta lo ya devuelto antes en ese pedido', () => {
    const previas = [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 1 }];
    expect(validarLineas(PEDIDO, previas, [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 1 }]).ok).toBe(true);
    expect(validarLineas(PEDIDO, previas, [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 2 }]).ok).toBe(false);
  });

  it('lo devuelto de una talla no gasta el cupo de la otra', () => {
    const previas = [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 2 }];
    const r = validarLineas(PEDIDO, previas, [{ productId: 'p1', variante: { valores: ['L'] }, quantity: 1 }]);
    expect(r.ok).toBe(true);
  });

  it('cantidades absurdas se rechazan', () => {
    expect(validarLineas(PEDIDO, [], [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 0 }]).ok).toBe(false);
    expect(validarLineas(PEDIDO, [], [{ productId: 'p1', variante: { valores: ['M'] }, quantity: -1 }]).ok).toBe(false);
  });
});

describe('la plata que mueve cada caso', () => {
  const unaM = validarLineas(PEDIDO, [], [{ productId: 'p1', variante: { valores: ['M'] }, quantity: 1 }]).items;

  it('una devolución regresa lo que costó', () => {
    expect(calcularPlata('devolucion', unaM, [])).toEqual({ montoDevuelto: 40000, diferencia: 0 });
  });

  it('cambiar una talla por otra del mismo precio no cobra nada', () => {
    const cambio = normalizarCambio([{ productId: 'p1', name: 'Camiseta Negra', variante: { valores: ['L'] }, quantity: 1, price: 40000 }]);
    expect(calcularPlata('cambio', unaM, cambio)).toEqual({ montoDevuelto: 0, diferencia: 0 });
  });

  it('si se lleva algo más caro, la diferencia la paga el cliente', () => {
    const cambio = normalizarCambio([{ name: 'Chaqueta', quantity: 1, price: 90000 }]);
    expect(calcularPlata('cambio', unaM, cambio).diferencia).toBe(50000);
  });

  it('si se lleva algo más barato, la diferencia se le devuelve', () => {
    const cambio = normalizarCambio([{ name: 'Gorra', quantity: 1, price: 25000 }]);
    expect(calcularPlata('cambio', unaM, cambio).diferencia).toBe(-15000);
  });
});

describe('el registro de la devolución', () => {
  it('nace esperando el producto, no resuelta', () => {
    const d = new Devolucion({ businessId: '507f1f77bcf86cd799439011', tipo: 'devolucion', items: [{ name: 'x', quantity: 1, price: 1000 }] });
    expect(d.estado).toBe('pendiente');
    expect(d.stockMovido).toBe(false);   // el inventario se mueve al recibirlo
    expect(d.validateSync()).toBeUndefined();
  });

  it('por defecto lo devuelto vuelve a estar a la venta', () => {
    const d = new Devolucion({ businessId: '507f1f77bcf86cd799439011', tipo: 'cambio', items: [] });
    expect(d.reingresaStock).toBe(true);
  });

  it('un motivo inventado no se guarda', () => {
    const d = new Devolucion({ businessId: '507f1f77bcf86cd799439011', tipo: 'devolucion', motivo: 'porque si' });
    expect(d.validateSync()?.errors?.motivo).toBeDefined();
  });

  it('el tipo es obligatorio: devolver y cambiar no son lo mismo', () => {
    const d = new Devolucion({ businessId: '507f1f77bcf86cd799439011' });
    expect(d.validateSync()?.errors?.tipo).toBeDefined();
  });
});
