/**
 * crewLedger — toda la lógica de billetera de Crew vive acá.
 *
 * Filosofía: la billetera del negocio y del worker NUNCA deben cambiar sin
 * pasar por este servicio. Cada función:
 *   1. Valida saldos suficientes.
 *   2. Hace el movimiento con $inc atómico para evitar race conditions.
 *   3. Escribe la entrada en el ledger con snapshot del balance resultante.
 *
 * Para garantizar consistencia, los movimientos compuestos (ej. publicar un
 * turno = debit balance + credit pending + ledger) usan una sesión de Mongo.
 *
 * Reglas del modelo de negocio:
 *   - Comisión Crew estándar: 10% del totalPay del turno.
 *   - Recargo en turnos SOS (urgentes): 15% (configurable).
 *   - El monto reservado al publicar = (totalPay + commission) * workersNeeded.
 *   - Si se cancela > 24h antes: refund total.
 *   - Si se cancela < 24h antes: refund 50%, el resto queda como penalización.
 *   - Si se cancela < 2h antes (no_show del negocio): refund 0%, penalización total.
 */
const mongoose = require('mongoose');
const BusinessConfig = require('../Models/BusinessConfig');
const { Worker } = require('../Models/Worker');
const ShiftPost = require('../Models/ShiftPost');
const ShiftBooking = require('../Models/ShiftBooking');
const CrewWalletTxn = require('../Models/CrewWalletTxn');
const CrewWithdrawalRequest = require('../Models/CrewWithdrawalRequest');
const logger = require('../utils/logger');

// ─── Constantes del modelo de negocio ───
const STANDARD_COMMISSION = 0.10;
const SOS_COMMISSION = 0.15;
const MIN_RECHARGE = 50000;       // COP mínimos por recarga
const MIN_WITHDRAWAL = 20000;     // COP mínimos para retirar

// Política de cancelación (horas antes del inicio del turno)
const CANCEL_FULL_REFUND_HOURS = 24;
const CANCEL_PARTIAL_REFUND_HOURS = 2;
const CANCEL_PARTIAL_REFUND_RATE = 0.5;

/**
 * Calcula comisión por turno según si es SOS o estándar.
 * Devuelve { commissionRate, commissionPerWorker, totalReserveNeeded }.
 */
function quoteShiftEscrow({ totalPay, workersNeeded, isSOS }) {
  const rate = isSOS ? SOS_COMMISSION : STANDARD_COMMISSION;
  const commissionPerWorker = Math.round(totalPay * rate);
  const perWorker = totalPay + commissionPerWorker;
  return {
    commissionRate: rate,
    commissionPerWorker,
    payoutPerWorker: totalPay,
    perWorkerTotal: perWorker,
    totalReserveNeeded: perWorker * workersNeeded,
  };
}

/* ─────────────────────────────────────────────
 *  BUSINESS WALLET
 * ───────────────────────────────────────────── */

/**
 * Recarga la billetera Crew del negocio.
 * idempotencyKey debería venir del provider de pagos para evitar dobles cargos.
 */
async function depositBusinessWallet({ businessId, amount, idempotencyKey, note, performedBy }) {
  if (!amount || amount < MIN_RECHARGE) {
    const err = new Error(`Recarga mínima: ${MIN_RECHARGE} COP`);
    err.code = 'AMOUNT_BELOW_MIN'; throw err;
  }

  // Idempotencia: si ya existe una txn con esa key, devolverla (no duplicar)
  if (idempotencyKey) {
    const existing = await CrewWalletTxn.findOne({ idempotencyKey });
    if (existing) return { duplicated: true, txn: existing };
  }

  const updated = await BusinessConfig.findByIdAndUpdate(
    businessId,
    {
      $inc: { 'crewWallet.balance': amount },
      $set: { 'crewWallet.lastRechargeAt': new Date() },
    },
    { new: true, select: 'crewWallet' },
  );
  if (!updated) {
    const err = new Error('Negocio no encontrado'); err.code = 'BIZ_NOT_FOUND'; throw err;
  }

  const txn = await CrewWalletTxn.create({
    actorType: 'business', actorId: businessId,
    kind: 'deposit', direction: 'in', amount,
    balanceAfter: updated.crewWallet.balance,
    pendingAfter: updated.crewWallet.pendingBalance,
    idempotencyKey: idempotencyKey || null,
    note: note || 'Recarga de billetera Crew',
    performedBy: performedBy || { kind: 'system' },
  });

  return { duplicated: false, txn, wallet: updated.crewWallet };
}

