/**
 * Variantes de producto para las tiendas (ecommerce).
 *
 * El negocio inventa sus propios ejes: talla, fragancia, color, material. Lo
 * que se prueba aquí es que esa libertad no termine en un catálogo roto: sin
 * ejes repetidos, sin combinaciones fantasma y sin listas infinitas.
 */
const {
  MAX_OPCIONES,
  MAX_VARIANTES,
  normalizarOpciones,
  normalizarVariantes,
  combinaciones,
  stockTotal,
  precioDesde,
} = require('../utils/variantesProducto');

const TALLA_COLOR = [
  { nombre: 'Talla', valores: ['S', 'M'] },
  { nombre: 'Color', valores: ['Negro', 'Blanco'] },
];

describe('los ejes que define el negocio', () => {
  it('sirven para cualquier rubro, no solo ropa', () => {
    const perfume = normalizarOpciones([{ nombre: 'Fragancia', valores: ['Vainilla', 'Cítrico'] }, { nombre: 'Tamaño', valores: ['30 ml', '100 ml'] }]);
    expect(perfume.map((o) => o.nombre)).toEqual(['Fragancia', 'Tamaño']);
    expect(combinaciones(perfume)).toHaveLength(4);
  });

  it('limpia espacios, vacíos y valores repetidos', () => {
    const [talla] = normalizarOpciones([{ nombre: '  Talla  ', valores: ['S', ' s ', '', 'M', null] }]);
    expect(talla.nombre).toBe('Talla');
    expect(talla.valores).toEqual(['S', 'M']);
  });

  it('descarta ejes sin nombre, sin valores o repetidos', () => {
    const opciones = normalizarOpciones([
      { nombre: '', valores: ['S'] },
      { nombre: 'Color', valores: [] },
      { nombre: 'Talla', valores: ['S'] },
      { nombre: 'talla', valores: ['L'] },
    ]);
    expect(opciones).toEqual([{ nombre: 'Talla', valores: ['S'] }]);
  });

  it('no deja poner más ejes de los que el selector puede mostrar', () => {
    const muchos = ['Talla', 'Color', 'Material', 'Estilo', 'Largo'].map((nombre) => ({ nombre, valores: ['x'] }));
    expect(normalizarOpciones(muchos)).toHaveLength(MAX_OPCIONES);
  });
});

describe('las variantes siguen a sus ejes', () => {
  it('guarda referencia, precio, costo, stock y foto de cada combinación', () => {
    const [variante] = normalizarVariantes(
      [{ valores: ['M', 'Negro'], sku: 'CAM-M-NEG', precio: '59.900', costo: 20000, stock: '3', imagen: 'negra.jpg' }],
      TALLA_COLOR,
    );
    expect(variante).toEqual({
      valores: ['M', 'Negro'], sku: 'CAM-M-NEG', precio: 59900, costo: 20000, stock: 3, imagen: 'negra.jpg', activo: true,
    });
  });

  it('precio y costo vacíos significan "los del producto"', () => {
    const [variante] = normalizarVariantes([{ valores: ['S', 'Negro'], precio: '', costo: null }], TALLA_COLOR);
    expect(variante.precio).toBeNull();
    expect(variante.costo).toBeNull();
    expect(variante.stock).toBe(0);
  });

  it('descarta la variante cuyo valor ya no existe en el eje', () => {
    const resultado = normalizarVariantes(
      [{ valores: ['M', 'Rojo'] }, { valores: ['M', 'Negro'] }, { valores: ['M'] }],
      TALLA_COLOR,
    );
    expect(resultado.map((v) => v.valores)).toEqual([['M', 'Negro']]);
  });

  it('no repite la misma combinación', () => {
    const resultado = normalizarVariantes([{ valores: ['M', 'Negro'], stock: 5 }, { valores: ['m', 'negro'], stock: 9 }], TALLA_COLOR);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].stock).toBe(5);
  });

  it('sin ejes no hay variantes: el producto vuelve a tener un precio y un stock', () => {
    expect(normalizarVariantes([{ valores: ['M'] }], [])).toEqual([]);
  });

  it('corta en el máximo de combinaciones', () => {
    const ejes = [
      { nombre: 'Talla', valores: Array.from({ length: 12 }, (_, i) => 'T' + i) },
      { nombre: 'Color', valores: Array.from({ length: 12 }, (_, i) => 'C' + i) },
    ];
    const todas = combinaciones(ejes).map((valores) => ({ valores, stock: 1 }));
    expect(todas.length).toBeGreaterThan(MAX_VARIANTES);
    expect(normalizarVariantes(todas, ejes)).toHaveLength(MAX_VARIANTES);
  });
});

describe('lo que se le muestra al cliente', () => {
  const variantes = [
    { valores: ['S', 'Negro'], precio: null, stock: 2, activo: true },
    { valores: ['M', 'Negro'], precio: 49900, stock: 0, activo: true },
    { valores: ['M', 'Blanco'], precio: 10000, stock: 7, activo: false },
  ];

  it('suma el stock solo de las variantes activas', () => {
    expect(stockTotal(variantes)).toBe(2);
  });

  it('el precio "desde" ignora las apagadas y hereda el del producto', () => {
    expect(precioDesde(variantes, 59900)).toBe(49900);
    expect(precioDesde([], 59900)).toBe(59900);
  });
});
