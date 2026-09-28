/**
 * La cuenta de crédito de los clientes: cargos (lo fiado) y abonos.
 *
 * Una sola puerta para las dos cosas, la usen la caja o el panel, y siempre
 * idempotente por `origenId`: la cola de la caja reintenta hasta que le
 * confirmamos, y un reintento no puede fiar ni abonar dos veces.
 */
import mongoose = require('mongoose');
import Customer = require('../Models/Customer');
import CreditoMovimiento = require('../Models/CreditoMovimiento');
import type {
  Id,
  MontosPedido,
  Movimiento,
  ResultadoMovimiento,
  ClienteBasico,
  PedidoConCredito,
} from '../types/dominio';

const saldoDe = (c: { credito?: { saldo?: number } } | null | undefined): number => c?.credito?.saldo || 0;

/**
 * Registra un cargo o un abono y mueve el saldo del cliente.
 */
async function mover({
  businessId, customerId, tipo, monto, origenId,
  origen = 'caja', medio = '', referencia = '', usuario = '', nota = '', fecha,
}: Movimiento): Promise<ResultadoMovimiento> {
  // Validación de ejecución: el JS que llama a esto no pasa por el compilador.
  if (!['cargo', 'abono'].includes(tipo)) throw new Error('Tipo de movimiento inválido');
  const valor = Math.round(Number(monto) || 0);
  if (valor <= 0) throw new Error('Monto inválido');

  const ya = await CreditoMovimiento.findOne({ businessId, origenId }).select('saldoDespues').lean<{ saldoDespues: number }>();
  if (ya) return { duplicado: true, saldo: ya.saldoDespues };

  const delta = tipo === 'cargo' ? valor : -valor;
  /* El abono se acota: no se deja el saldo en negativo. Lo que sobre sería
     saldo a favor, que es otro campo con otras reglas. */
  const cliente = await Customer.findOneAndUpdate(
    { _id: customerId, businessId },
    [{
      $set: {
        'credito.saldo': { $max: [0, { $add: [{ $ifNull: ['$credito.saldo', 0] }, delta] }] },
        /* Mover la fecha es lo que hace que las **otras** cajas bajen el saldo
           nuevo: la bajada de clientes va por marca de agua. Sin esto, lo que
           se fió en la caja 1 no existiría para la caja 2. */
        updatedAt: '$$NOW',
      },
    }],
    { new: true },
  ).select('credito').lean<{ credito?: { saldo?: number } }>();
  if (!cliente) throw new Error('Cliente no encontrado');

  try {
    await CreditoMovimiento.create({
      businessId, customerId, tipo, monto: valor, origenId, origen, medio, referencia, usuario, nota,
      saldoDespues: saldoDe(cliente),
      fecha: fecha ? new Date(fecha) : new Date(),
    });
  } catch (e) {
    /* Dos reintentos simultáneos: el segundo choca contra el índice único.
       Se deshace su movimiento del saldo y se responde como duplicado. */
    if ((e as { code?: number })?.code === 11000) {
      await Customer.updateOne({ _id: customerId, businessId }, { $inc: { 'credito.saldo': -delta } });
      return { duplicado: true, saldo: saldoDe(cliente) - delta };
    }
    throw e;
  }
  return { duplicado: false, saldo: saldoDe(cliente) };
}

/** El cliente de una venta o abono de la caja: por id si es de la nube, si no por teléfono. */
async function clienteDeLaCaja(
  businessId: Id,
  { clienteId, telefono }: { clienteId?: string | null; telefono?: string | number | null },
): Promise<ClienteBasico | null> {
  if (clienteId && mongoose.isValidObjectId(clienteId)) {
    const c = await Customer.findOne({ _id: clienteId, businessId }).select('_id name phone').lean<ClienteBasico>();
    if (c) return c;
  }
  const tel = String(telefono || '').trim();
  if (tel) return Customer.findOne({ businessId, phone: tel }).select('_id name phone').lean<ClienteBasico>();
  return null;
}

/** Lo que vale un pedido para el cliente (productos + envío − descuento + propina). */
function valorDelPedido(o: MontosPedido): number {
  if (typeof o.finalAmount === 'number' && o.finalAmount > 0) return Math.round(o.finalAmount);
  return Math.max(0, Math.round((o.totalAmount || 0) + (o.deliveryFee || 0) - (o.discountAmount || 0) + (o.tipAmount || 0)));
}

/**
 * Deja la deuda del cliente igual a lo que vale su pedido a crédito.
 *
 * El pedido guarda cuánto se le cargó (`credito.cargado`). Si el pedido cambia
 * (se agregan o quitan productos) se carga o abona la diferencia; si se
 * cancela o se elimina, se le devuelve todo. Cada ajuste lleva su propio
 * `origenId` (pedido + versión), así un reintento no mueve el saldo dos veces.
 */
async function sincronizarCreditoPedido(
  pedido: PedidoConCredito | null | undefined,
  { anular = false, usuario = '' }: { anular?: boolean; usuario?: string } = {},
): Promise<ResultadoMovimiento | null> {
  // Perezoso: Order importa cosas que a su vez usan este servicio.
  const Order: typeof import('../Models/Order') = require('../Models/Order');
  const credito = pedido?.credito;
  if (!pedido || !credito?.customerId) return null;

  const objetivo = anular || pedido.status === 'cancelled' ? 0 : valorDelPedido(pedido);
  const cargado = Math.round(credito.cargado || 0);
  const diferencia = objetivo - cargado;
  if (!diferencia) return null;

  /* Reservar el ajuste: solo gana quien vea el mismo `cargado` y la misma
     versión. Si el pedido ya se borró (anular), se usa la versión que traía. */
  const version = (credito.version || 0) + 1;
  if (!anular) {
    const reservado = await Order.updateOne(
      { _id: pedido._id, 'credito.cargado': cargado, 'credito.version': credito.version || 0 },
      { $set: { 'credito.cargado': objetivo, 'credito.version': version } },
    );
    if (!reservado.modifiedCount) return null;
  }

  return mover({
    businessId: pedido.businessId,
    customerId: credito.customerId,
    tipo: diferencia > 0 ? 'cargo' : 'abono',
    monto: Math.abs(diferencia),
    origenId: `pedido-${pedido._id}-${version}`,
    origen: 'panel',
    medio: 'pedido',
    referencia: `Pedido #${pedido.orderNumber}`,
    usuario,
    nota: objetivo === 0 ? 'Pedido cancelado' : cargado === 0 ? 'Pedido rápido a crédito' : 'Ajuste del pedido',
  });
}

export = { mover, clienteDeLaCaja, valorDelPedido, sincronizarCreditoPedido };
