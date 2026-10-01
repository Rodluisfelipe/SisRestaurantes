import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinoActual, QUIETO_MS, tocaAvisar } from './quieto';
import type { Pedido } from './tipos';

const local = { lat: 4.8612, lng: -74.061 };
const casa = { lat: 4.8712, lng: -74.061 }; // ~1,1 km
const pedido = (estado: Pedido['estado']): Pedido => ({
  id: estado, numero: 1, driverId: null, estado,
  negocio: { id: 'n', nombre: 'Go Burger', logo: null, telefono: null, direccion: '', ubicacion: local, color: null },
  cliente: { nombre: 'Laura Gómez', telefono: null, direccion: '', notas: '', ubicacion: casa },
  productos: [], total: 0, domicilio: 0, metodoPago: null, efectivo: 0, ganancia: 0, distanciaKm: null,
  pideCodigoEntrega: false, pideCodigoRecogida: false, asignadoAt: null,
  marcas: { llegoLocal: null, recogido: null, llegoCliente: null, entregado: null }, listoEnLocal: false,
});

test('va al cliente si ya lleva el pedido; si no, al local', () => {
  assert.equal(destinoActual([pedido('hacia_local'), pedido('hacia_cliente')])?.texto, 'Sigue hacia la dirección de Laura');
  assert.equal(destinoActual([pedido('hacia_local')])?.texto, 'Sigue hacia Go Burger');
});

test('atendiendo una parada (en el local o con el cliente) no se le molesta', () => {
  assert.equal(destinoActual([pedido('en_local'), pedido('hacia_cliente')]), null);
  assert.equal(destinoActual([pedido('con_cliente')]), null);
  assert.equal(destinoActual([]), null);
});

test('5 minutos quieto lejos del destino: avisa; y no repite antes de otros 5', () => {
  const destino = { ubicacion: casa };
  const ahora = 10 * QUIETO_MS;
  assert.equal(tocaAvisar({ destino, yo: local, quietoDesde: ahora - QUIETO_MS, ultimoAviso: 0, ahora }), true);
  assert.equal(tocaAvisar({ destino, yo: local, quietoDesde: ahora - QUIETO_MS + 1000, ultimoAviso: 0, ahora }), false);
  assert.equal(tocaAvisar({ destino, yo: local, quietoDesde: 0, ultimoAviso: ahora - 60_000, ahora }), false);
});

test('ya llegando (a menos de 150 m) no avisa aunque esté quieto', () => {
  assert.equal(tocaAvisar({ destino: { ubicacion: casa }, yo: { lat: 4.8711, lng: -74.061 }, quietoDesde: 0, ultimoAviso: 0, ahora: 10 * QUIETO_MS }), false);
});
