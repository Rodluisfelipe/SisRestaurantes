const {
  siguienteTipo, hashPin, pinValido, codigoAleatorio, mensajeTelegram, inicioDelDia, chatDelVinculo,
} = require('../utils/asistencia');

const min = 60 * 1000;
const hora = 60 * min;

describe('asistencia: entrada o salida', () => {
  const ahora = new Date('2026-09-24T22:00:00Z');

  test('sin marcas previas es entrada', () => {
    expect(siguienteTipo(null, ahora)).toBe('entrada');
  });

  test('después de una entrada viene la salida', () => {
    expect(siguienteTipo({ tipo: 'entrada', fecha: new Date(ahora - 8 * hora) }, ahora)).toBe('salida');
  });

  test('después de una salida viene otra entrada', () => {
    expect(siguienteTipo({ tipo: 'salida', fecha: new Date(ahora - 12 * hora) }, ahora)).toBe('entrada');
  });

  test('una entrada de hace más de 20 h sin salida: lo nuevo es entrada (olvidó salir)', () => {
    expect(siguienteTipo({ tipo: 'entrada', fecha: new Date(ahora - 21 * hora) }, ahora)).toBe('entrada');
  });

  test('dos marcas en menos de un minuto es doble toque', () => {
    expect(siguienteTipo({ tipo: 'entrada', fecha: new Date(ahora - 20 * 1000) }, ahora)).toBeNull();
  });
});

describe('asistencia: PIN y códigos', () => {
  test('el PIN son 4 números', () => {
    expect(pinValido('1234')).toBe(true);
    expect(pinValido('123')).toBe(false);
    expect(pinValido('12a4')).toBe(false);
    expect(pinValido('12345')).toBe(false);
  });

  test('el mismo PIN en dos negocios da un hash distinto', () => {
    expect(hashPin('a', '1234')).not.toBe(hashPin('b', '1234'));
    expect(hashPin('a', '1234')).toBe(hashPin('a', '1234'));
  });

  test('los códigos del QR no se repiten', () => {
    const vistos = new Set(Array.from({ length: 500 }, () => codigoAleatorio()));
    expect(vistos.size).toBe(500);
  });
});

describe('asistencia: aviso y fechas', () => {
  test('el aviso dice quién, sede y hora (hora de Colombia)', () => {
    const t = mensajeTelegram({ nombre: 'Ana <Pérez>', tipo: 'entrada', sedeNombre: 'Sede Centro', fecha: new Date('2026-09-24T12:02:00Z') });
    expect(t).toMatch(/Entrada/);
    expect(t).toMatch(/Ana &lt;Pérez&gt;/);
    expect(t).toMatch(/Sede Centro/);
    expect(t).toMatch(/7:02/);
  });

  test('el día del reporte arranca a medianoche de Colombia', () => {
    expect(inicioDelDia('2026-09-24').toISOString()).toBe('2026-09-24T05:00:00.000Z');
    expect(inicioDelDia('24/09/2026')).toBeNull();
  });

  test('encuentra el /start con el código de vínculo (chat o grupo)', () => {
    const updates = [
      { message: { text: '/start otro', chat: { id: 1, first_name: 'X' } } },
      { message: { text: '/start@MenubyBot abc123', chat: { id: -99, title: 'Dueños Fraise' } } },
    ];
    expect(chatDelVinculo(updates, 'abc123')).toEqual({ chatId: '-99', nombre: 'Dueños Fraise' });
    expect(chatDelVinculo(updates, 'nada')).toBeNull();
  });
});

describe('asistencia: sedes y protección', () => {
  const { coordsDeMaps, esLinkMaps, metrosEntre, puedeMarcarEn, candadoMarca } = require('../utils/asistencia');

  test('lee las coordenadas de los links de Google Maps (el punto del lugar manda)', () => {
    expect(coordsDeMaps('https://www.google.com/maps/place/Fraise/@4.7109,-74.0721,17z/data=!3d4.71123!4d-74.07199')).toEqual({ lat: 4.71123, lng: -74.07199 });
    expect(coordsDeMaps('https://maps.google.com/?q=4.94030,-74.02448')).toEqual({ lat: 4.9403, lng: -74.02448 });
    expect(coordsDeMaps('https://maps.app.goo.gl/abc')).toBeNull();
  });

  test('solo acepta links de Google Maps', () => {
    expect(esLinkMaps('https://maps.app.goo.gl/xYz')).toBe(true);
    expect(esLinkMaps('https://www.google.com/maps/place/X')).toBe(true);
    expect(esLinkMaps('https://www.google.com/search?q=x')).toBe(false);
    expect(esLinkMaps('https://evil.com/maps')).toBe(false);
    expect(esLinkMaps('javascript:alert(1)')).toBe(false);
  });

  test('distancia en metros', () => {
    expect(metrosEntre({ lat: 4.7109, lng: -74.0721 }, { lat: 4.7118, lng: -74.0721 })).toBe(100);
    expect(metrosEntre({ lat: 4.7, lng: -74 }, null)).toBeNull();
  });

  test('sin sedes asignadas marca en cualquiera; con sedes, solo en esas', () => {
    expect(puedeMarcarEn({ sedes: [] }, 'a')).toBe(true);
    expect(puedeMarcarEn({ sedes: ['a'] }, 'a')).toBe(true);
    expect(puedeMarcarEn({ sedes: ['a'] }, 'b')).toBe(false);
  });

  test('el candado es el mismo dentro del minuto y cambia al siguiente', () => {
    const t = new Date('2026-09-24T12:00:10Z');
    expect(candadoMarca('p', t)).toBe(candadoMarca('p', new Date('2026-09-24T12:00:50Z')));
    expect(candadoMarca('p', t)).not.toBe(candadoMarca('p', new Date('2026-09-24T12:01:10Z')));
  });
});

describe('asistencia: foto del rostro', () => {
  const { fotoDeDataUrl } = require('../utils/asistencia');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20000, 3)]);

  test('acepta el JPEG que sale de la cámara', () => {
    expect(fotoDeDataUrl(`data:image/jpeg;base64,${jpeg.toString('base64')}`)).toBeInstanceOf(Buffer);
  });

  test('rechaza otros formatos, archivos disfrazados y fotos enormes', () => {
    expect(fotoDeDataUrl(`data:image/png;base64,${jpeg.toString('base64')}`)).toBeNull();
    expect(fotoDeDataUrl(`data:image/jpeg;base64,${Buffer.alloc(20000, 3).toString('base64')}`)).toBeNull();
    expect(fotoDeDataUrl(`data:image/jpeg;base64,${Buffer.concat([jpeg, Buffer.alloc(500000)]).toString('base64')}`)).toBeNull();
    expect(fotoDeDataUrl(undefined)).toBeNull();
  });
});
