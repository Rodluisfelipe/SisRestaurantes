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
const BusinessConfig = require('../Models/BusinessConfig');
const { Worker } = require('../Models/Worker');
const ShiftPost = require('../Models/ShiftPost');
const ShiftBooking = require('../Models/ShiftBooking');
const CrewWalletTxn = require('../Models/CrewWalletTxn');
const CrewWithdrawalRequest = require('../Models/CrewWithdrawalRequest');
const CrewEmployer = require('../Models/CrewEmployer');
const logger = require('../utils/logger');

/* ─────────────────────────────────────────────
 *  Owner resolver — abstrae si el dueño del wallet es BusinessConfig o CrewEmployer.
 *  Toda la lógica de plata pasa por acá, así nunca repetimos "if business / else employer".
 * ───────────────────────────────────────────── */

/**
 * Devuelve el Model que tiene crewWallet para un ownerType dado.
 */
function ownerModel(ownerType) {
  if (ownerType === 'business') return BusinessConfig;
  if (ownerType === 'crew_employer') return CrewEmployer;
  throw new Error(`ownerType inválido: ${ownerType}`);
}

/**
 * Normaliza inputs heredados a { ownerType, ownerId }.
 * Acepta:
 *   - { ownerType, ownerId }
 *   - { businessId }  → { ownerType: 'business', ownerId: businessId }
 *   - { employerId }  → { ownerType: 'crew_employer', ownerId: employerId }
 */
function normalizeOwner(input) {
  if (input?.ownerType && input?.ownerId) {
    return { ownerType: input.ownerType, ownerId: input.ownerId };
  }
  if (input?.businessId) return { ownerType: 'business', ownerId: input.businessId };
  if (input?.employerId) return { ownerType: 'crew_employer', ownerId: input.employerId };
  throw new Error('Falta owner (ownerType+ownerId o businessId o employerId)');
}

/**
 * Resuelve el owner de un ShiftPost o ShiftBooking — para los ledger entries
 * generados a partir de un shift/booking sin que el caller tenga que saber el tipo.
 */
function ownerFromDoc(doc) {
  if (!doc) throw new Error('Doc sin owner');
  if (doc.ownerType === 'crew_employer' || doc.employerId) {
    return { ownerType: 'crew_employer', ownerId: doc.employerId };
  }
  return { ownerType: 'business', ownerId: doc.businessId };
}

// ─── Constantes del modelo de negocio ───
const STANDARD_COMMISSION = 0.10;
const SOS_COMMISSION = 0.15;
const MIN_RECHARGE = 50000;       // COP mínimos por recarga
const MIN_WITHDRAWAL = 20000;     // COP mínimos para retirar
const VACANCY_POST_FEE = 10000;   // COP fijos por publicar una vacante

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
  // Redondeo round-half-up para que la comisión nunca quede por debajo
  // del cálculo nominal (preferimos que Crew gane 1 peso por shift, no que pierda).
  const payoutPerWorker = Math.round(totalPay);
  const commissionPerWorker = Math.round(payoutPerWorker * rate);
  const perWorker = payoutPerWorker + commissionPerWorker;
  const wn = Number(workersNeeded) || 1;
  return {
    commissionRate: rate,
    commissionPerWorker,
    payoutPerWorker,
    perWorkerTotal: perWorker,
    totalReserveNeeded: perWorker * wn,
  };
}

/* ─────────────────────────────────────────────
 *  BUSINESS WALLET
 * ───────────────────────────────────────────── */

/**
 * Recarga la billetera Crew del negocio.
 * idempotencyKey debería venir del provider de pagos para evitar dobles cargos.
 */
