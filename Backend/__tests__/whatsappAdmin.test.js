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

describe('cambiar el menú desde WhatsApp', () => {
  it('"se acabó la hamburguesa" es una orden, no la consulta de inventario', () => {
    /* Las dos reglas coinciden con ese texto; la de agotar va primero porque
       es lo que el dueño quiere hacer, no lo que quiere saber. */
    expect(intencion('se acabo la hamburguesa')).toBe('agotar');
    expect(intencion('se acabaron las papas')).toBe('agotar');
    expect(intencion('quita el big mac del menu')).toBe('agotar');
    expect(intencion('desactiva la coca cola')).toBe('agotar');
  });

  it('reconoce cuándo hay que volver a activar algo', () => {
    expect(intencion('activa la hamburguesa doble')).toBe('activar');
    expect(intencion('ya hay pan')).toBe('activar');
    expect(intencion('llego mas pollo')).toBe('activar');
  });

  it('preguntar por el inventario sigue siendo una consulta', () => {
    expect(intencion('que se esta acabando')).toBe('stock');
    expect(intencion('inventario')).toBe('stock');
    expect(intencion('que productos estan agotados')).toBe('stock');
  });
});

describe('qué cuenta como confirmar y como cancelar', () => {
  const { ES_SI, ES_NO } = require('../services/whatsappAdmin');

  it.each([['si'], ['sí'], ['dale'], ['hazlo'], ['confirmo'], ['ok'], ['listo']])(
    '"%s" confirma', (t) => expect(ES_SI.test(plano(t))).toBe(true)
  );

  it.each([['no'], ['cancela'], ['mejor no'], ['olvidalo']])(
    '"%s" cancela', (t) => expect(ES_NO.test(plano(t))).toBe(true)
  );

  /* Ante la duda con algo que cambia el menú se vuelve a preguntar, no se
     interpreta: un "sirve" o un "quizás" no pueden sacar un producto. */
  it.each([['quizas'], ['sirve'], ['tal vez'], ['no se']])(
    '"%s" no confirma nada', (t) => {
      const p = plano(t);
      expect(ES_SI.test(p) && !ES_NO.test(p)).toBe(false);
    }
  );
});
