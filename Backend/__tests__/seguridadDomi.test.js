const { evaluarIntegridad, filtrarPuntos, firmasPermitidas } = require('../utils/seguridadDomi');

const FIRMA = 'ab'.repeat(32);
const OTRA = 'cd'.repeat(32);

describe('firmasPermitidas', () => {
  test('acepta huellas con dos puntos, espacios o comas, y descarta basura', () => {
    const conPuntos = FIRMA.toUpperCase().match(/../g).join(':');
    expect(firmasPermitidas(`${conPuntos}, ${OTRA}  nada`)).toEqual([FIRMA, OTRA]);
    expect(firmasPermitidas('')).toEqual([]);
  });
});

describe('evaluarIntegridad', () => {
  test('sin firmas configuradas (desarrollo) no exige nada', () => {
    expect(evaluarIntegridad(undefined, [])).toMatchObject({ exigida: false, alterada: false });
  });

  test('la app oficial y sana pasa', () => {
    expect(evaluarIntegridad({ firmas: [FIRMA], ganchos: [], depurable: false }, [FIRMA]).alterada).toBe(false);
  });

  test('sin reporte (web o app vieja) no pasa cuando se exige', () => {
    expect(evaluarIntegridad(null, [FIRMA])).toMatchObject({ alterada: true, motivos: ['sin_reporte'] });
  });

  test('una app recompilada con otra llave no pasa', () => {
    expect(evaluarIntegridad({ firmas: [OTRA] }, [FIRMA]).motivos).toContain('firma');
  });

  test('Frida/Xposed o modo depuración no pasan', () => {
    const r = evaluarIntegridad({ firmas: [FIRMA], ganchos: ['frida'], depurable: true }, [FIRMA]);
    expect(r.alterada).toBe(true);
    expect(r.motivos).toEqual(expect.arrayContaining(['ganchos', 'depurable']));
  });

  test('root y emulador solo se anotan', () => {
    const r = evaluarIntegridad({ firmas: [FIRMA], root: true, emulador: true }, [FIRMA]);
    expect(r.alterada).toBe(false);
    expect(r.avisos).toEqual(['root', 'emulador']);
  });
});

describe('filtrarPuntos', () => {
  const t0 = new Date('2026-09-30T12:00:00Z').getTime();
  const en = (seg) => new Date(t0 + seg * 1000).toISOString();
  // Chía: ~0,0045° de latitud ≈ 500 m
  const A = { lat: 4.8612, lng: -74.061 };

  test('un recorrido normal en moto pasa completo', () => {
    const puntos = [0, 30, 60].map((s, i) => ({ lat: A.lat + i * 0.002, lng: A.lng, at: en(s) }));
    expect(filtrarPuntos(puntos)).toMatchObject({ simulados: 0, saltos: 0 });
    expect(filtrarPuntos(puntos).buenos).toHaveLength(3);
  });

  test('los puntos que Android marca como simulados se descartan', () => {
    const r = filtrarPuntos([{ ...A, at: en(0), simulada: true }, { ...A, at: en(5) }]);
    expect(r.simulados).toBe(1);
    expect(r.buenos).toHaveLength(1);
  });

  test('un salto de 20 km en 10 segundos es teletransporte', () => {
    const r = filtrarPuntos([{ ...A, at: en(0) }, { lat: A.lat + 0.18, lng: A.lng, at: en(10) }]);
    expect(r.saltos).toBe(1);
    expect(r.buenos).toHaveLength(1);
  });

  test('el mismo salto contra el ancla guardada también se pilla', () => {
    const r = filtrarPuntos([{ lat: A.lat + 0.18, lng: A.lng, at: en(10) }], { ...A, at: en(0) });
    expect(r.saltos).toBe(1);
  });

  test('20 km en una hora es normal (el domi se movió desconectado)', () => {
    const r = filtrarPuntos([{ lat: A.lat + 0.18, lng: A.lng, at: en(3600) }], { ...A, at: en(0) });
    expect(r.saltos).toBe(0);
  });

  test('los saltitos del GPS entre edificios no cuentan', () => {
    const r = filtrarPuntos([{ ...A, at: en(0) }, { lat: A.lat + 0.003, lng: A.lng, at: en(1) }]);
    expect(r.saltos).toBe(0);
  });
});