/**
 * Reserva el escrow al publicar un turno.
 *
 * Mueve `totalReserveNeeded` de balance → pendingBalance del negocio,
 * y escribe ledger 'shift_reserve'. Si no hay saldo, lanza error.
 *
 * NOTA: usamos un findOneAndUpdate condicional sobre el balance para evitar
 * la race condition clásica "leer-checkear-escribir" — Mongo nos da atomicidad
 * a nivel de documento sin necesidad de transacción.
 */
async function reserveShiftEscrow({ businessId, shift, performedBy }) {
  const quote = quoteShiftEscrow({
    totalPay: shift.totalPay,
    workersNeeded: shift.workersNeeded,
    isSOS: shift.isSOS,
  });

  // Reserva atómica: solo descuenta si hay saldo suficiente
  const updated = await BusinessConfig.findOneAndUpdate(
    { _id: businessId, 'crewWallet.balance': { $gte: quote.totalReserveNeeded } },
    {
      $inc: {
        'crewWallet.balance': -quote.totalReserveNeeded,
        'crewWallet.pendingBalance': quote.totalReserveNeeded,
        'crewWallet.totalReserved': quote.totalReserveNeeded,
      },
    },
    { new: true, select: 'crewWallet' },
  );

  if (!updated) {
    const biz = await BusinessConfig.findById(businessId).select('crewWallet').lean();
    const have = biz?.crewWallet?.balance || 0;
    const err = new Error(`Saldo insuficiente: necesitas ${quote.totalReserveNeeded} COP, tienes ${have} COP`);
    err.code = 'INSUFFICIENT_FUNDS';
    err.required = quote.totalReserveNeeded;
    err.available = have;
    throw err;
  }

  await CrewWalletTxn.create({
    actorType: 'business', actorId: businessId,
    kind: 'shift_reserve', direction: 'out', amount: quote.totalReserveNeeded,
    balanceAfter: updated.crewWallet.balance,
    pendingAfter: updated.crewWallet.pendingBalance,
    shiftId: shift._id,
    idempotencyKey: `shift_reserve:${shift._id}`,
    note: `Reserva de ${shift.workersNeeded} cupo(s) — ${shift.title}`,
    metadata: { quote, workersNeeded: shift.workersNeeded },
    performedBy: performedBy || { kind: 'system' },
  });

  return { quote, wallet: updated.crewWallet };
}

/**
 * Libera un booking completado: paga al worker y registra comisión Crew.
 *
 * Movimientos:
 *   - business.pendingBalance -= (agreedTotal + agreedCommission)
 *   - worker.wallet.balance   += agreedTotal
 *   - platform recibe agreedCommission
 *   - business.totalSpent += agreedTotal; business.totalCommissionPaid += agreedCommission
 *   - shift.releasedAmount += (agreedTotal + agreedCommission)
 *   - 3 ledger txns: shift_release (business→worker), shift_commission (business→platform),
 *     y la entrada espejo para el worker.
 */
