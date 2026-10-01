/**
 * Precio de los envíos de una empresa de reparto a sus propios clientes:
 * zonas con precio fijo y tarifa por distancia.
 */
const { calcularPrecioEnvio, normalizarTarifaEnvio, normalizarZonas, dentroDePoligono } = require('../utils/precioEnvio');

const centroChia = { lat: 4.8617, lng: -74.0328 };
const cerca = { lat: 4.8700, lng: -74.0400 }; // ~1,2 km en línea recta
const lejos = { lat: 4.7110, lng: -74.0721 }; // Bogotá, ~17 km

const tarifa = { base: 4000, porKm: 900, kmIncluidos: 2, minimo: 5000, maximoKm: 30, redondeo: 500 };
const zonaCentro = { nombre: 'Centro', precio: 6000, tipo: 'circulo', centro: { lat: 4.8700, lng: -74.0400 }, radioKm: 0.8 };
const suma = (r) => r.desglose.reduce((s, d) => s + d.valor, 0);

describe('zonas', () => {
  test('si el destino cae en una zona, manda el precio de la zona', () => {
    const r = calcularPrecioEnvio(tarifa, [zonaCentro], centroChia, cerca);
    expect(r).toMatchObject({ cubre: true, precio: 6000, zona: 'Centro' });
  });

  test('una zona apagada no cuenta', () => {
    const r = calcularPrecioEnvio(tarifa, [{ ...zonaCentro, activa: false }], centroChia, cerca);
    expect(r.zona).toBeUndefined();
  });

  test('polígonos', () => {
    const cuadro = [[-74.05, 4.85], [-74.03, 4.85], [-74.03, 4.88], [-74.05, 4.88]];
    expect(dentroDePoligono({ lat: 4.87, lng: -74.04 }, cuadro)).toBe(true);
    expect(dentroDePoligono({ lat: 4.90, lng: -74.04 }, cuadro)).toBe(false);
    const r = calcularPrecioEnvio(tarifa, [{ nombre: 'Norte', precio: 7000, poligono: cuadro }], centroChia, { lat: 4.87, lng: -74.04 });
    expect(r.precio).toBe(7000);
  });
});

describe('tarifa por distancia', () => {
  test('cerca: el mínimo', () => {
    const r = calcularPrecioEnvio(tarifa, [], centroChia, cerca);
    expect(r.precio).toBe(5000);
    expect(suma(r)).toBe(r.precio);
  });

  test('lejos: base + km por encima de los incluidos, redondeado', () => {
    const r = calcularPrecioEnvio(tarifa, [], centroChia, lejos);
    expect(r.cubre).toBe(true);
    expect(r.km).toBeGreaterThan(20);
    expect(r.precio % 500).toBe(0);
    expect(suma(r)).toBe(r.precio);
  });

  test('más allá de la distancia máxima no cubre', () => {
    const r = calcularPrecioEnvio({ ...tarifa, maximoKm: 10 }, [], centroChia, lejos);
    expect(r.cubre).toBe(false);
    expect(r.motivo).toMatch(/10 km/);
  });

  test('sin tarifa ni zonas: no inventa precio', () => {
    expect(calcularPrecioEnvio({}, [], centroChia, cerca).cubre).toBe(false);
    expect(calcularPrecioEnvio(tarifa, [], null, cerca).cubre).toBe(false);
  });
});

describe('lo que guarda la empresa se limpia', () => {
  test('tarifa sin negativos', () => {
    expect(normalizarTarifaEnvio({ base: -5, porKm: '800', redondeo: 0 })).toMatchObject({ base: 0, porKm: 800, redondeo: 100 });
  });

  test('zonas rotas se descartan', () => {
    const z = normalizarZonas([
      { nombre: 'Buena', precio: 5000, poligono: [[-74, 4], [-74.1, 4], [-74.1, 4.1]] },
      { nombre: 'Rota', precio: 5000, poligono: [[-74, 4]] },
      { nombre: 'Círculo', precio: -3, tipo: 'circulo', centro: { lat: 4.8, lng: -74 }, radioKm: 500 },
      { nombre: 'Sin centro', tipo: 'circulo' },
    ]);
    expect(z.map((x) => x.nombre)).toEqual(['Buena', 'Círculo']);
    expect(z[1]).toMatchObject({ precio: 0, radioKm: 100 });
  });
});
