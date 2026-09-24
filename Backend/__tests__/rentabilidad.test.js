/**
 * Cuánto se gana de verdad. Cada prueba dice qué pasaría en el negocio si
 * la regla se rompiera.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const { costoUnitario, calcular } = require('../utils/rentabilidad');

const BURGER = { name: 'Burger', category: 'c1', cost: 9000 };
const COMBO = { name: 'Combo', category: 'c1', cost: 5000, recipe: [{ supplyId: 's1', quantity: 2 }, { supplyId: 's2', quantity: 1 }] };
const CAMISA = { name: 'Camisa', category: 'c2', cost: 20000, variantes: [{ valores: ['XL'], costo: 25000 }] };

describe('el costo de una unidad', () => {
  it('con receta completa, la suma de los insumos', () => {
    expect(costoUnitario(COMBO, { s1: 3000, s2: 1500 })).toBe(7500);
  });

  it('con una receta a medio costear, el costo del producto: no se inventa', () => {
    expect(costoUnitario(COMBO, { s1: 3000 })).toBe(5000);
  });

  it('la variante manda si tiene su costo', () => {
    expect(costoUnitario(CAMISA, {}, ['XL'])).toBe(25000);
    expect(costoUnitario(CAMISA, {}, ['M'])).toBe(20000);
  });

  it('sin nada registrado, no se sabe', () => {
    expect(costoUnitario({ name: 'X' }, {})).toBeNull();
    expect(costoUnitario(undefined, {})).toBeNull();
  });
});

describe('el informe', () => {
  const productos = { b: BURGER, x: { name: 'Sin costo', category: 'c1' } };
  const pedidos = [
    { discountAmount: 0, items: [{ productId: 'b', price: 25000, quantity: 2 }] },
    { discountAmount: 0, items: [{ productId: 'x', price: 10000, quantity: 1 }] },
  ];
  const r = calcular(pedidos, productos, {}, { c1: 'Hamburguesas' });

  it('ventas, costo, utilidad y margen de lo que tiene costo', () => {
    expect(r.ventas).toBe(60000);
    expect(r.costo).toBe(18000);
    expect(r.utilidad).toBe(32000);
    expect(r.margen).toBe(64);
  });

  it('lo que no tiene costo se lista aparte y no infla el margen', () => {
    expect(r.sinCosto.map((f) => f.nombre)).toEqual(['Sin costo']);
    expect(r.sinCostoVentas).toBe(10000);
    expect(r.cobertura).toBe(83);
  });

  it('por producto y por categoría', () => {
    expect(r.productos[0]).toMatchObject({ nombre: 'Burger', cantidad: 2, utilidad: 32000, margen: 64 });
    expect(r.categorias[0]).toMatchObject({ categoria: 'Hamburguesas', utilidad: 32000 });
  });

  it('los descuentos le bajan la utilidad', () => {
    const con = calcular([{ discountAmount: 5000, items: [{ productId: 'b', price: 25000, quantity: 2 }] }], productos, {});
    expect(con.utilidad).toBe(27000);
  });

  it('un regalo de puntos no ingresa pero cuesta', () => {
    const regalo = calcular([{ items: [{ productId: 'b', price: 0, quantity: 1 }] }], productos, {});
    expect(regalo.utilidad).toBe(-9000);
  });

  it('un producto de precio libre (sin id) cae en sin costo', () => {
    const libre = calcular([{ items: [{ productId: null, name: 'Varios', price: 5000, quantity: 1 }] }], {}, {});
    expect(libre.sinCosto[0].nombre).toBe('Varios');
  });
});
