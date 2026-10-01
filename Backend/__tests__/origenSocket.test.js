const { origenSocketPermitido } = require('../utils/origenSocket');

const LISTA = ['https://menuby.tech'];

describe('origenSocketPermitido', () => {
  test('sin Origin (servidores, curl) se acepta', () => {
    expect(origenSocketPermitido(undefined, 'api.menuby.tech', LISTA)).toBe(true);
  });

  test('un origen de la lista se acepta', () => {
    expect(origenSocketPermitido('https://menuby.tech', 'api.menuby.tech', LISTA)).toBe(true);
  });

  test('la app nativa (Origin = el propio servidor) se acepta', () => {
    expect(origenSocketPermitido('https://api.menuby.tech', 'api.menuby.tech', LISTA)).toBe(true);
    expect(origenSocketPermitido('http://10.0.2.2:5078', '10.0.2.2:5078', LISTA)).toBe(true);
  });

  test('una página ajena se rechaza', () => {
    expect(origenSocketPermitido('https://malo.com', 'api.menuby.tech', LISTA)).toBe(false);
    expect(origenSocketPermitido('https://api.menuby.tech.malo.com', 'api.menuby.tech', LISTA)).toBe(false);
  });

  test('un Origin roto se rechaza', () => {
    expect(origenSocketPermitido('no-es-url', 'api.menuby.tech', LISTA)).toBe(false);
    expect(origenSocketPermitido('null', 'api.menuby.tech', LISTA)).toBe(false);
  });
});
