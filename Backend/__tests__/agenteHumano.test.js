/**
 * Que la conversación se sienta con una persona.
 *
 * Lo que delata a un bot no es lo que dice: es cómo se comporta. Contestar en
 * medio segundo, mandar un solo bloque con todo, e ignorar un "gracias".
 */
const { partir, esperaPara, PAUSA_MINIMA_MS, PAUSA_MAXIMA_MS } =
  require('../services/whatsappAgent/humanizar');

describe('la pausa antes de contestar', () => {
  it('nunca contesta al instante', () => {
    /* Una respuesta en menos de un segundo a "quiero una hamburguesa" es la
       señal más clara de que no hay nadie del otro lado. */
    expect(esperaPara('Ok')).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS);
  });

  it('tarda más con un mensaje más largo', () => {
    const corto = esperaPara('Listo 👍');
    const largo = esperaPara('De pollo tengo: McPollo, Chicken McNuggets 6 pz y McCrispy Chicken Sandwich Deluxe. ¿Cuál te provoca?');
    expect(largo).toBeGreaterThan(corto);
  });

  it('pero nunca deja esperando de más', () => {
    // Un cliente esperando cuatro segundos ya se pregunta si lo dejaron colgado.
    expect(esperaPara('x'.repeat(5000))).toBe(PAUSA_MAXIMA_MS);
  });
});

describe('en cuántos mensajes lo manda', () => {
  it('el acuse va aparte de la pregunta, como escribe una persona', () => {
    const t = partir('Listo, 1x Hamburguesa 👍\n¿Te lo llevamos o lo recoges?');
    expect(t).toHaveLength(2);
    expect(t[0]).toBe('Listo, 1x Hamburguesa 👍');
  });

  it('una sola frase se manda entera', () => {
    expect(partir('¿Qué te gustaría pedir?')).toHaveLength(1);
  });

  /* Trocear una carta o un enlace lo vuelve ilegible, y el enlace partido
     deja de ser tocable. */
  it('lo que lleva enlace no se parte', () => {
    const con = '¡Buenas noches! Bienvenido a DOGGITOS 😊\n\n🍔 https://menuby.tech/doggitos';
    expect(partir(con)).toHaveLength(1);
  });

  it('si empieza preguntando, no se parte', () => {
    // Partirlo dejaría la pregunta huérfana del resto.
    const t = partir('¿Cuál de estos querías? Big Mac, McPollo\nDime el nombre completo.');
    expect(t).toHaveLength(1);
  });

  it('un texto vacío no manda nada', () => {
    expect(partir('')).toEqual([]);
    expect(partir(null)).toEqual([]);
  });
});

describe('el tono al dar una mala noticia', () => {
  const fuente = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'services', 'whatsappAgent', 'conversacion.js'), 'utf8'
  );

  it('no suena a formulario', () => {
    // "No tenemos X" es correcto y frío; "uy, no manejamos X" lo dice alguien.
    expect(fuente).toMatch(/Uy, no manejamos/);
    expect(fuente).toMatch(/Uy, se nos acabó/);
  });

  it('un "gracias" se contesta, no se ignora', () => {
    /* Antes caía en la rueda de siempre y el cliente recibía otra vez la
       pregunta que acababa de responder. */
    expect(fuente).toMatch(/const CORTESIA =/);
    expect(fuente).toMatch(/CORTESIA\.test\(mensaje\)/);
  });
});
