/**
 * El vocabulario de MenuBy: los valores que aceptan los modelos, escritos una
 * sola vez. Si un modelo agrega un estado o un método de pago, se agrega acá y
 * TypeScript señala cada lugar que todavía no lo maneja.
 *
 * Deben coincidir con los `enum` de Models/*.js.
 */
import type { Types } from 'mongoose';

/** Un id de Mongo como llega: ObjectId o su texto. */
export type Id = Types.ObjectId | string;

/* ── Pedidos (Models/Order.js) ─────────────────────────────────────────── */

export type EstadoPedido =
  | 'pending'
  | 'pending_payment'
  | 'payment_uploaded'
  | 'payment_confirmed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'inProgress'
  | 'completed'
  | 'cancelled'
  | 'delivered';

export type TipoPedido = 'inSite' | 'takeaway' | 'delivery';

export type CanalPedido = 'whatsapp' | 'inapp' | 'pos' | 'admin';

export type MetodoPago =
  | 'cash'
  | 'efectivo'
  | 'nequi'
  | 'daviplata'
  | 'transfer'
  | 'transferencia'
  | 'bold'
  | 'credito'
  | 'other';

/** Lo que un pedido guarda de su cargo al crédito del cliente. */
export interface CreditoDelPedido {
  customerId?: Id | null;
  /** Lo que hoy está en la deuda del cliente por este pedido. */
  cargado?: number;
  /** Sube con cada ajuste: es parte de la llave de idempotencia. */
  version?: number;
}

/** Los montos de un pedido: lo que hace falta para saber cuánto vale. */
export interface MontosPedido {
  finalAmount?: number | null;
  totalAmount?: number | null;
  deliveryFee?: number | null;
  discountAmount?: number | null;
  tipAmount?: number | null;
}

/* ── Crédito (Models/CreditoMovimiento.js) ─────────────────────────────── */

export type TipoMovimientoCredito = 'cargo' | 'abono';

export type OrigenMovimientoCredito = 'caja' | 'panel';

export interface Movimiento {
  businessId: Id;
  customerId: Id;
  tipo: TipoMovimientoCredito;
  monto: number | string;
  /** Llave de idempotencia: el mismo origenId nunca mueve el saldo dos veces. */
  origenId: string;
  origen?: OrigenMovimientoCredito;
  medio?: string;
  referencia?: string;
  usuario?: string;
  nota?: string;
  fecha?: Date | string | number;
}

export interface ResultadoMovimiento {
  duplicado: boolean;
  saldo: number;
}

/** Lo mínimo de un cliente que devuelve clienteDeLaCaja. */
export interface ClienteBasico {
  _id: Id;
  name?: string;
  phone?: string;
}

/** Lo que sincronizarCreditoPedido necesita del pedido (lean o documento). */
export interface PedidoConCredito extends MontosPedido {
  _id: Id;
  businessId: Id;
  orderNumber?: number | string;
  status?: EstadoPedido;
  credito?: CreditoDelPedido | null;
}