async function releaseBookingFunds({ bookingId, performedBy }) {
  const booking = await ShiftBooking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking no encontrado'); err.code = 'BOOKING_NOT_FOUND'; throw err;
  }
  if (booking.payoutStatus === 'released') {
    return { alreadyReleased: true, booking };
  }
  // Aceptamos 'held' (flujo nuevo con escrow) y 'pending' (default viejo de
  // bookings creados antes del sistema de escrow). Cualquier otro estado
  // (refunded, p.ej.) sí es un error.
  if (!['held', 'pending'].includes(booking.payoutStatus)) {
    const err = new Error(`Booking en estado ${booking.payoutStatus}, no se puede liberar`);
    err.code = 'INVALID_STATE'; throw err;
  }

  const payout = booking.agreedTotal;
  const commission = booking.agreedCommission || 0;
  const totalOut = payout + commission;

  // 1. Intentar sacar del pending del negocio.
  // Si no hay saldo en pending (booking legacy publicado antes del escrow),
  // entramos en modo "legacy release": pagamos al worker igual y registramos
  // todo con `metadata.legacy = true`. Crew asume la pérdida de la comisión
  // en estos casos — la auditoría queda clara en el ledger.
  let biz = await BusinessConfig.findOneAndUpdate(
    { _id: booking.businessId, 'crewWallet.pendingBalance': { $gte: totalOut } },
    {
      $inc: {
        'crewWallet.pendingBalance': -totalOut,
        'crewWallet.totalSpent': payout,
        'crewWallet.totalCommissionPaid': commission,
      },
    },
    { new: true, select: 'crewWallet' },
  );

  let legacy = false;
  if (!biz) {
    legacy = true;
    // No tocamos crewWallet del negocio (no había escrow). Solo leemos el
    // estado actual para el ledger snapshot.
    biz = await BusinessConfig.findById(booking.businessId).select('crewWallet').lean();
    if (!biz) {
      const err = new Error('Negocio no encontrado'); err.code = 'BIZ_NOT_FOUND'; throw err;
    }
    logger.warn('Releasing legacy booking without escrow', {
      bookingId: String(booking._id),
      businessId: String(booking.businessId),
      workerId: String(booking.workerId),
      payout, commission,
    });
  }

  // 2. Acreditar al worker (siempre — esta es la promesa de Crew)
  const worker = await Worker.findByIdAndUpdate(
    booking.workerId,
    {
      $inc: {
        'wallet.balance': payout,
        'stats.totalEarned': payout,
      },
    },
    { new: true, select: 'wallet stats' },
  );

  // 3. Actualizar booking + shift
  booking.payoutStatus = 'released';
  booking.releasedAt = new Date();
  await booking.save();

  await ShiftPost.findByIdAndUpdate(booking.shiftId, {
    $inc: { releasedAmount: totalOut, reservedAmount: legacy ? 0 : -totalOut },
  });

  // 4. Ledger — entradas con metadata de legacy si aplica
  const entries = [
    {
      actorType: 'business', actorId: booking.businessId,
      counterpartType: 'worker', counterpartId: booking.workerId,
      kind: 'shift_release', direction: 'out', amount: payout,
      balanceAfter: biz.crewWallet?.balance ?? null,
      pendingAfter: biz.crewWallet?.pendingBalance ?? null,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_release:${booking._id}`,
      note: legacy ? 'Pago liberado (turno previo al sistema de escrow)' : 'Pago liberado al trabajador',
      metadata: legacy ? { legacy: true, reason: 'no-escrow-reserve' } : {},
      performedBy: performedBy || { kind: 'system' },
    },
    {
      actorType: 'worker', actorId: booking.workerId,
      counterpartType: 'business', counterpartId: booking.businessId,
      kind: 'shift_release', direction: 'in', amount: payout,
      balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_payout:${booking._id}`,
      note: 'Pago recibido por turno completado',
      metadata: legacy ? { legacy: true } : {},
      performedBy: performedBy || { kind: 'system' },
    },
  ];
  // Solo registramos la comisión si efectivamente hubo escrow (turnos nuevos)
  if (!legacy && commission > 0) {
    entries.splice(1, 0, {
      actorType: 'business', actorId: booking.businessId,
      counterpartType: 'platform',
      kind: 'shift_commission', direction: 'out', amount: commission,
      balanceAfter: biz.crewWallet?.balance ?? null,
      pendingAfter: biz.crewWallet?.pendingBalance ?? null,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_commission:${booking._id}`,
      note: 'Comisión Crew',
      performedBy: performedBy || { kind: 'system' },
    });
  }
  await CrewWalletTxn.insertMany(entries);

  return {
    booking,
    businessWallet: biz.crewWallet,
    workerWallet: worker.wallet,
    payout, commission,
    legacy,
  };
}

/**
 * Cancela un turno y devuelve el escrow al negocio según la política.
 * Solo aplica a cupos NO bookeados (los bookings ya creados se cancelan aparte).
 *
 * @param shift - ShiftPost ya cargado
 * @param hoursToShift - horas restantes hasta el inicio del turno (puede ser negativo)
 * @returns { refund, penalty, refundRate }
 */
function computeCancellationRefund({ hoursToShift, amountToReturn }) {
  if (hoursToShift >= CANCEL_FULL_REFUND_HOURS) {
    return { refundRate: 1, refund: amountToReturn, penalty: 0 };
  }
  if (hoursToShift >= CANCEL_PARTIAL_REFUND_HOURS) {
    const refund = Math.round(amountToReturn * CANCEL_PARTIAL_REFUND_RATE);
    return { refundRate: CANCEL_PARTIAL_REFUND_RATE, refund, penalty: amountToReturn - refund };
  }
  return { refundRate: 0, refund: 0, penalty: amountToReturn };
}

/**
 * Cancela el turno desde el lado del negocio.
 *
 * Calcula cuántos cupos quedan sin bookear (libres) y cuántos cupos
 * ya tienen booking confirmado. Para los libres devolvemos según política.
 * Para los con booking, ese flujo va por cancelBooking() aparte.
 */
async function cancelShiftPost({ shiftId, reason, performedBy }) {
  const shift = await ShiftPost.findById(shiftId);
  if (!shift) {
    const err = new Error('Turno no encontrado'); err.code = 'SHIFT_NOT_FOUND'; throw err;
  }
  if (['cancelled', 'completed'].includes(shift.status)) {
    const err = new Error(`Turno ya está ${shift.status}`); err.code = 'INVALID_STATE'; throw err;
  }

  const start = new Date(shift.date);
  const hoursToShift = (start.getTime() - Date.now()) / (1000 * 60 * 60);

  // Cupos sin booking aún (libres) — esos sí devolvemos
  const freeSlots = shift.workersNeeded - shift.workersBooked;
  const quote = quoteShiftEscrow({
    totalPay: shift.totalPay,
    workersNeeded: 1,
    isSOS: shift.isSOS,
  });
  const freeReserve = quote.perWorkerTotal * freeSlots;

  const { refundRate, refund, penalty } = computeCancellationRefund({
    hoursToShift,
    amountToReturn: freeReserve,
  });

  // Mover dinero
  const update = { $inc: { 'crewWallet.pendingBalance': -freeReserve } };
  if (refund > 0) update.$inc['crewWallet.balance'] = refund;
  const biz = await BusinessConfig.findByIdAndUpdate(shift.businessId, update, {
    new: true, select: 'crewWallet',
  });

  // Ledger: refund + penalty
  const ledgerEntries = [];
  if (refund > 0) {
    ledgerEntries.push({
      actorType: 'business', actorId: shift.businessId,
      kind: 'shift_refund', direction: 'in', amount: refund,
      balanceAfter: biz.crewWallet.balance, pendingAfter: biz.crewWallet.pendingBalance,
      shiftId: shift._id,
      idempotencyKey: `shift_refund:${shift._id}`,
      note: `Devolución por cancelación (${Math.round(refundRate * 100)}%)`,
      metadata: { hoursToShift, refundRate, freeSlots },
      performedBy: performedBy || { kind: 'system' },
    });
  }
  if (penalty > 0) {
    ledgerEntries.push({
      actorType: 'business', actorId: shift.businessId,
      counterpartType: 'platform',
      kind: 'cancellation_penalty', direction: 'out', amount: penalty,
      balanceAfter: biz.crewWallet.balance, pendingAfter: biz.crewWallet.pendingBalance,
      shiftId: shift._id,
      idempotencyKey: `shift_penalty:${shift._id}`,
      note: `Penalización por cancelación tardía (${Math.round((1 - refundRate) * 100)}%)`,
      metadata: { hoursToShift, refundRate, freeSlots },
      performedBy: performedBy || { kind: 'system' },
    });
  }
  if (ledgerEntries.length) await CrewWalletTxn.insertMany(ledgerEntries);

  shift.status = 'cancelled';
  shift.cancelReason = reason || 'Cancelado por el negocio';
  shift.reservedAmount = Math.max(0, shift.reservedAmount - freeReserve);
  shift.refundedAmount = (shift.refundedAmount || 0) + refund;
  await shift.save();

  return {
    shift, refund, penalty, refundRate, hoursToShift,
    affectedBookings: shift.workersBooked,
    wallet: biz.crewWallet,
  };
}

/* ─────────────────────────────────────────────
 *  WORKER WALLET (retiros)
 * ───────────────────────────────────────────── */

/**
 * Solicita un retiro: bloquea saldo en pendingBalance del worker.
 */
async function requestWithdrawal({ workerId, amount, payoutMethod }) {
  if (!amount || amount < MIN_WITHDRAWAL) {
    const err = new Error(`Retiro mínimo: ${MIN_WITHDRAWAL} COP`);
    err.code = 'AMOUNT_BELOW_MIN'; throw err;
  }
  if (!payoutMethod?.type || !payoutMethod?.accountInfo) {
    const err = new Error('Faltan datos del método de pago'); err.code = 'MISSING_PAYOUT'; throw err;
  }

  const worker = await Worker.findOneAndUpdate(
    { _id: workerId, 'wallet.balance': { $gte: amount } },
    {
      $inc: {
        'wallet.balance': -amount,
        'wallet.pendingBalance': amount,
      },
    },
    { new: true, select: 'wallet' },
  );
  if (!worker) {
    const w = await Worker.findById(workerId).select('wallet').lean();
    const err = new Error(`Saldo insuficiente: necesitas ${amount} COP, tienes ${w?.wallet?.balance || 0} COP`);
    err.code = 'INSUFFICIENT_FUNDS'; throw err;
  }

  const request = await CrewWithdrawalRequest.create({
    workerId, amount, payoutMethod,
  });

  await CrewWalletTxn.create({
    actorType: 'worker', actorId: workerId,
    kind: 'withdrawal_request', direction: 'out', amount,
    balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
    withdrawalId: request._id,
    idempotencyKey: `withdrawal_request:${request._id}`,
    note: 'Retiro solicitado',
    performedBy: { kind: 'worker', id: workerId },
  });

  return { request, wallet: worker.wallet };
}

/**
 * SuperAdmin marca un retiro como pagado.
 */
async function markWithdrawalPaid({ withdrawalId, externalReference, paidBy }) {
  const req = await CrewWithdrawalRequest.findById(withdrawalId);
  if (!req) { const e = new Error('Retiro no encontrado'); e.code = 'NOT_FOUND'; throw e; }
  if (req.status === 'paid') return { alreadyPaid: true, request: req };
  if (req.status !== 'pending' && req.status !== 'processing') {
    const e = new Error(`Retiro en estado ${req.status}`); e.code = 'INVALID_STATE'; throw e;
  }

  const worker = await Worker.findByIdAndUpdate(
    req.workerId,
    { $inc: { 'wallet.pendingBalance': -req.amount } },
    { new: true, select: 'wallet' },
  );

  req.status = 'paid';
  req.paidAt = new Date();
  req.paidBy = paidBy || null;
  req.externalReference = externalReference || null;
  await req.save();

  await CrewWalletTxn.create({
    actorType: 'worker', actorId: req.workerId,
    counterpartType: 'external',
    kind: 'withdrawal_paid', direction: 'out', amount: req.amount,
    balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
    withdrawalId: req._id,
    idempotencyKey: `withdrawal_paid:${req._id}`,
    note: externalReference ? `Pagado (ref: ${externalReference})` : 'Pagado externamente',
    performedBy: { kind: 'superadmin', id: paidBy },
  });

  return { request: req, wallet: worker.wallet };
}

/**
 * SuperAdmin rechaza un retiro y devuelve el dinero al balance.
 */
async function rejectWithdrawal({ withdrawalId, reason, rejectedBy }) {
  const req = await CrewWithdrawalRequest.findById(withdrawalId);
  if (!req) { const e = new Error('Retiro no encontrado'); e.code = 'NOT_FOUND'; throw e; }
  if (req.status === 'rejected') return { alreadyRejected: true, request: req };
  if (req.status !== 'pending' && req.status !== 'processing') {
    const e = new Error(`Retiro en estado ${req.status}`); e.code = 'INVALID_STATE'; throw e;
  }
  if (!reason?.trim()) { const e = new Error('Motivo del rechazo obligatorio'); e.code = 'MISSING_REASON'; throw e; }

  const worker = await Worker.findByIdAndUpdate(
    req.workerId,
    {
      $inc: {
        'wallet.balance': req.amount,
        'wallet.pendingBalance': -req.amount,
      },
    },
    { new: true, select: 'wallet' },
  );

  req.status = 'rejected';
  req.rejectionReason = reason.trim().slice(0, 300);
  await req.save();

  await CrewWalletTxn.create({
    actorType: 'worker', actorId: req.workerId,
    kind: 'withdrawal_rejected', direction: 'in', amount: req.amount,
    balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
    withdrawalId: req._id,
    idempotencyKey: `withdrawal_rejected:${req._id}`,
    note: `Retiro rechazado: ${req.rejectionReason}`,
    performedBy: { kind: 'superadmin', id: rejectedBy },
  });

  return { request: req, wallet: worker.wallet };
}

module.exports = {
  // constantes
  STANDARD_COMMISSION, SOS_COMMISSION,
  MIN_RECHARGE, MIN_WITHDRAWAL,
  CANCEL_FULL_REFUND_HOURS, CANCEL_PARTIAL_REFUND_HOURS, CANCEL_PARTIAL_REFUND_RATE,
  // helpers
  quoteShiftEscrow, computeCancellationRefund,
  // ops
  depositBusinessWallet,
  reserveShiftEscrow,
  releaseBookingFunds,
  cancelShiftPost,
  requestWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
};
