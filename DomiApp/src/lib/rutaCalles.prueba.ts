/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPlan, decodificarPolyline, hayQuePedir, type PlanCalles } from './rutaCalles';
import type { Parada } from './ruta';

const parada = (clave: string, tipo: 'recoger' | 'entregar', requiere: string[] = []): Parada => ({
  clave, tipo, pedidoIds: [clave], titulo: clave, direccion: '', ubicacion: { lat: 4.86, lng: -74.05 }, tramoKm: 1, llegadaMin: 5, requiere,
});

test('decodifica la geometría de Mapbox (precisión 6)', () => {
  // Codificada por el backend (utils/rutas.codificarPolyline) para [[-74.058137,4.863168],[-74.0512,4.8581]]
  const c = decodificarPolyline('_kygHpxcglCv{HqpL');
  assert.equal(c.length, 2);
  assert.ok(Math.abs(c[0][0] + 74.058137) < 1e-6 && Math.abs(c[0][1] - 4.863168) < 1e-6);
});

test('el plan del servidor reordena y pone km y minutos reales', () => {
  const ps = [parada('r:A', 'recoger'), parada('e:1', 'entregar', ['r:A']), parada('e:2', 'entregar')];
  const plan: PlanCalles = {
    orden: ['e:2', 'r:A', 'e:1'], trazo: [], pedidoEn: { lat: 4.86, lng: -74.05 }, at: Date.now(),
    tramos: [{ clave: 'e:2', metros: 400, segundos: 90, llegadaSegundos: 90 }, { clave: 'r:A', metros: 1200, segundos: 240, llegadaSegundos: 330 }, { clave: 'e:1', metros: 3100, segundos: 540, llegadaSegundos: 870 }],
  };
  const r = aplicarPlan(ps, plan);
  assert.deepEqual(r.map((p) => p.clave), ['e:2', 'r:A', 'e:1']);
  assert.equal(r[2].llegadaMin, 15);
  assert.equal(r[1].tramoKm, 1.2);
});

test('si el plan ya no corresponde (cambiaron los pedidos) se ignora', () => {
  const ps = [parada('r:A', 'recoger'), parada('e:1', 'entregar')];
  const plan: PlanCalles = { orden: ['e:9'], trazo: [], tramos: [], pedidoEn: { lat: 0, lng: 0 }, at: 0 };
  assert.deepEqual(aplicarPlan(ps, plan), ps);
});

test('cuándo se vuelve a pedir la ruta', () => {
  const yo = { lat: 4.86, lng: -74.05 };
  const plan: PlanCalles = { orden: [], trazo: [], tramos: [], pedidoEn: yo, at: Date.now() };
  assert.equal(hayQuePedir(null, 'a', '', yo), true); // primera vez
  assert.equal(hayQuePedir(plan, 'a', 'a', yo), false); // nada cambió
  assert.equal(hayQuePedir(plan, 'a|b', 'a', yo), true); // cambiaron los pedidos
  assert.equal(hayQuePedir(plan, 'a', 'a', { lat: 4.865, lng: -74.05 }), true); // se alejó ~550 m
  assert.equal(hayQuePedir({ ...plan, at: Date.now() - 180_000 }, 'a', 'a', yo), true); // tráfico viejo
  assert.equal(hayQuePedir(plan, 'a', 'a', null), false); // sin GPS no se pide
});
