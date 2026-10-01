/**
 * Tarifa de la Red MenuBy (domis independientes): cuánto gana el domi por un
 * pedido según distancia, hora, lluvia y demanda.
 */
const { calcularTarifa, normalizarConfig, factorDemanda, minutoColombia, enFranja } = require('../utils/tarifaRed');

// 16:00 en Colombia (21:00 UTC): sin hora pico ni noche
const TARDE = new Date('2026-09-30T21:00:00Z');
const suma = (t) => t.desglose.reduce((s, d) => s + d.valor, 0);

describe('tarifa base', () => {
  test('pedido corto a media tarde: la tarifa mínima', () => {
    const t = calcularTarifa({ kmEntrega: 0.8, kmRecogida: 0.5, fecha: TARDE });
    expect(t.pagoDomi).toBe(4500);
    expect(t.multiplicador).toBe(1);
    expect(t.desglose.map((d) => d.concepto)).toEqual(['Tarifa base', 'Ajuste a la tarifa mínima']);
  });

  test('3 km: base + 2 km cobrados, redondeado a $500', () => {
    const t = calcularTarifa({ kmEntrega: 3, kmRecogida: 1, fecha: TARDE });
    // 2500 + 2000 = 4500
    expect(t.pagoDomi).toBe(4500);
    const u = calcularTarifa({ kmEntrega: 4.3, kmRecogida: 1, fecha: TARDE });
    // 2500 + 3300 = 5800 → 6000
    expect(u.pagoDomi).toBe(6000);
  });

  test('ir lejos a recoger también se paga', () => {
    const cerca = calcularTarifa({ kmEntrega: 4, kmRecogida: 1, fecha: TARDE });
    const lejos = calcularTarifa({ kmEntrega: 4, kmRecogida: 5.5, fecha: TARDE });
    expect(lejos.pagoDomi).toBeGreaterThan(cerca.pagoDomi);
    expect(lejos.desglose.some((d) => d.concepto.startsWith('Ir a recoger'))).toBe(true);
  });

  test('el desglose siempre suma exacto lo que gana', () => {
    for (const km of [0.3, 1.7, 3.2, 6.9, 12.4, 40]) {
      for (const fecha of [TARDE, new Date('2026-09-30T17:30:00Z'), new Date('2026-10-01T04:00:00Z')]) {
        const t = calcularTarifa({ kmEntrega: km, kmRecogida: km / 2, fecha, lluvia: km > 5, demanda: 8, oferta: 2 });
        expect(suma(t)).toBe(t.pagoDomi);
        expect(t.pagoDomi % 500).toBe(0);
      }
    }
  });
});

describe('hora, lluvia y demanda', () => {
  const base = { kmEntrega: 5, kmRecogida: 1 };
  const normal = calcularTarifa({ ...base, fecha: TARDE }).pagoDomi;

  test('hora pico (12:30 Colombia) paga más', () => {
    const t = calcularTarifa({ ...base, fecha: new Date('2026-09-30T17:30:00Z') });
    expect(t.pagoDomi).toBeGreaterThan(normal);
    expect(t.desglose.some((d) => d.concepto === 'Hora pico')).toBe(true);
  });

  test('de noche (23:00 Colombia) también, y no se suma con la hora pico', () => {
    const t = calcularTarifa({ ...base, fecha: new Date('2026-10-01T04:00:00Z') });
    expect(t.desglose.some((d) => d.concepto === 'Horario nocturno')).toBe(true);
    expect(t.factores.hora).toBe(1.2);
  });

  test('con lluvia y mucha demanda sube, pero con techo', () => {
    const t = calcularTarifa({ ...base, fecha: new Date('2026-10-01T04:00:00Z'), lluvia: true, demanda: 30, oferta: 1 });
    expect(t.multiplicador).toBe(2);
    expect(t.desglose.map((d) => d.concepto)).toEqual(expect.arrayContaining(['Lluvia', 'Alta demanda']));
  });

  test('sin tope máximo absurdo: nunca pasa el máximo configurado', () => {
    const t = calcularTarifa({ kmEntrega: 80, kmRecogida: 20, fecha: TARDE, lluvia: true, demanda: 50, oferta: 0 });
    expect(t.pagoDomi).toBe(30000);
    expect(suma(t)).toBe(30000);
  });

  test('demanda: con domis de sobra no sube', () => {
    const cfg = normalizarConfig();
    expect(factorDemanda(3, 5, cfg)).toBe(1);
    expect(factorDemanda(0, 0, cfg)).toBe(1);
    expect(factorDemanda(6, 2, cfg)).toBeCloseTo(1.5);
    expect(factorDemanda(100, 1, cfg)).toBe(1.6);
  });
});

describe('comisión y configuración', () => {
  test('la comisión la paga el negocio encima, no sale del domi', () => {
    const t = calcularTarifa({ kmEntrega: 4.3, fecha: TARDE }, { comisionPorcentaje: 10 });
    expect(t.pagoDomi).toBe(6000);
    expect(t.comision).toBe(600);
    expect(t.cobroNegocio).toBe(6600);
  });

  test('una configuración rota no da tarifas negativas ni locas', () => {
    const c = normalizarConfig({ base: -100, lluvia: 99, minimo: 5000, maximo: 1000, redondeo: 0, comisionPorcentaje: 300, horasPico: [{ desde: 'x', factor: 0.1 }] });
    expect(c.base).toBe(0);
    expect(c.lluvia).toBe(3);
    expect(c.maximo).toBe(5000);
    expect(c.redondeo).toBe(1);
    expect(c.comisionPorcentaje).toBe(50);
    expect(c.horasPico[0]).toEqual({ desde: '12:00', hasta: '14:00', factor: 1 });
  });
});

describe('hora de Colombia', () => {
  test('UTC-5 todo el año', () => {
    expect(minutoColombia(new Date('2026-09-30T05:00:00Z'))).toBe(0);
    expect(minutoColombia(new Date('2026-09-30T04:30:00Z'))).toBe(23 * 60 + 30);
  });

  test('franjas que cruzan medianoche', () => {
    expect(enFranja(23 * 60, '22:00', '05:00')).toBe(true);
    expect(enFranja(3 * 60, '22:00', '05:00')).toBe(true);
    expect(enFranja(12 * 60, '22:00', '05:00')).toBe(false);
  });
});
