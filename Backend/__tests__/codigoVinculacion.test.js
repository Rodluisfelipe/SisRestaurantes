/**
 * El código con el que se vincula una caja.
 *
 * Se lee en voz alta por teléfono y se escribe en un teclado táctil, así que lo
 * que se prueba aquí es que no se preste a confusiones y que no se pueda
 * adivinar: son las dos cosas que lo hacen usable y seguro a la vez.
 */
const { generar, normalizar, bonito, ALFABETO, LARGO } = require('../utils/codigoVinculacion');

describe('cómo se ve el código', () => {
  it('tiene ocho caracteres', () => {
    expect(generar()).toHaveLength(LARGO);
  });

  it('no usa las letras que se confunden al dictarlo', () => {
    /* 0/O y 1/I/L son las que hacen que quien escucha "cero" escriba "O" y
       quien lee un monitor a dos metros confunda el uno con la ele. */
    for (const prohibida of ['0', 'O', '1', 'I', 'L']) {
      expect(ALFABETO).not.toContain(prohibida);
    }
  });

  it('cada código sale distinto', () => {
    // No es una prueba de aleatoriedad, es una red contra una constante olvidada.
    const muchos = new Set(Array.from({ length: 500 }, () => generar()));
    expect(muchos.size).toBe(500);
  });

  it('se muestra partido en dos para poder leerlo', () => {
    expect(bonito('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});

describe('lo que escribe el cajero', () => {
  it('acepta el guion, los espacios y las minúsculas', () => {
    // Los tres salen de copiar lo que ve en pantalla.
    expect(normalizar('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizar('ABCD EFGH')).toBe('ABCDEFGH');
    expect(normalizar('  abcdefgh  ')).toBe('ABCDEFGH');
  });

  it('no adivina qué quiso escribir', () => {
    /* La tentación es mapear 0→O y 1→I para "ayudar". Sería cambiarle el código
       por otro que podría existir y ser de otro negocio: mejor que no coincida
       y que el mensaje se lo diga. */
    expect(normalizar('0BCDEFGH')).toBe('0BCDEFGH');
    expect(normalizar('1BCDEFGH')).toBe('1BCDEFGH');
  });

  it('con un código vacío no revienta', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('qué tan difícil es adivinarlo', () => {
  it('hay más de cien mil millones de combinaciones', () => {
    /* Con el límite de diez intentos por minuto, probarlas todas toma más
       tiempo del que existe. La prueba está para que nadie acorte el código a
       cuatro caracteres "porque es más cómodo". */
    const combinaciones = Math.pow(ALFABETO.length, LARGO);
    expect(combinaciones).toBeGreaterThan(1e11);
  });
});