async function depositOwnerWallet(input) {
  const { ownerType, ownerId } = normalizeOwner(input);
  const { amount, idempotencyKey, note, performedBy } = input;

  if (!amount || amount < MIN_RECHARGE) {
    const err = new Error(`Recarga mínima: ${MIN_RECHARGE} COP`);
    err.code = 'AMOUNT_BELOW_MIN'; throw err;
  }

  const Model = ownerModel(ownerType);

  // Idempotencia robusta: insertamos PRIMERO el ledger (con índice único sparse
  // en idempotencyKey). Dos requests simultáneos con la misma key generarán
  // duplicate-key en la segunda — solo el ganador hace el $inc al wallet.
  let txn;
  if (idempotencyKey) {
    try {
      txn = await CrewWalletTxn.create({
        actorType: ownerType, actorId: ownerId,
        kind: 'deposit', direction: 'in', amount,
        balanceAfter: null, pendingAfter: null,
        idempotencyKey,
        note: note || 'Recarga de billetera Crew',
        performedBy: performedBy || { kind: 'system' },
      });
    } catch (e) {
      if (e.code === 11000) {
        const existing = await CrewWalletTxn.findOne({ idempotencyKey });
        return { duplicated: true, txn: existing };
      }
      throw e;
    }
  } else {
    txn = await CrewWalletTxn.create({
      actorType: ownerType, actorId: ownerId,
      kind: 'deposit', direction: 'in', amount,
      balanceAfter: null, pendingAfter: null,
      idempotencyKey: null,
      note: note || 'Recarga de billetera Crew',
      performedBy: performedBy || { kind: 'system' },
    });
  }

  const updated = await Model.findByIdAndUpdate(
    ownerId,
    {
      $inc: { 'crewWallet.balance': amount },
      $set: { 'crewWallet.lastRechargeAt': new Date() },
    },
    { new: true, select: 'crewWallet' },
  );
  if (!updated) {
    // Rollback del ledger si el owner no existe.
    await CrewWalletTxn.deleteOne({ _id: txn._id }).catch(() => {});
    const err = new Error(`${ownerType === 'business' ? 'Negocio' : 'Empleador'} no encontrado`);
    err.code = 'OWNER_NOT_FOUND'; throw err;
  }

  txn.balanceAfter = updated.crewWallet.balance;
  txn.pendingAfter = updated.crewWallet.pendingBalance;
  await txn.save();

  return { duplicated: false, txn, wallet: updated.crewWallet };
}

