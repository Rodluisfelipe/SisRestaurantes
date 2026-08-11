/**
 * Que no se pierda por el camino nada de lo que el modelo entiende.
 *
 * `normalizar` construye la respuesta campo por campo, con una lista fija. Eso
 * es lo correcto —así una clave inventada por el modelo no entra al sistema—
 * pero tiene una trampa: al añadir un campo nuevo al prompt es fácil olvidarse
 * de añadirlo también acá, y entonces el modelo lo devuelve y el código lo tira
 * a la basura, en silencio.
 *
 * Pasó de verdad: `busca`, `preguntaPrecio` y `preguntaHorario` se añadieron al
 * prompt y a los valores por defecto, pero no a `normalizar`. Tres funciones
 * enteras quedaron muertas y solo se descubrió mandando un WhatsApp.
 */
const { normalizar, NADA } = require('../services/whatsappAgent/interpretar');

describe('todo lo que el modelo puede decir llega al código', () => {
  it('normalizar devuelve exactamente los campos declarados', () => {
    const claves = Object.keys(normalizar({})).sort();
    expect(claves).toEqual(Object.keys(NADA).sort());
  });

  /* Un campo nuevo en el prompt sin su sitio en `normalizar` es una función
     que no funciona y no avisa. Esta es la prueba que lo caza. */
  it('ningún campo se queda por el camino', () => {
    const todo = {
      productos: [{ nombre: 'Hamburguesa', cantidad: 2, nota: 'sin salsas' }],
      quitar: ['Papas'],
      tipo: 'domicilio',
      nombre: 'Felipe',
      direccion: 'Cra 6 # 3 139',
      confirma: true,
      quiereMenu: true,
      quiereHumano: true,
      preguntaEstado: true,
      preguntaCarta: true,
      busca: 'pollo',
      preguntaPrecio: 'doble',
      preguntaHorario: true,
      otraPregunta: '¿tienen parqueadero?',
    };
    const r = normalizar(todo);

    expect(r.productos[0].nombre).toBe('Hamburguesa');
    expect(r.quitar).toEqual(['Papas']);
    expect(r.tipo).toBe('domicilio');
    expect(r.nombre).toBe('Felipe');
    expect(r.direccion).toBe('Cra 6 # 3 139');
    expect(r.confirma).toBe(true);
    expect(r.quiereMenu).toBe(true);
    expect(r.quiereHumano).toBe(true);
    expect(r.preguntaEstado).toBe(true);
    expect(r.preguntaCarta).toBe(true);
    expect(r.busca).toBe('pollo');
    expect(r.preguntaPrecio).toBe('doble');
    expect(r.preguntaHorario).toBe(true);
    expect(r.otraPregunta).toBe('¿tienen parqueadero?');
  });

  it('lo que el prompt le pide al modelo tiene su sitio en el código', () => {
    // Si el prompt nombra un campo, `normalizar` tiene que recogerlo.
    const fuente = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'services', 'whatsappAgent', 'interpretar.js'), 'utf8'
    );
    const enElPrompt = [...fuente.matchAll(/^\s*"(\w+)":/gm)].map((m) => m[1]);
    const enNormalizar = Object.keys(NADA);
    for (const campo of new Set(enElPrompt)) {
      expect(enNormalizar).toContain(campo);
    }
  });

  it('una clave que el modelo se invente no entra', () => {
    // Es el motivo de que `normalizar` exista.
    const r = normalizar({ productos: [], borrarTodo: true, admin: true });
    expect(r.borrarTodo).toBeUndefined();
    expect(r.admin).toBeUndefined();
  });
});
