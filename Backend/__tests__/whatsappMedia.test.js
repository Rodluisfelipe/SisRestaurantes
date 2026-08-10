/**
 * Las reglas de archivos de WhatsApp, contrastadas con la tabla de tipos
 * soportados de la documentación de Meta.
 *
 * Existe porque estas reglas no se pueden deducir leyendo el código: son una
 * lista que Meta publica y cambia. Cuando se equivocan, el fallo aparece a
 * mitad de una subida y con un error suyo que no dice qué hacer.
 */
const { tipoDeArchivo, comprobarArchivo } = require('../services/whatsappCloud');

const KB = 1024;
const MB = 1024 * 1024;

describe('a qué tipo de mensaje corresponde cada archivo', () => {
  /* La tabla de la documentación, fila por fila. */
  const TABLA = [
    ['audio/aac', 'audio'],
    ['audio/amr', 'audio'],
    ['audio/mpeg', 'audio'],
    ['audio/mp4', 'audio'],
    ['audio/ogg', 'audio'],
    ['text/plain', 'document'],
    ['application/vnd.ms-excel', 'document'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'document'],
    ['application/msword', 'document'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
    ['application/vnd.ms-powerpoint', 'document'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'document'],
    ['application/pdf', 'document'],
    ['image/jpeg', 'image'],
    ['image/png', 'image'],
    ['image/webp', 'sticker'],
    ['video/3gpp', 'video'],
    ['video/mp4', 'video'],
  ];

  it.each(TABLA)('%s → %s', (mime, esperado) => {
    expect(tipoDeArchivo(mime)).toBe(esperado);
    expect(() => comprobarArchivo(esperado, mime, 1 * KB)).not.toThrow();
  });

  it('el WebP es sticker y no imagen: Meta rechaza un WebP mandado como imagen', () => {
    expect(tipoDeArchivo('image/webp')).toBe('sticker');
  });

  it('el códec pegado al tipo no despista', () => {
    // Así es como llega de verdad una nota de voz de WhatsApp.
    expect(tipoDeArchivo('audio/ogg; codecs=opus')).toBe('audio');
  });
});

describe('lo que Meta no acepta se rechaza antes de subirlo', () => {
  it.each([
    ['application/zip'],
    ['text/csv'],
    ['application/json'],
  ])('%s no se puede mandar como documento', (mime) => {
    expect(() => comprobarArchivo('document', mime, 1 * KB)).toThrow(/solo acepta/i);
  });

  /* Un GIF o un BMP caerían en 'document' por descarte, y ahí los frena la
     lista de documentos: Meta no admite ninguno de los dos. */
  it.each([['image/gif'], ['image/bmp']])('%s tampoco', (mime) => {
    expect(() => comprobarArchivo(tipoDeArchivo(mime), mime, 1 * KB)).toThrow();
  });
});

describe('los topes de tamaño, que son distintos para cada tipo', () => {
  const DENTRO = [
    ['image', 'image/jpeg', 4 * MB],
    ['sticker', 'image/webp', 400 * KB],
    ['video', 'video/mp4', 15 * MB],
    ['audio', 'audio/ogg', 15 * MB],
    ['document', 'application/pdf', 10 * MB],
  ];
  it.each(DENTRO)('%s dentro del tope pasa', (tipo, mime, bytes) => {
    expect(() => comprobarArchivo(tipo, mime, bytes)).not.toThrow();
  });

  const FUERA = [
    ['image', 'image/jpeg', 6 * MB, /5 MB/],
    ['sticker', 'image/webp', 600 * KB, /500 KB/],
    ['video', 'video/mp4', 20 * MB, /16 MB/],
    ['audio', 'audio/ogg', 20 * MB, /16 MB/],
  ];
  it.each(FUERA)('%s pasado el tope se rechaza diciendo cuánto es', (tipo, mime, bytes, medida) => {
    expect(() => comprobarArchivo(tipo, mime, bytes)).toThrow(medida);
  });

  /* Meta admite 100 MB en documentos: el tope de 16 lo ponemos nosotros porque
     el archivo pasa entero por la memoria del servidor. El mensaje no puede
     echarle la culpa a WhatsApp. */
  it('el tope de los documentos se declara como propio, no de WhatsApp', () => {
    expect(() => comprobarArchivo('document', 'application/pdf', 20 * MB))
      .toThrow(/que admitimos/);
    expect(() => comprobarArchivo('document', 'application/pdf', 20 * MB))
      .not.toThrow(/acepta WhatsApp/);
  });
});
