/**
 * Que el agente entienda lo que no es exacto.
 *
 * Antes, todo lo que no fuera un producto o un dato caía en `otraPregunta` y
 * eso saca al agente de la conversación. Un "¿qué tienen de pollo?" terminaba
 * esperando a que contestara una persona.
 *
 * La regla que no cambia: el modelo solo señala QUÉ buscar; los nombres y los
 * precios salen del catálogo. Si el modelo dijera el precio, un día se lo
 * inventaría.
 */
const { buscarVarios, buscarProducto } = require('../services/whatsappAgent/acciones');

const CARTA = [
  { name: 'McCrispy Chicken Sandwich Deluxe', price: 29000, category: 'Sandwich' },
  { name: 'Hamburguesa', price: 30000, category: 'Hamburguesas con salsas' },
  { name: 'Big Mac', price: 10000, category: 'Hamburguesas con salsas' },
  { name: 'McPollo', price: 24900, category: 'Hamburguesas con salsas' },
  { name: 'Doble Hamburguesa con Queso', price: 26900, category: 'Hamburguesas con salsas' },
  { name: 'Chicken McNuggets 6 pz', price: 24900, category: 'Nuggets' },
  { name: 'Chicken McNuggets 10 pz', price: 32000, category: 'Nuggets' },
  { name: 'McFlurry Oreo', price: 19500, category: 'Postres' },
  { name: 'Papas a la francesa', price: 8000, category: 'Acompañamientos' },
];

const nombres = (r) => r.map((p) => p.name);

describe('buscar por algo vago', () => {
  it('encuentra por categoría, no solo por nombre', () => {
    // Ningún producto se llama "postre": la palabra está en la categoría.
    expect(nombres(buscarVarios(CARTA, 'postre'))).toContain('McFlurry Oreo');
  });

  /* Las cartas mezclan español e inglés y el cliente pregunta en español.
     "Pollo" tiene que traer los Chicken McNuggets, que son pollo. */
  it('cruza el español con el inglés de la carta', () => {
    const r = nombres(buscarVarios(CARTA, 'pollo'));
    expect(r).toContain('McPollo');
    expect(r).toContain('Chicken McNuggets 6 pz');
    expect(r).toContain('McCrispy Chicken Sandwich Deluxe');
  });

  it('si no hay nada, no devuelve cualquier cosa', () => {
    expect(buscarVarios(CARTA, 'sushi')).toEqual([]);
    expect(buscarVarios(CARTA, '')).toEqual([]);
  });

  it('devuelve varios, no uno solo', () => {
    // Es lo contrario de armar un pedido: acá se quieren enseñar opciones.
    expect(buscarVarios(CARTA, 'nuggets').length).toBe(2);
  });
});

describe('preguntar un precio', () => {
  it('acierta el producto cuando se nombra claro', () => {
    expect(buscarProducto(CARTA, 'big mac').producto.price).toBe(10000);
    expect(buscarProducto(CARTA, 'doble').producto.name).toBe('Doble Hamburguesa con Queso');
  });

  it('conserva la cifra que distingue una porción de otra', () => {
    expect(buscarProducto(CARTA, 'nuggets de 6').producto.name).toBe('Chicken McNuggets 6 pz');
    expect(buscarProducto(CARTA, 'nuggets de 10').producto.name).toBe('Chicken McNuggets 10 pz');
  });

  it('ante la duda pregunta, no adivina un precio', () => {
    // Contestar el precio del que no era es peor que preguntar cuál.
    const r = buscarProducto(CARTA, 'mcnuggets');
    expect(r.producto).toBeUndefined();
    expect(r.opciones.length).toBeGreaterThan(1);
  });

  it('lo que no está en la carta se dice', () => {
    expect(buscarProducto(CARTA, 'pizza').ninguno).toBe(true);
  });
});

describe('la descripción, que es donde está lo que el cliente pregunta', () => {
  const CON_DESCRIPCION = [
    { name: 'Big Mac', price: 10000, category: 'Hamburguesas', description: 'Doble carne, lechuga, queso, salsa especial y cebolla' },
    { name: 'McPollo', price: 24900, category: 'Hamburguesas', description: 'Pechuga apanada con lechuga y mayonesa' },
    { name: 'Hamburguesa BBQ', price: 28000, category: 'Hamburguesas', description: 'Carne, tocineta crocante y salsa BBQ' },
    { name: 'Ensalada César', price: 18000, category: 'Ensaladas', description: 'Lechuga, pollo a la plancha. Opción vegetariana sin pollo' },
  ];

  it.each([
    ['tocineta', 'Hamburguesa BBQ'],
    ['vegetariana', 'Ensalada César'],
    ['apanada', 'McPollo'],
  ])('"%s" encuentra %s aunque no esté en el nombre', (q, esperado) => {
    expect(nombres(buscarVarios(CON_DESCRIPCION, q))).toContain(esperado);
  });

  /* Si la descripción pesara igual que el nombre, preguntar por "pollo"
     podría devolver primero una ensalada que lo menciona de pasada. */
  it('el nombre sigue pesando más que la descripción', () => {
    const r = nombres(buscarVarios(CON_DESCRIPCION, 'pollo'));
    expect(r[0]).toBe('McPollo');
  });

  it('un producto sin descripción no se rompe', () => {
    const carta = [{ name: 'Papas', price: 8000, category: 'Acompañamientos' }];
    expect(nombres(buscarVarios(carta, 'papas'))).toEqual(['Papas']);
  });
});
