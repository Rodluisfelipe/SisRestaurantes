const niveles = require('../utils/nivelesDomi');
const { cumple, avanzo } = require('../services/autoAceptar');
const { pickDriver } = require('../services/assignmentService');
const { normalizarCodigo, formatoCodigo, ocultarCorreo } = require('../services/beneficios');

const DIA = 24 * 60 * 60 * 1000;
const m = (x = {}) => ({ entregas: 0, cumplimiento: 1, puntualidad: 1, calificacion: 5, ...x });

describe('niveles: Go → Go+ → Pro → Élite → MenuBy Black', () => {
  test('sin entregas es Go; con lo de cada nivel, sube', () => {
    expect(niveles.nivelCalculado(m())).toBe(0);
    expect(niveles.nivelCalculado(m({ entregas: 10 }))).toBe(1);
    expect(niveles.nivelCalculado(m({ entregas: 40 }))).toBe(2);
    expect(niveles.nivelCalculado(m({ entregas: 100 }))).toBe(3);
    expect(niveles.nivelCalculado(m({ entregas: 250 }))).toBe(4);
    expect(niveles.nivelPorId(4).nombre).toBe('MenuBy Black');
  });

  test('muchas entregas no bastan: también cumplimiento, puntualidad y calificación', () => {
    expect(niveles.nivelCalculado(m({ entregas: 250, cumplimiento: 0.94 }))).toBe(2);
    expect(niveles.nivelCalculado(m({ entregas: 250, calificacion: 4.6 }))).toBe(2);
    expect(niveles.nivelCalculado(m({ entregas: 250, puntualidad: 0.8 }))).toBe(1);
  });

  test('lo que falta se dice en palabras', () => {
    const f = niveles.faltante(m({ entregas: 34, cumplimiento: 0.9 }), 2);
    expect(f[0]).toBe('6 entregas más en los últimos 30 días');
    expect(f[1]).toBe('Cumplimiento de 93 % (vas en 90 %)');
  });
});

describe('revisión justa del nivel', () => {
  const hoy = new Date('2026-10-01T12:00:00Z');

  test('subir es inmediato y trae escudo de 30 días', () => {
    const r = niveles.revisar({ actual: 1 }, 3, hoy);
    expect(r).toMatchObject({ actual: 3, cambio: 'sube' });
    expect(r.protegidoHasta - hoy).toBe(30 * DIA);
  });

  test('con escudo no baja: queda "en riesgo"', () => {
    const r = niveles.revisar({ actual: 3, protegidoHasta: new Date(+hoy + 5 * DIA), revisadoAt: new Date(+hoy - 40 * DIA) }, 1, hoy);
    expect(r).toMatchObject({ actual: 3, cambio: null, enRiesgo: true });
  });

  test('antes de la revisión mensual no baja', () => {
    const r = niveles.revisar({ actual: 3, revisadoAt: new Date(+hoy - 10 * DIA) }, 1, hoy);
    expect(r).toMatchObject({ actual: 3, cambio: null, enRiesgo: true });
  });

  test('en la revisión baja UN solo nivel aunque le corresponda menos', () => {
    const r = niveles.revisar({ actual: 4, revisadoAt: new Date(+hoy - 31 * DIA) }, 0, hoy);
    expect(r).toMatchObject({ actual: 3, cambio: 'baja', enRiesgo: true });
    expect(r.protegidoHasta - hoy).toBe(30 * DIA);
  });

  test('si mantiene su nivel, la revisión pasa sin cambios', () => {
    const r = niveles.revisar({ actual: 2, revisadoAt: new Date(+hoy - 31 * DIA) }, 2, hoy);
    expect(r).toMatchObject({ actual: 2, cambio: null, enRiesgo: false });
    expect(r.revisadoAt).toEqual(hoy);
  });

  test('puntualidad: se mide desde que recoge, con margen', () => {
    expect(niveles.minutosEsperados(2.2)).toBeCloseTo(12);
    expect(niveles.fuePuntual(20, 2.2)).toBe(true);
    expect(niveles.fuePuntual(30, 2.2)).toBe(false);
    expect(niveles.fuePuntual(20, null)).toBeNull();
  });
});

describe('aceptación automática', () => {
  const ahora = Date.now();
  const config = { activo: true, kmMax: 3, gananciaMin: 5000, maxPedidos: 1 };
  const base = { config, kmAlLocal: 1.2, ganancia: 6000, carga: 0, lastSeenAt: new Date(ahora - 30000), ahora };

  test('cumple todo → se acepta sola', () => {
    expect(cumple(base)).toEqual({ ok: true });
  });

  test('cada condición la frena', () => {
    expect(cumple({ ...base, config: { ...config, activo: false } }).motivo).toBe('apagada');
    expect(cumple({ ...base, lastSeenAt: new Date(ahora - 5 * 60000) }).motivo).toBe('sin_gps_fresco');
    expect(cumple({ ...base, kmAlLocal: 4 }).motivo).toBe('lejos');
    expect(cumple({ ...base, ganancia: 4000 }).motivo).toBe('paga_poco');
    expect(cumple({ ...base, carga: 1 }).motivo).toBe('lleva_pedidos');
  });

  test('sin tarifa (domi propio) no se mira la ganancia mínima', () => {
    expect(cumple({ ...base, ganancia: null }).ok).toBe(true);
  });

  test('arrancó: se acercó al local o ya está ahí', () => {
    expect(avanzo(2, 1.8)).toBe(true);
    expect(avanzo(2, 1.95)).toBe(false);
    expect(avanzo(0.2, 0.2)).toBe(true);
    expect(avanzo(2, null)).toBe(false);
  });
});

describe('desempate por nivel al elegir domi', () => {
  const domi = (id, lat, nivel, auto = false) => ({
    _id: id, lastLocation: { coordinates: [-74.05, lat] }, prioridad: { nivel, autoAcepta: { activo: auto } },
  });

  test('a distancia parecida gana el de más nivel', () => {
    const elegido = pickDriver([domi('cerca-go', 4.8601, 0), domi('pro', 4.8620, 2)], 4.86, -74.05, 'auto_nearest', 8);
    expect(elegido.driver._id).toBe('pro');
  });

  test('el nivel no le quita el pedido a uno mucho más cerca', () => {
    const elegido = pickDriver([domi('cerca-go', 4.8601, 0), domi('black-lejos', 4.89, 4, true)], 4.86, -74.05, 'auto_nearest', 8);
    expect(elegido.driver._id).toBe('cerca-go');
  });
});

describe('código del domi para beneficios', () => {
  test('se escribe como sea y se compara igual', () => {
    expect(normalizarCodigo('mb-7k3p9q')).toBe('MB7K3P9Q');
    expect(formatoCodigo('MB7K3P9Q')).toBe('MB-7K3P9Q');
  });

  test('el correo se muestra oculto', () => {
    expect(ocultarCorreo('sharay@gmail.com')).toBe('sh••••@gmail.com');
  });
});
