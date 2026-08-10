/**
 * El asistente administrativo: quién puede preguntar y qué se entiende.
 *
 * Estas dos cosas son las que pueden salir caras. La primera es una frontera
 * de seguridad —el mismo número recibe a los clientes y al dueño—, y la
 * segunda decide si una pregunta por dinero se contesta bien o se contesta
 * cualquier cosa.
 */
const { autorizado, plano, REGLAS } = require('../services/whatsappAdmin');

/** A qué consulta lleva un texto, sin ejecutarla. */
function intencion(texto) {
  const t = plano(texto);
  const regla = REGLAS.find((r) => r.prueba(t));
  return regla ? regla.id : null;
}

describe('quién puede preguntar por el dinero del negocio', () => {
  const cuenta = {
    consultas: {
      numeros: [
        { telefono: '573138178003', nombre: 'Felipe' },
        { telefono: '3105551122', nombre: 'Administradora' },   // guardado sin indicativo
      ],
    },
  };

  it('reconoce al dueño aunque WhatsApp mande el indicativo y el panel no', () => {
    // Guardado como 3105551122, llega como 573105551122.
    expect(autorizado(cuenta, '573105551122')?.nombre).toBe('Administradora');
  });

  it('reconoce al dueño con el mismo formato', () => {
    expect(autorizado(cuenta, '573138178003')?.nombre).toBe('Felipe');
  });

  it('un cliente cualquiera NO queda autorizado', () => {
    expect(autorizado(cuenta, '573001234567')).toBeNull();
  });

  it('sin números configurados no autoriza a nadie', () => {
    expect(autorizado({ consultas: { numeros: [] } }, '573138178003')).toBeNull();
    expect(autorizado({}, '573138178003')).toBeNull();
  });

  /* Un número corto no puede colarse pareciéndose por el final a uno real. */
  it('un número demasiado corto no coincide con nadie', () => {
    expect(autorizado(cuenta, '8003')).toBeNull();
    expect(autorizado({ consultas: { numeros: [{ telefono: '123' }] } }, '573138178003')).toBeNull();
  });
});

describe('qué se entiende de cada pregunta', () => {
  const CASOS = [
    ['¿Cuánto vendimos hoy?', 'ventas'],
    ['cuanto vendimos', 'ventas'],
    ['ventas de ayer', 'ventas'],
    ['ventas del mes', 'ventas'],
    ['cuánto llevamos', 'ventas'],
    ['¿Cómo va el negocio?', 'resumen'],
    ['resumen', 'resumen'],
    ['reporte', 'resumen'],
    ['¿hay pedidos pendientes?', 'pendientes'],
    ['pedidos de hoy', 'pendientes'],
    ['cuantos domicilios tenemos', 'pendientes'],
    ['¿cuánto hay en caja?', 'caja'],
    ['caja', 'caja'],
    ['efectivo', 'caja'],
    ['qué es lo más vendido', 'mas_vendido'],
    ['producto mas vendido de la semana', 'mas_vendido'],
    ['inventario', 'stock'],
    ['qué productos están agotados', 'stock'],
    ['que se esta acabando', 'stock'],
    ['ayuda', 'ayuda'],
    ['qué puedes hacer', 'ayuda'],
  ];

  it.each(CASOS)('"%s" → %s', (texto, esperado) => {
    expect(intencion(texto)).toBe(esperado);
  });

  it('lo que no se entiende no se adivina', () => {
    // Antes de contestarle cualquier cosa a quien pregunta por dinero, se dice
    // qué sí se sabe responder.
    expect(intencion('mándame tres hamburguesas a la casa')).toBeNull();
    expect(intencion('hola buenas')).toBeNull();
  });

  /* "cuánto se vendió de hamburguesas" pregunta por un producto, no por la
     cifra del día: si ganara la regla de ventas, la respuesta sería otra. */
  it('lo específico gana a lo general', () => {
    expect(intencion('cual es el producto que mas se vende')).toBe('mas_vendido');
    expect(intencion('cuanto hay en caja hoy')).toBe('caja');
  });
});

describe('el periodo que se lee de la pregunta', () => {
  /* Se reimplementa igual que en el módulo: es la regla que decide si la cifra
     que se contesta es la de hoy o la del mes, y equivocarla es dar un dato
     falso con toda seguridad. */
  const periodoDe = (t) => {
    const p = plano(t);
    if (/\bayer\b/.test(p)) return 'ayer';
    if (/\bsemana\b|\bsemanal\b|\b7 dias\b/.test(p)) return 'semana';
    if (/\bmes\b|\bmensual\b/.test(p)) return 'mes';
    return 'hoy';
  };

  it.each([
    ['ventas de ayer', 'ayer'],
    ['ventas de la semana', 'semana'],
    ['ventas del mes', 'mes'],
    ['cuánto vendimos', 'hoy'],
    ['ventas hoy', 'hoy'],
  ])('"%s" → %s', (texto, esperado) => {
    expect(periodoDe(texto)).toBe(esperado);
  });
});
