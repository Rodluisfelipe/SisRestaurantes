/**
 * La cuenta de crédito de los clientes: cargos (lo fiado) y abonos.
 *
 * Una sola puerta para las dos cosas, la usen la caja o el panel, y siempre
 * idempotente por `origenId`: la cola de la caja reintenta hasta que le
 * confirmamos, y un reintento no puede fiar ni abonar dos veces.
 */
const Customer = require('../Models/Customer');
const CreditoMovimiento = require('../Models/CreditoMovimiento');

/**
 * Registra un cargo o un abono y mueve el saldo del cliente.
 *
 * @returns {{ duplicado: boolean, saldo: number }}
 */
async function mover({ businessId, customerId, tipo, monto, origenId, origen = 'caja', medio = '', referencia = '', usuario = '', nota = '', fecha }) {
  if (!['cargo', 'abono'].includes(tipo)) throw new Error('Tipo de movimiento inválido');
  const valor = Math.round(Number(monto) || 0);
  if (valor <= 0) throw new Error('Monto inválido');

  const ya = await CreditoMovimiento.findOne({ businessId, origenId }).select('saldoDespues').lean();
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
  ).select('credito').lean();
  if (!cliente) throw new Error('Cliente no encontrado');

  try {
    await CreditoMovimiento.create({
      businessId, customerId, tipo, monto: valor, origenId, origen, medio, referencia, usuario, nota,
      saldoDespues: cliente.credito?.saldo || 0,
      fecha: fecha ? new Date(fecha) : new Date(),
    });
  } catch (e) {
    /* Dos reintentos simultáneos: el segundo choca contra el índice único.
       Se deshace su movimiento del saldo y se responde como duplicado. */
    if (e?.code === 11000) {
      await Customer.updateOne({ _id: customerId, businessId }, { $inc: { 'credito.saldo': -delta } });
      return { duplicado: true, saldo: (cliente.credito?.saldo || 0) - delta };
    }
    throw e;
  }
  return { duplicado: false, saldo: cliente.credito?.saldo || 0 };
}

/** El cliente de una venta o abono de la caja: por id si es de la nube, si no por teléfono. */
async function clienteDeLaCaja(businessId, { clienteId, telefono }) {
  const mongoose = require('mongoose');
  if (clienteId && mongoose.isValidObjectId(clienteId)) {
    const c = await Customer.findOne({ _id: clienteId, businessId }).select('_id name phone').lean();
    if (c) return c;
  }
  const tel = String(telefono || '').trim();
  if (tel) return Customer.findOne({ businessId, phone: tel }).select('_id name phone').lean();
  return null;
}

module.exports = { mover, clienteDeLaCaja };
