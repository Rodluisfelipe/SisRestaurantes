/**
 * Rutas por las calles (sin red): geometría de Mapbox, orden de paradas con
 * tiempos reales y llave del caché.
 */
const { decodificarPolyline, codificarPolyline, claveRuta, ordenarConMatriz, segundosMoto } = require('../utils/rutas');

describe('geometría', () => {
  test('ida y vuelta con 6 decimales', () => {
    const ruta = [[-74.058137, 4.863168], [-74.0512, 4.8581], [-74.043123, 4.865512]];
    const vuelta = decodificarPolyline(codificarPolyline(ruta));
    vuelta.forEach(([lng, lat], i) => {
      expect(lng).toBeCloseTo(ruta[i][0], 6);
      expect(lat).toBeCloseTo(ruta[i][1], 6);
    });
  });

  test('decodifica una polyline conocida (precisión 5 de Google)', () => {
    // Ejemplo oficial: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" → (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const c = decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(c[0]).toEqual([-120.2, 38.5]);
    expect(c[2][0]).toBeCloseTo(-126.453, 3);
  });

  test('cadena vacía: sin puntos', () => {
    expect(decodificarPolyline('')).toEqual([]);
  });
});

describe('orden de paradas con tiempos reales', () => {
  // 0 = domi, 1 = recoger A, 2 = entregar A, 3 = entregar B (ya recogido)
  const m = [
    [0, 300, 900, 100],
    [300, 0, 400, 500],
    [900, 400, 0, 800],
    [100, 500, 800, 0],
  ];
  const paradas = [
    { clave: 'r:A' },
    { clave: 'e:A', requiere: ['r:A'] },
    { clave: 'e:B' },
  ];

  test('elige el orden más rápido y nunca entrega antes de recoger', () => {
    const r = ordenarConMatriz(m, paradas);
    // e:B (100) → r:A (500) → e:A (400) = 1000, mejor que r:A → e:A → e:B (1500)
    expect(r.orden).toEqual(['e:B', 'r:A', 'e:A']);
    expect(r.totalSegundos).toBe(1000);
  });

  test('un tramo sin dato se castiga, no rompe', () => {
    const r = ordenarConMatriz([[0, null, 50], [null, 0, 20], [50, 20, 0]], [{ clave: 'a' }, { clave: 'b' }]);
    expect(r.orden).toEqual(['b', 'a']);
  });

  test('con muchas paradas usa el más rápido siguiente y respeta el orden', () => {
    const n = 12;
    const mat = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => Math.abs(i - j) * 60));
    const ps = Array.from({ length: n }, (_, i) => ({ clave: `p${i + 1}`, requiere: i % 2 ? [`p${i}`] : [] }));
    const r = ordenarConMatriz(mat, ps);
    expect(r.orden).toHaveLength(n);
    for (let i = 1; i < n; i += 2) expect(r.orden.indexOf(`p${i}`)).toBeLessThan(r.orden.indexOf(`p${i + 1}`));
  });
});

describe('caché y moto', () => {
  test('dos puntos a menos de ~10 m comparten ruta en caché', () => {
    const a = claveRuta('driving', [{ lat: 4.863168, lng: -74.058137 }, { lat: 4.8581, lng: -74.0512 }]);
    const b = claveRuta('driving', [{ lat: 4.863171, lng: -74.058131 }, { lat: 4.85811, lng: -74.05121 }]);
    expect(a).toBe(b);
  });

  test('la moto va un 15 % más rápido que el carro en ciudad', () => {
    expect(segundosMoto(600)).toBe(510);
  });
});
