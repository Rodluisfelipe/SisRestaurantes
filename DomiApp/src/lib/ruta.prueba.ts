/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planearRuta, distanciaKm } from './ruta';
import { pesos, km, minutos, hora, celularBonito, diaCorto, sugerirBilletes } from './formato';
import type { Pedido, EstadoPedido } from './tipos';

const local = (id: string, lat: number, lng: number) => ({ id, nombre: id, logo: null, telefono: null, direccion: '', ubicacion: { lat, lng }, color: null });

function pedido(id: string, estado: EstadoPedido, negocio: ReturnType<typeof local>, cliente: { lat: number; lng: number }): Pedido {
  return {
    id, numero: id, driverId: 'd', estado, negocio,
    cliente: { nombre: `Cliente ${id}`, telefono: null, direccion: '', notas: '', ubicacion: cliente },
    productos: [], total: 0, domicilio: 0, metodoPago: null, efectivo: 0, ganancia: 0, distanciaKm: null,
    pideCodigoEntrega: true, pideCodigoRecogida: false, asignadoAt: null,
    marcas: { llegoLocal: null, recogido: null, llegoCliente: null, entregado: null }, listoEnLocal: false,
  };
}

const goBurger = local('Go Burger', 4.8632, -74.0581);
const doggitos = local('Doggitos', 4.8702, -74.0470);
const yo = { lat: 4.8600, lng: -74.0600 };

test('un pedido: primero el local, después el cliente', () => {
  const r = planearRuta(yo, [pedido('1', 'hacia_local', goBurger, { lat: 4.858, lng: -74.051 })]);
  assert.deepEqual(r.map((p) => p.tipo), ['recoger', 'entregar']);
  assert.ok(r[0].llegadaMin! < r[1].llegadaMin!);
});

test('dos pedidos del mismo local se recogen en UNA parada', () => {
  const r = planearRuta(yo, [
    pedido('1', 'hacia_local', goBurger, { lat: 4.858, lng: -74.051 }),
    pedido('2', 'hacia_local', goBurger, { lat: 4.866, lng: -74.043 }),
  ]);
  assert.equal(r.filter((p) => p.tipo === 'recoger').length, 1);
  assert.deepEqual(r[0].pedidoIds.sort(), ['1', '2']);
  assert.equal(r.length, 3);
});

test('nunca entrega algo que todavía no recogió', () => {
  // El cliente de Doggitos queda al lado del domi, pero el local está lejos
  const r = planearRuta(yo, [
    pedido('1', 'hacia_local', doggitos, { lat: 4.8601, lng: -74.0601 }),
    pedido('2', 'hacia_cliente', goBurger, { lat: 4.866, lng: -74.043 }),
  ]);
  const iRecoger = r.findIndex((p) => p.clave === 'r:Doggitos');
  const iEntregar = r.findIndex((p) => p.clave === 'e:1');
  assert.ok(iRecoger < iEntregar);
});

test('elige el orden más corto', () => {
  // Ya recogidos: uno cerca y uno lejos → primero el cercano
  const r = planearRuta(yo, [
    pedido('lejos', 'hacia_cliente', goBurger, { lat: 4.90, lng: -74.03 }),
    pedido('cerca', 'hacia_cliente', goBurger, { lat: 4.861, lng: -74.059 }),
  ]);
  assert.deepEqual(r.map((p) => p.clave), ['e:cerca', 'e:lejos']);
});

test('con muchos pedidos no se cuelga y respeta el orden', () => {
  const muchos = Array.from({ length: 8 }, (_, i) => pedido(String(i), 'hacia_local', local(`L${i}`, 4.85 + i * 0.003, -74.05), { lat: 4.86 + i * 0.002, lng: -74.04 }));
  const t = Date.now();
  const r = planearRuta(yo, muchos);
  assert.ok(Date.now() - t < 200);
  assert.equal(r.length, 16);
  for (let i = 0; i < 8; i++) {
    assert.ok(r.findIndex((p) => p.clave === `r:L${i}`) < r.findIndex((p) => p.clave === `e:${i}`));
  }
});

test('sin GPS igual arma la ruta', () => {
  const r = planearRuta(null, [pedido('1', 'hacia_local', goBurger, { lat: 4.858, lng: -74.051 })]);
  assert.equal(r.length, 2);
});

test('lo entregado ya no aparece', () => {
  assert.equal(planearRuta(yo, [pedido('1', 'entregado', goBurger, yo)]).length, 0);
});

test('distancia', () => {
  const d = distanciaKm({ lat: 4.8617, lng: -74.0328 }, { lat: 4.5981, lng: -74.076 })!;
  assert.ok(d > 28 && d < 31);
});

test('formatos colombianos', () => {
  assert.equal(pesos(59000), '$59.000');
  assert.equal(pesos(1234567), '$1.234.567');
  assert.equal(pesos(-5000), '-$5.000');
  assert.equal(km(0.34), '350 m');
  assert.equal(km(2.36), '2,4 km');
  assert.equal(minutos(75), '1 h 15 min');
  assert.equal(hora(new Date(2026, 8, 29, 22, 5)), '10:05 p. m.');
  assert.equal(hora(new Date(2026, 8, 29, 0, 30)), '12:30 a. m.');
  assert.equal(celularBonito('3001234567'), '300 123 4567');
  assert.equal(diaCorto('2026-09-29'), 'mar 29');
});

test('billetes para calcular las vueltas', () => {
  assert.deepEqual(sugerirBilletes(59000), [59000, 60000, 100000]);
  assert.deepEqual(sugerirBilletes(36500), [36500, 38000, 40000, 50000]);
  assert.deepEqual(sugerirBilletes(20000), [20000, 50000, 100000]);
});
