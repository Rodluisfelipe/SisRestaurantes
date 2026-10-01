const { hashPin, pinCorrecto } = require('../utils/pinDomi');

describe('pinCorrecto: un solo PIN por persona', () => {
  test('con PIN de cuenta, solo vale ese (los PIN viejos de cada negocio ya no)', () => {
    const cuenta = { pinHash: hashPin('4821') };
    const perfiles = [{ code: hashPin('1357') }];
    expect(pinCorrecto('4821', cuenta, perfiles)).toBe(true);
    expect(pinCorrecto('1357', cuenta, perfiles)).toBe(false);
  });

  test('sin PIN de cuenta (primera vez), vale el de cualquiera de sus perfiles', () => {
    const perfiles = [{ code: hashPin('1357') }, { code: hashPin('2468') }];
    expect(pinCorrecto('2468', null, perfiles)).toBe(true);
    expect(pinCorrecto('9999', { pinHash: null }, perfiles)).toBe(false);
  });

  test('un PIN que no es de 4 números nunca vale', () => {
    const cuenta = { pinHash: hashPin('4821') };
    expect(pinCorrecto('', cuenta)).toBe(false);
    expect(pinCorrecto('48210', cuenta)).toBe(false);
    expect(pinCorrecto(undefined, null, [{ code: hashPin('undefined') }])).toBe(false);
  });

  test('sin cuenta ni perfiles no hay nada que abrir', () => {
    expect(pinCorrecto('4821', null, [])).toBe(false);
  });
});
