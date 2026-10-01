/**
 * El orden de las paradas cuando se llevan varios pedidos.
 *
 * Reglas de la calle:
 *  - un pedido se recoge antes de entregarse;
 *  - dos pedidos del mismo local se recogen en una sola parada;
 *  - con pocos pedidos se prueban TODOS los órdenes posibles y se elige el
 *    más corto (con 3 pedidos son unos cientos: nada para un celular);
 *  - con muchos, se va siempre a la parada posible más cercana.
 *
 * Sin señal sigue funcionando: todo sale de coordenadas que ya están en el
 * celular.
 */
import type { Pedido, Punto } from './tipos';

export type Parada = {
  clave: string;
  tipo: 'recoger' | 'entregar';
  pedidoIds: string[];
  titulo: string;
  direccion: string;
  ubicacion: Punto | null;
  /** km desde la parada anterior (o desde donde está el domi) */
  tramoKm: number | null;
  /** minutos estimados hasta llegar a esta parada, desde ahora */
  llegadaMin: number | null;
  /** paradas que tienen que ir antes (recoger antes de entregar) */
  requiere: string[];
};

const VELOCIDAD_KMH = 22; // moto en ciudad, con semáforos
const MIN_POR_PARADA = 3;
const FACTOR_CALLES = 1.3; // la calle nunca es línea recta
const MAX_EXACTO = 7; // paradas hasta las que se prueba todo

export function distanciaKm(a: Punto | null | undefined, b: Punto | null | undefined): number | null {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

type Nodo = Omit<Parada, 'tramoKm' | 'llegadaMin'>;

/** Paradas pendientes, sin ordenar. */
function paradasPendientes(pedidos: Pedido[]): Nodo[] {
  const recogidas = new Map<string, Nodo>();
  const entregas: Nodo[] = [];
  for (const p of pedidos) {
    const falta = p.estado === 'hacia_local' || p.estado === 'en_local';
    if (falta) {
      const clave = `r:${p.negocio?.id || p.id}`;
      const r = recogidas.get(clave);
      if (r) r.pedidoIds.push(p.id);
      else {
        recogidas.set(clave, {
          clave,
          tipo: 'recoger',
          pedidoIds: [p.id],
          titulo: p.negocio?.nombre || 'Local',
          direccion: p.negocio?.direccion || '',
          ubicacion: p.negocio?.ubicacion || null,
          requiere: [],
        });
      }
    }
    if (['hacia_local', 'en_local', 'hacia_cliente', 'con_cliente'].includes(p.estado)) {
      entregas.push({
        clave: `e:${p.id}`,
        tipo: 'entregar',
        pedidoIds: [p.id],
        titulo: p.cliente.nombre,
        direccion: p.cliente.direccion,
        ubicacion: p.cliente.ubicacion,
        requiere: falta ? [`r:${p.negocio?.id || p.id}`] : [],
      });
    }
  }
  return [...recogidas.values(), ...entregas];
}

/** Costo de un tramo; si falta una coordenada se castiga, no se ignora. */
function tramo(a: Punto | null, b: Punto | null): number {
  const d = distanciaKm(a, b);
  return d == null ? 3 : d;
}

function recorridoExacto(origen: Punto | null, nodos: Nodo[]): Nodo[] {
  let mejor: Nodo[] = [];
  let mejorCosto = Infinity;
  const usados = new Set<string>();
  const camino: Nodo[] = [];
  const buscar = (desde: Punto | null, costo: number) => {
    if (costo >= mejorCosto) return;
    if (camino.length === nodos.length) {
      mejor = [...camino];
      mejorCosto = costo;
      return;
    }
    for (const n of nodos) {
      if (usados.has(n.clave)) continue;
      if (n.requiere.some((r) => !usados.has(r))) continue;
      usados.add(n.clave);
      camino.push(n);
      buscar(n.ubicacion, costo + tramo(desde, n.ubicacion));
      camino.pop();
      usados.delete(n.clave);
    }
  };
  buscar(origen, 0);
  return mejor;
}

function recorridoCercano(origen: Punto | null, nodos: Nodo[]): Nodo[] {
  const hechos = new Set<string>();
  const out: Nodo[] = [];
  let aqui = origen;
  while (out.length < nodos.length) {
    let elegido: Nodo | null = null;
    let menor = Infinity;
    for (const n of nodos) {
      if (hechos.has(n.clave) || n.requiere.some((r) => !hechos.has(r))) continue;
      const c = tramo(aqui, n.ubicacion);
      if (c < menor) { menor = c; elegido = n; }
    }
    if (!elegido) break;
    hechos.add(elegido.clave);
    out.push(elegido);
    aqui = elegido.ubicacion;
  }
  return out;
}

export function planearRuta(origen: Punto | null, pedidos: Pedido[]): Parada[] {
  const nodos = paradasPendientes(pedidos);
  if (!nodos.length) return [];
  const orden = nodos.length <= MAX_EXACTO ? recorridoExacto(origen, nodos) : recorridoCercano(origen, nodos);
  let desde = origen;
  let acumulado = 0;
  return orden.map((n) => {
    const d = distanciaKm(desde, n.ubicacion);
    if (d != null) acumulado += (d * FACTOR_CALLES * 60) / VELOCIDAD_KMH + MIN_POR_PARADA;
    desde = n.ubicacion ?? desde;
    return {
      ...n,
      tramoKm: d == null ? null : Math.round(d * FACTOR_CALLES * 10) / 10,
      llegadaMin: d == null ? null : Math.round(acumulado - MIN_POR_PARADA),
    };
  });
}
