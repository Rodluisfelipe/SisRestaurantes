/**
 * Cómo suena el agente.
 *
 * Las cifras las escribe el código y eso no cambia —es lo que impide que un
 * modelo invente un total—, pero el tono sí: acusar recibo de lo que el
 * cliente acaba de decir, variar las frases, y no repetir el pedido entero en
 * cada mensaje.
 */
const fs = require('fs');
const path = require('path');

const fuente = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'whatsappAgent', 'conversacion.js'), 'utf8'
);

describe('el agente acusa recibo antes de preguntar', () => {
  it('existe la función y se usa en el turno', () => {
    expect(fuente).toMatch(/function acusar\(/);
    expect(fuente).toMatch(/const acuse = acusar\(/);
  });

  it('el acuse usa el nombre del catálogo, no lo que escribió el cliente', () => {
    /* Si el cliente pide "una doble" y el catálogo la llama "Doble
       Hamburguesa con Queso", el acuse tiene que decir el nombre real: es la
       señal de que se entendió bien. */
    const linea = fuente.split('\n').find((l) => l.includes('agregados.push'));
    expect(linea).toContain('ult.name');       // el nombre real del catálogo
    expect(linea).toContain('ult.quantity');   // y la cantidad que quedó
  });

  it('confirma el dato que acaban de dar', () => {
    // Evita el "¿me habrá entendido la dirección?" que acaba en repetirla.
    expect(fuente).toMatch(/fijados\?\.direccion/);
    expect(fuente).toMatch(/Anoto:/);
  });
});

describe('las preguntas no se repiten palabra por palabra', () => {
  it('cada campo tiene varias formas', () => {
    const bloque = fuente.match(/const FORMAS = \{[\s\S]*?\n\};/)[0];
    for (const campo of ['productos', 'tipo', 'direccion', 'nombre']) {
      /* Con `indexOf` y no con una expresión regular armada a mano: los
         escapes dentro de una plantilla se pierden y la expresión sale rota
         —me pasó al escribir esta prueba. */
      const desde = bloque.indexOf(`${campo}: [`);
      expect(desde).toBeGreaterThan(-1);
      const trozo = bloque.slice(desde, bloque.indexOf(']', desde));
      // Cada forma es una cadena entre comillas: dos comillas por forma.
      const cuantas = (trozo.match(/'/g) || []).length / 2;
      expect(cuantas).toBeGreaterThanOrEqual(2);
    }
  });

  it('la variación NO es aleatoria', () => {
    /* Con azar, dos clientes en el mismo punto recibirían mensajes distintos y
       un fallo no se podría reproducir. Va por el número de turno. */
    expect(fuente).not.toMatch(/Math\.random/);
    expect(fuente).toMatch(/turno % opciones\.length/);
  });
});

describe('el resumen del pedido', () => {
  it('se manda cuando algo cambió, y siempre al confirmar', () => {
    /* Quitarlo del todo traería de vuelta el fallo que lo puso ahí: un cliente
       confirmando un total que nunca vio. En el momento de confirmar es
       obligatorio. */
    expect(fuente).toMatch(/const mostrarResumen = tienePedido && \(cambio \|\| pidiendoConfirmacion\)/);
  });

  it('las cifras las sigue escribiendo el código', () => {
    // La regla que sostiene todo: el modelo extrae, el código compone.
    expect(fuente).toMatch(/Lo escribe el código, siempre/);
    expect(fuente).toMatch(/pesos\(sesion\.total\(\)\)/);
  });
});

describe('el primer mensaje', () => {
  it('saluda según la hora de Colombia', () => {
    expect(fuente).toMatch(/Buenos días/);
    expect(fuente).toMatch(/Buenas tardes/);
    expect(fuente).toMatch(/Buenas noches/);
    /* Colombia es UTC−5: se RESTA. Poner el signo al revés saluda "buenos
       días" a las siete de la noche, y esa es justo la clase de detalle que
       hace que un negocio parezca automatizado. */
    expect(fuente).toMatch(/Date\.now\(\) - COL_OFFSET_MS/);
    expect(fuente).not.toMatch(/Date\.now\(\) \+ COL_OFFSET_MS/);
  });

  it('trata distinto a quien ya ha comprado', () => {
    // A un cliente de siempre, un "bienvenido" lo trata como si nunca hubiera
    // venido.
    const bloque = fuente.match(/function saludar\(\{[\s\S]*?\n\}/)[0];
    expect(bloque).toMatch(/de nuevo|otra vez/);
    expect(bloque).toMatch(/if \(nombre\)/);
  });

  it('un saludo nunca recibe una pregunta pelada', () => {
    // Sin carta que mandar, "Hola" recibía "¿Qué te gustaría pedir?" a secas.
    expect(fuente).toMatch(/if \(soloSaludo && !tienePedido\)/);
  });
});
