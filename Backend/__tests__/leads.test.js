const { normalizarTelefono, esPlataforma, PLATAFORMA_ID } = require('../services/leads');
const { ETAPAS, FUENTES } = require('../Models/Lead');

describe('CRM de leads', () => {
  test('el teléfono queda en el mismo formato con el que llega WhatsApp', () => {
    expect(normalizarTelefono('300 111 2233')).toBe('573001112233');
    expect(normalizarTelefono('+57 (300) 111-2233')).toBe('573001112233');
    expect(normalizarTelefono('573001112233')).toBe('573001112233');
    expect(normalizarTelefono('123')).toBe('');
    expect(normalizarTelefono('')).toBe('');
  });

  test('la cuenta de plataforma se reconoce por su id y no choca con negocios reales', () => {
    expect(esPlataforma(PLATAFORMA_ID)).toBe(true);
    expect(esPlataforma(String(PLATAFORMA_ID))).toBe(true);
    expect(esPlataforma('699f8ae070c6fcd1db64bb0d')).toBe(false);
    expect(esPlataforma(null)).toBe(false);
  });

  test('las etapas van del primer contacto al cierre', () => {
    expect(ETAPAS[0]).toBe('nuevo');
    expect(ETAPAS).toEqual(expect.arrayContaining(['ganado', 'perdido']));
    expect(FUENTES).toEqual(expect.arrayContaining(['whatsapp', 'formulario', 'registro']));
  });
});