// Alias retrocompat: el código viejo llama depositBusinessWallet({ businessId }).
const depositBusinessWallet = depositOwnerWallet;

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
async function reserveShiftEscrow({ shift, performedBy, ...legacyOwner }) {
  // Resuelve owner del shift. Si el caller pasó businessId explícito (path viejo)
  // y el shift NO tiene businessId, lo seteamos en el shift para consistencia.
  let owner;
  if (shift.ownerType || shift.businessId || shift.employerId) {
    owner = ownerFromDoc(shift);
  } else {
    owner = normalizeOwner(legacyOwner);
  }

  const quote = quoteShiftEscrow({
    totalPay: shift.totalPay,
    workersNeeded: shift.workersNeeded,
    isSOS: shift.isSOS,
  });

  const Model = ownerModel(owner.ownerType);
  const updated = await Model.findOneAndUpdate(
    { _id: owner.ownerId, 'crewWallet.balance': { $gte: quote.totalReserveNeeded } },
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
    const current = await Model.findById(owner.ownerId).select('crewWallet').lean();
    const have = current?.crewWallet?.balance || 0;
    const err = new Error(`Saldo insuficiente: necesitas ${quote.totalReserveNeeded} COP, tienes ${have} COP`);
    err.code = 'INSUFFICIENT_FUNDS';
    err.required = quote.totalReserveNeeded;
    err.available = have;
    throw err;
  }

  /* Si el asiento no se escribe, se deshace la reserva. El caller borra el
     turno al recibir el error, así que sin esta vuelta atrás la plata quedaba
     encerrada en pendingBalance sin turno que la justificara. */
  try {
    await CrewWalletTxn.create({
      actorType: owner.ownerType, actorId: owner.ownerId,
      kind: 'shift_reserve', direction: 'out', amount: quote.totalReserveNeeded,
      balanceAfter: updated.crewWallet.balance,
      pendingAfter: updated.crewWallet.pendingBalance,
      shiftId: shift._id,
      idempotencyKey: `shift_reserve:${shift._id}`,
      note: `Reserva de ${shift.workersNeeded} cupo(s) — ${shift.title}`,
      metadata: { quote, workersNeeded: shift.workersNeeded },
      performedBy: performedBy || { kind: 'system' },
    });
  } catch (e) {
    await Model.findByIdAndUpdate(owner.ownerId, {
      $inc: {
        'crewWallet.balance': quote.totalReserveNeeded,
        'crewWallet.pendingBalance': -quote.totalReserveNeeded,
        'crewWallet.totalReserved': -quote.totalReserveNeeded,
      },
    }).catch(() => {});
    logger.error('No se pudo registrar la reserva del turno — reserva revertida', {
      ownerType: owner.ownerType, ownerId: String(owner.ownerId),
      shiftId: String(shift._id), amount: quote.totalReserveNeeded, error: e.message,
    });
    throw e;
  }

  return { quote, wallet: updated.crewWallet, owner };
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
  // Transición atómica de `payoutStatus`: `held|pending → released`.
  // Solo el cliente que gana esta carrera continúa; los demás reciben
  // `alreadyReleased`. Esto bloquea la race "complete + backfill simultáneos"
  // que antes pagaba al worker dos veces.
  const booking = await ShiftBooking.findOneAndUpdate(
    { _id: bookingId, payoutStatus: { $in: ['held', 'pending'] } },
    { $set: { payoutStatus: 'released', releasedAt: new Date() } },
    { new: true },
  );

  if (!booking) {
    // No matcheó: o no existe, o ya estaba en `released`/otro estado.
    const existing = await ShiftBooking.findById(bookingId).lean();
    if (!existing) {
      const err = new Error('Booking no encontrado'); err.code = 'BOOKING_NOT_FOUND'; throw err;
    }
    if (existing.payoutStatus === 'released') {
      return { alreadyReleased: true, booking: existing };
    }
    const err = new Error(`Booking en estado ${existing.payoutStatus}, no se puede liberar`);
    err.code = 'INVALID_STATE'; throw err;
  }

  const payout = booking.agreedTotal;
  const commission = booking.agreedCommission || 0;
  const totalOut = payout + commission;

  // Resolver el owner del booking (puede ser business legacy o crew_employer nuevo).
  const owner = ownerFromDoc(booking);
  const Model = ownerModel(owner.ownerType);

  // 1. Intentar sacar del pending del owner.
  // Si no hay saldo en pending (booking legacy publicado antes del escrow),
  // entramos en modo "legacy release": pagamos al worker igual y registramos
  // todo con `metadata.legacy = true`. Crew asume la pérdida de la comisión.
  let ownerDoc = await Model.findOneAndUpdate(
    { _id: owner.ownerId, 'crewWallet.pendingBalance': { $gte: totalOut } },
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
  if (!ownerDoc) {
    legacy = true;
    ownerDoc = await Model.findById(owner.ownerId).select('crewWallet').lean();
    if (!ownerDoc) {
      const err = new Error(`${owner.ownerType === 'business' ? 'Negocio' : 'Empleador'} no encontrado`);
      err.code = 'OWNER_NOT_FOUND'; throw err;
    }
    logger.warn('Releasing legacy booking without escrow', {
      bookingId: String(booking._id),
      ownerType: owner.ownerType,
      ownerId: String(owner.ownerId),
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

  // 3. Actualizar shift (payoutStatus del booking ya quedó en released en el
  // findOneAndUpdate inicial — no lo tocamos de nuevo)
  await ShiftPost.findByIdAndUpdate(booking.shiftId, {
    $inc: { releasedAmount: totalOut, reservedAmount: legacy ? 0 : -totalOut },
  });

  // 4. Ledger — entradas con metadata de legacy si aplica
  const entries = [
    {
      actorType: owner.ownerType, actorId: owner.ownerId,
      counterpartType: 'worker', counterpartId: booking.workerId,
      kind: 'shift_release', direction: 'out', amount: payout,
      balanceAfter: ownerDoc.crewWallet?.balance ?? null,
      pendingAfter: ownerDoc.crewWallet?.pendingBalance ?? null,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_release:${booking._id}`,
      note: legacy ? 'Pago liberado (turno previo al sistema de escrow)' : 'Pago liberado al trabajador',
      metadata: legacy ? { legacy: true, reason: 'no-escrow-reserve' } : {},
      performedBy: performedBy || { kind: 'system' },
    },
    {
      actorType: 'worker', actorId: booking.workerId,
      counterpartType: owner.ownerType, counterpartId: owner.ownerId,
      kind: 'shift_release', direction: 'in', amount: payout,
      balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_payout:${booking._id}`,
      note: 'Pago recibido por turno completado',
      metadata: legacy ? { legacy: true } : {},
      performedBy: performedBy || { kind: 'system' },
    },
  ];
  if (!legacy && commission > 0) {
    entries.splice(1, 0, {
      actorType: owner.ownerType, actorId: owner.ownerId,
      counterpartType: 'platform',
      kind: 'shift_commission', direction: 'out', amount: commission,
      balanceAfter: ownerDoc.crewWallet?.balance ?? null,
      pendingAfter: ownerDoc.crewWallet?.pendingBalance ?? null,
      shiftId: booking.shiftId, bookingId: booking._id,
      idempotencyKey: `shift_commission:${booking._id}`,
      note: 'Comisión Crew',
      performedBy: performedBy || { kind: 'system' },
    });
  }
  /* Acá no se revierte: el trabajador ya tiene la plata y el booking ya quedó
     en `released`. Fallar el llamado haría creer que el pago no ocurrió. Se
     registra el fallo con todo lo necesario para reponer el asiento a mano. */
  try {
    await CrewWalletTxn.insertMany(entries);
  } catch (e) {
    logger.error('PAGO SIN ASIENTO — el trabajador cobró pero el ledger no lo registró', {
      bookingId: String(booking._id), workerId: String(booking.workerId),
      ownerType: owner.ownerType, ownerId: String(owner.ownerId),
      payout, commission, error: e.message,
    });
  }

  return {
    booking,
    businessWallet: ownerDoc.crewWallet, // mantenemos clave por retrocompat
    ownerWallet: ownerDoc.crewWallet,
    owner,
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
  // Transición atómica: solo el primer caller que matchea pasa el shift a cancelled.
  // Esto evita el caso "dos cancelaciones simultáneas" que liberarían escrow dos veces.
  const shift = await ShiftPost.findOneAndUpdate(
    { _id: shiftId, status: { $nin: ['cancelled', 'completed'] } },
    { $set: { status: 'cancelled', cancelReason: reason || 'Cancelado por el negocio' } },
    { new: true },
  );
  if (!shift) {
    const existing = await ShiftPost.findById(shiftId).lean();
    if (!existing) { const err = new Error('Turno no encontrado'); err.code = 'SHIFT_NOT_FOUND'; throw err; }
    const err = new Error(`Turno ya está ${existing.status}`); err.code = 'INVALID_STATE'; throw err;
  }

  const start = new Date(shift.date);
  const hoursToShift = (start.getTime() - Date.now()) / (1000 * 60 * 60);

  // Cupos libres (sin booking) — los devolvemos según política.
  const freeSlots = Math.max(0, shift.workersNeeded - shift.workersBooked);
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

  const owner = ownerFromDoc(shift);
  const OwnerModel = ownerModel(owner.ownerType);
  let ownerDoc = await OwnerModel.findById(owner.ownerId).select('crewWallet').lean();
  if (!ownerDoc) {
    const err = new Error(`${owner.ownerType === 'business' ? 'Negocio' : 'Empleador'} no encontrado`);
    err.code = 'OWNER_NOT_FOUND'; throw err;
  }

  // 1) Mover dinero de los cupos libres
  if (freeReserve > 0) {
    const update = { $inc: { 'crewWallet.pendingBalance': -freeReserve } };
    if (refund > 0) update.$inc['crewWallet.balance'] = refund;
    ownerDoc = await OwnerModel.findByIdAndUpdate(owner.ownerId, update, {
      new: true, select: 'crewWallet',
    });
  }

  const ledgerEntries = [];
  if (refund > 0) {
    ledgerEntries.push({
      actorType: owner.ownerType, actorId: owner.ownerId,
      kind: 'shift_refund', direction: 'in', amount: refund,
      balanceAfter: ownerDoc.crewWallet.balance, pendingAfter: ownerDoc.crewWallet.pendingBalance,
      shiftId: shift._id,
      idempotencyKey: `shift_refund_free:${shift._id}`,
      note: `Devolución de cupos libres (${Math.round(refundRate * 100)}%)`,
      metadata: { hoursToShift, refundRate, freeSlots, scope: 'free_slots' },
      performedBy: performedBy || { kind: 'system' },
    });
  }
  if (penalty > 0) {
    ledgerEntries.push({
      actorType: owner.ownerType, actorId: owner.ownerId,
      counterpartType: 'platform',
      kind: 'cancellation_penalty', direction: 'out', amount: penalty,
      balanceAfter: ownerDoc.crewWallet.balance, pendingAfter: ownerDoc.crewWallet.pendingBalance,
      shiftId: shift._id,
      idempotencyKey: `shift_penalty_free:${shift._id}`,
      note: `Penalización por cancelación tardía (${Math.round((1 - refundRate) * 100)}%)`,
      metadata: { hoursToShift, refundRate, freeSlots, scope: 'free_slots' },
      performedBy: performedBy || { kind: 'system' },
    });
  }

  // 2) Cancelar bookings ACTIVOS del shift y refundar/compensar:
  //    - Si la cancelación es <2h o el booking ya hizo check-in: pagamos al worker
  //      como compensación (no le robamos el día). El escrow se libera al worker.
  //    - Si la cancelación es ≥24h y el booking no hizo check-in: refund 100% al negocio.
  //    - Entre medias (2h-24h): refund parcial 50% + 50% compensa al worker.
  const activeBookings = await ShiftBooking.find({
    shiftId: shift._id,
    status: { $in: ['confirmed', 'checked_in'] },
    payoutStatus: { $in: ['held', 'pending'] },
  });

  let workerCompensations = 0;
  let bookingRefunds = 0;
  for (const bk of activeBookings) {
    const bookingTotal = (bk.agreedTotal || 0) + (bk.agreedCommission || 0);
    let toWorker = 0;
    let toBusiness = 0;
    if (bk.status === 'checked_in' || hoursToShift < CANCEL_PARTIAL_REFUND_HOURS) {
      // El worker estaba/iba con todo — le pagamos completo.
      toWorker = bk.agreedTotal || 0;
      toBusiness = 0; // perdió el escrow + comisión como penalización
    } else if (hoursToShift >= CANCEL_FULL_REFUND_HOURS) {
      toWorker = 0;
      toBusiness = bookingTotal;
    } else {
      // Partial: 50% compensa al worker, 50% refund al negocio.
      toWorker = Math.round((bk.agreedTotal || 0) * 0.5);
      toBusiness = Math.round(bookingTotal * 0.5);
    }
    workerCompensations += toWorker;
    bookingRefunds += toBusiness;

    // Marcar booking como cancelled_by_business + payoutStatus refunded/released
    await ShiftBooking.findOneAndUpdate(
      { _id: bk._id, payoutStatus: { $in: ['held', 'pending'] } },
      {
        $set: {
          status: 'cancelled_by_business',
          payoutStatus: toWorker > 0 ? 'released' : 'refunded',
          cancelledAt: new Date(),
          cancelReason: reason || 'Shift cancelado por el negocio',
          releasedAt: toWorker > 0 ? new Date() : null,
        },
      },
    );

    // Mover plata: del pending del owner → balance del owner (refund)
    // y/o → wallet.balance del worker (compensación).
    const deltaPending = -bookingTotal;
    const deltaOwnerBalance = toBusiness;
    ownerDoc = await OwnerModel.findByIdAndUpdate(
      owner.ownerId,
      { $inc: {
        'crewWallet.pendingBalance': deltaPending,
        'crewWallet.balance': deltaOwnerBalance,
      } },
      { new: true, select: 'crewWallet' },
    );
    if (toWorker > 0) {
      const w = await Worker.findByIdAndUpdate(
        bk.workerId,
        { $inc: { 'wallet.balance': toWorker, 'stats.totalEarned': toWorker } },
        { new: true, select: 'wallet' },
      );
      ledgerEntries.push({
        actorType: 'worker', actorId: bk.workerId,
        counterpartType: owner.ownerType, counterpartId: owner.ownerId,
        kind: 'shift_release', direction: 'in', amount: toWorker,
        balanceAfter: w.wallet.balance, pendingAfter: w.wallet.pendingBalance,
        shiftId: shift._id, bookingId: bk._id,
        idempotencyKey: `shift_compensation:${bk._id}`,
        note: bk.status === 'checked_in'
          ? 'Compensación por cancelación tras tu check-in'
          : 'Compensación por cancelación tardía del empleador',
        metadata: { cancelledBookingId: String(bk._id), hoursToShift },
        performedBy: performedBy || { kind: 'system' },
      });
    }
    if (toBusiness > 0) {
      ledgerEntries.push({
        actorType: owner.ownerType, actorId: owner.ownerId,
        kind: 'shift_refund', direction: 'in', amount: toBusiness,
        balanceAfter: ownerDoc.crewWallet.balance, pendingAfter: ownerDoc.crewWallet.pendingBalance,
        shiftId: shift._id, bookingId: bk._id,
        idempotencyKey: `shift_refund_booking:${bk._id}`,
        note: 'Devolución por cancelación (cupo asignado)',
        metadata: { hoursToShift },
        performedBy: performedBy || { kind: 'system' },
      });
    }
    const bookingPenalty = bookingTotal - toWorker - toBusiness;
    if (bookingPenalty > 0) {
      ledgerEntries.push({
        actorType: owner.ownerType, actorId: owner.ownerId,
        counterpartType: 'platform',
        kind: 'cancellation_penalty', direction: 'out', amount: bookingPenalty,
        balanceAfter: ownerDoc.crewWallet.balance, pendingAfter: ownerDoc.crewWallet.pendingBalance,
        shiftId: shift._id, bookingId: bk._id,
        idempotencyKey: `shift_penalty_booking:${bk._id}`,
        note: 'Penalización por cancelación tardía (cupo asignado)',
        metadata: { hoursToShift },
        performedBy: performedBy || { kind: 'system' },
      });
    }
  }

  /* Igual que en la liberación: la plata ya se movió y los bookings ya quedan
     cancelados, así que se deja constancia del fallo en vez de fingir que la
     cancelación no ocurrió. */
  if (ledgerEntries.length) {
    try {
      await CrewWalletTxn.insertMany(ledgerEntries);
    } catch (e) {
      logger.error('CANCELACIÓN SIN ASIENTO — la plata se movió pero el ledger no lo registró', {
        shiftId: String(shift._id), ownerType: owner.ownerType, ownerId: String(owner.ownerId),
        refund, penalty, workerCompensations, error: e.message,
      });
    }
  }

  // Actualizar totales del shift
  const totalReleased = activeBookings.reduce((s, bk) => s + (bk.agreedTotal + (bk.agreedCommission || 0)), 0);
  await ShiftPost.findByIdAndUpdate(shift._id, {
    $inc: {
      reservedAmount: -(freeReserve + totalReleased),
      refundedAmount: refund + bookingRefunds,
      releasedAmount: workerCompensations,
    },
  });

  return {
    shift,
    refund: refund + bookingRefunds,
    penalty: penalty + (totalReleased - workerCompensations - bookingRefunds),
    workerCompensations,
    refundRate, hoursToShift,
    cancelledBookings: activeBookings.length,
    affectedBookings: activeBookings.length,
    owner,
    wallet: ownerDoc.crewWallet,
  };
}

/**
 * Auto-libera bookings que el worker terminó (hizo checkout) pero el negocio
 * nunca confirmó. Cierra el agujero por el cual un negocio podía dejar al
 * worker sin pago simplemente no pulsando "completar".
 *
 * @param {number} maxAgeHours - horas desde el workerCheckoutAt antes de auto-liberar (default 24)
 * @param {number} limit - tope de bookings por corrida para no saturar la DB
 * @returns {Promise<{processed:number, released:number, failed:Array}>}
 */
async function autoReleaseStaleBookings({ maxAgeHours = 24, limit = 200, performedBy } = {}) {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const stale = await ShiftBooking.find({
    status: 'checked_in',
    workerCheckoutAt: { $ne: null, $lte: cutoff },
    payoutStatus: { $in: ['held', 'pending'] },
  }).limit(limit).select('_id').lean();

  const results = { processed: 0, released: 0, failed: [] };
  for (const stub of stale) {
    try {
      const r = await releaseBookingFunds({
        bookingId: stub._id,
        performedBy: performedBy || { kind: 'system' },
      });
      // También pasar el booking a `completed` (no se quedó en `checked_in` zombie)
      await ShiftBooking.findOneAndUpdate(
        { _id: stub._id, status: 'checked_in' },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            confirmedByBusinessAt: null, // explícito: no fue confirmación manual
          },
        },
      );
      if (!r.alreadyReleased) results.released++;
    } catch (e) {
      results.failed.push({ bookingId: String(stub._id), error: e.message, code: e.code });
    }
    results.processed++;
  }
  return results;
}

/* ─────────────────────────────────────────────
 *  VACANCY FEE — fee fijo por publicar vacante
 *  Se cobra UNA VEZ al publicar. No hay escrow, no hay comisión por contratación.
 *  Idempotente vía idempotencyKey `vacancy_post:<vacancyId>`.
 * ───────────────────────────────────────────── */

/**
 * Cobra el fee fijo de publicación de vacante al owner.
 *
 * @param ownerType 'business' | 'crew_employer'
 * @param ownerId
 * @param vacancyId — para idempotencia + auditoría
 * @param amount — opcional, default VACANCY_POST_FEE
 * @returns { txn, wallet, charged }
 */
async function chargeVacancyFee({ ownerType, ownerId, vacancyId, amount, performedBy }) {
  const charge = amount || VACANCY_POST_FEE;
  const Model = ownerModel(ownerType);

  // Idempotente: si ya cobramos para esta vacante, no cobramos otra vez.
  const existing = await CrewWalletTxn.findOne({
    idempotencyKey: `vacancy_post:${vacancyId}`,
  });
  if (existing) {
    const ownerDoc = await Model.findById(ownerId).select('crewWallet').lean();
    return { duplicated: true, txn: existing, wallet: ownerDoc?.crewWallet, charged: charge };
  }

  // Reserva atómica: solo descuenta si hay saldo suficiente
  const updated = await Model.findOneAndUpdate(
    { _id: ownerId, 'crewWallet.balance': { $gte: charge } },
    { $inc: { 'crewWallet.balance': -charge, 'crewWallet.totalCommissionPaid': charge } },
    { new: true, select: 'crewWallet' },
  );

  if (!updated) {
    const current = await Model.findById(ownerId).select('crewWallet').lean();
    const have = current?.crewWallet?.balance || 0;
    const err = new Error(`Saldo insuficiente para publicar vacante: necesitas ${charge} COP, tienes ${have} COP`);
    err.code = 'INSUFFICIENT_FUNDS';
    err.required = charge;
    err.available = have;
    throw err;
  }

  /* El asiento es la única prueba del cobro. Si no se puede escribir, se
     devuelve la plata en vez de quedárnosla sin registro: antes el descuento
     sobrevivía al fallo y el dueño perdía el fee sin vacante ni rastro. */
  let txn;
  try {
    txn = await CrewWalletTxn.create({
      actorType: ownerType, actorId: ownerId,
      counterpartType: 'platform',
      kind: 'vacancy_post', direction: 'out', amount: charge,
      balanceAfter: updated.crewWallet.balance,
      pendingAfter: updated.crewWallet.pendingBalance,
      idempotencyKey: `vacancy_post:${vacancyId}`,
      note: 'Publicación de vacante',
      metadata: { vacancyId: String(vacancyId) },
      performedBy: performedBy || { kind: 'system' },
    });
  } catch (e) {
    await Model.findByIdAndUpdate(ownerId, {
      $inc: { 'crewWallet.balance': charge, 'crewWallet.totalCommissionPaid': -charge },
    }).catch(() => {});
    logger.error('No se pudo registrar el cobro de vacante — cobro revertido', {
      ownerType, ownerId: String(ownerId), vacancyId: String(vacancyId), charge, error: e.message,
    });
    throw e;
  }

  return { duplicated: false, txn, wallet: updated.crewWallet, charged: charge };
}

/* ─────────────────────────────────────────────
 *  WORKER WALLET (retiros)
 * ───────────────────────────────────────────── */

/**
 * Solicita un retiro: bloquea saldo en pendingBalance del worker.
 */
async function requestWithdrawal({ workerId, amount, payoutMethod, clientIdempotencyKey }) {
  if (!amount || amount < MIN_WITHDRAWAL) {
    const err = new Error(`Retiro mínimo: ${MIN_WITHDRAWAL} COP`);
    err.code = 'AMOUNT_BELOW_MIN'; throw err;
  }
  if (!payoutMethod?.type || !payoutMethod?.accountInfo) {
    const err = new Error('Faltan datos del método de pago'); err.code = 'MISSING_PAYOUT'; throw err;
  }

  // Anti doble-click: si el frontend manda un clientIdempotencyKey y ya existe
  // un request con esa key, devolvemos el existente (no creamos otro retiro).
  if (clientIdempotencyKey) {
    const existingTxn = await CrewWalletTxn.findOne({
      idempotencyKey: `withdrawal_request_client:${clientIdempotencyKey}`,
    }).populate('withdrawalId').lean();
    if (existingTxn?.withdrawalId) {
      return { duplicated: true, request: existingTxn.withdrawalId };
    }
  }

  // Reservamos saldo atómicamente. Si no alcanza el $gte filtra fuera y
  // findOneAndUpdate devuelve null.
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

  try {
    await CrewWalletTxn.create({
      actorType: 'worker', actorId: workerId,
      kind: 'withdrawal_request', direction: 'out', amount,
      balanceAfter: worker.wallet.balance, pendingAfter: worker.wallet.pendingBalance,
      withdrawalId: request._id,
      // Key dual: por request (siempre única) + opcional la del cliente
      idempotencyKey: clientIdempotencyKey
        ? `withdrawal_request_client:${clientIdempotencyKey}`
        : `withdrawal_request:${request._id}`,
      note: 'Retiro solicitado',
      performedBy: { kind: 'worker', id: workerId },
    });
  } catch (e) {
    if (e.code === 11000 && clientIdempotencyKey) {
      // Otro request idéntico ya creó el ledger entry — revertimos lo nuestro.
      await CrewWithdrawalRequest.deleteOne({ _id: request._id }).catch(() => {});
      await Worker.updateOne(
        { _id: workerId },
        { $inc: { 'wallet.balance': amount, 'wallet.pendingBalance': -amount } },
      ).catch(() => {});
      const existingTxn = await CrewWalletTxn.findOne({
        idempotencyKey: `withdrawal_request_client:${clientIdempotencyKey}`,
      }).populate('withdrawalId').lean();
      if (existingTxn?.withdrawalId) {
        return { duplicated: true, request: existingTxn.withdrawalId };
      }
    }
    throw e;
  }

  return { request, wallet: worker.wallet };
}

/**
 * SuperAdmin marca un retiro como pagado.
 */
async function markWithdrawalPaid({ withdrawalId, externalReference, paidBy }) {
  // Transición atómica del status: solo el primer caller que matchea
  // (pending|processing) pasa a paid. Esto bloquea el doble-click del SuperAdmin
  // que antes podía debitar pendingBalance dos veces.
  const req = await CrewWithdrawalRequest.findOneAndUpdate(
    { _id: withdrawalId, status: { $in: ['pending', 'processing'] } },
    {
      $set: {
        status: 'paid',
        paidAt: new Date(),
        paidBy: paidBy || null,
        externalReference: externalReference || null,
      },
    },
    { new: true },
  );

  if (!req) {
    const existing = await CrewWithdrawalRequest.findById(withdrawalId).lean();
    if (!existing) { const e = new Error('Retiro no encontrado'); e.code = 'NOT_FOUND'; throw e; }
    if (existing.status === 'paid') return { alreadyPaid: true, request: existing };
    const e = new Error(`Retiro en estado ${existing.status}`); e.code = 'INVALID_STATE'; throw e;
  }

  const worker = await Worker.findByIdAndUpdate(
    req.workerId,
    { $inc: { 'wallet.pendingBalance': -req.amount } },
    { new: true, select: 'wallet' },
  );

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
  ownerModel, normalizeOwner, ownerFromDoc,
  // ops
  VACANCY_POST_FEE,
  depositOwnerWallet,
  depositBusinessWallet, // alias retrocompat
  chargeVacancyFee,
  reserveShiftEscrow,
  releaseBookingFunds,
  cancelShiftPost,
  autoReleaseStaleBookings,
  requestWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
};
