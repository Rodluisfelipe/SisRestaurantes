/**
 * "¿Sigues en camino?": si el domi lleva un rato sin moverse yendo al local o
 * al cliente, se le avisa (suena aunque tenga la pantalla apagada o esté en
 * otra app).
 *
 * No se le molesta mientras atiende una parada (esperando en el local o con
 * el cliente) ni cuando ya está llegando: ahí quedarse quieto es lo normal.
 */
import { primerNombre } from './formato';
import { distanciaKm } from './ruta';
import type { Pedido, Punto } from './tipos';

export const QUIETO_MS = 5 * 60_000; // 5 minutos sin moverse
export const MOVIO_M = 80; // menos que esto es el GPS bailando, no moverse
export const CERCA_DESTINO_M = 150; // ya llegando: no se le avisa

/** A dónde debería ir ahora, o null si está atendiendo una parada. */
export function destinoActual(pedidos: Pedido[]): { texto: string; ubicacion: Punto | null } | null {
  if (pedidos.some((p) => p.estado === 'en_local' || p.estado === 'con_cliente')) return null;
  // Primero lo que ya lleva encima (la comida se enfría); si no, ir al local
  const llevando = pedidos.find((p) => p.estado === 'hacia_cliente');
  if (llevando) return { texto: `Sigue hacia la dirección de ${primerNombre(llevando.cliente.nombre)}`, ubicacion: llevando.cliente.ubicacion };
  const recoger = pedidos.find((p) => p.estado === 'hacia_local');
  if (recoger) return { texto: `Sigue hacia ${recoger.negocio?.nombre || 'el local'}`, ubicacion: recoger.negocio?.ubicacion ?? null };
  return null;
}

/** ¿Toca avisar? (pura, para probarla sin celular) */
export function tocaAvisar(o: {
  destino: { ubicacion: Punto | null } | null; yo: Punto | null; quietoDesde: number; ultimoAviso: number; ahora: number;
}): boolean {
  if (!o.destino || !o.yo) return false;
  const d = distanciaKm(o.yo, o.destino.ubicacion);
  if (d != null && d * 1000 < CERCA_DESTINO_M) return false;
  return o.ahora - o.quietoDesde >= QUIETO_MS && o.ahora - o.ultimoAviso >= QUIETO_MS;
}
