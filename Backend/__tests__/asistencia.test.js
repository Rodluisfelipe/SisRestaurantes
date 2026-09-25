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
