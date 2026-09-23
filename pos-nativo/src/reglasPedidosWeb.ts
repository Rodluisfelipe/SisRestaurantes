import type { PedidoWeb } from './nativo';

/**
 * Las reglas del tablero de pedidos web, sin pantalla de por medio.
 *
 * Qué columna, qué botón y adónde lleva ese botón. Las transiciones válidas
 * las decide el servidor —la caja usa el mismo camino que el panel—; esto solo
 * elige la que corresponde al siguiente paso normal, para que despachar sea
 * un toque por paso.
 */

export type Columna = 'nuevos' | 'preparando' | 'listos';

export function columnaDe(estado: string): Columna {
  if (['confirmed', 'preparing', 'inProgress', 'payment_confirmed'].includes(estado)) return 'preparando';
  if (estado === 'ready') return 'listos';
  return 'nuevos';
}

/** El siguiente paso normal de un pedido, o null si hay que esperar. */
export function siguientePaso(p: PedidoWeb): { estado: string; etiqueta: string } | null {
  switch (p.estado) {
    case 'pending':
      return { estado: 'confirmed', etiqueta: 'Aceptar' };
    /* El cliente todavía no paga: no hay nada que hacer más que esperar o
       cancelar. Aceptarlo sería prepararle comida a alguien que quizá no
       vuelve. */
    case 'pending_payment':
      return null;
    // Subió el comprobante: alguien tiene que mirarlo en su banco.
    case 'payment_uploaded':
      return { estado: 'payment_confirmed', etiqueta: 'Pago recibido' };
    case 'payment_confirmed':
    case 'confirmed':
    case 'preparing':
    case 'inProgress':
      return { estado: 'ready', etiqueta: 'Listo' };
    case 'ready':
      /* Un domicilio se "entrega": así el cliente recibe el aviso de que su
         pedido llegó. Lo demás se completa. Los dos lo archivan igual. */
      return p.tipo === 'delivery'
        ? { estado: 'delivered', etiqueta: 'Entregado' }
        : { estado: 'completed', etiqueta: 'Entregado' };
    default:
      return null;
  }
}

/** Los que acaban de llegar y piden atención, comparando contra lo ya visto. */
export function recienLlegados(vistos: Set<string>, lista: PedidoWeb[]): PedidoWeb[] {
  return lista.filter((p) => !vistos.has(p.id) && columnaDe(p.estado) === 'nuevos');
}

/** Cuántos minutos lleva esperando. */
export function minutosDesde(creado: string, ahora: number): number {
  const t = Date.parse(creado);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((ahora - t) / 60_000));
}

export const TIPO: Record<string, string> = {
  delivery: 'Domicilio',
  takeaway: 'Para llevar',
  inSite: 'En el local',
};

export const PAGO: Record<string, string> = {
  cash: 'Efectivo',
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  transfer: 'Transferencia',
  transferencia: 'Transferencia',
  bold: 'Tarjeta',
};
