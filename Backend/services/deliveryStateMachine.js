/**
 * deliveryStateMachine — the single source of truth for a delivery's lifecycle.
 *
 * Every state change goes through transition(): it validates the move is legal,
 * stamps the timestamp, appends an immutable DeliveryEvent, and emits a socket
 * event. Nothing mutates a delivery's state outside this service.
 *
 * Phase A runs in "shadow" mode: call sites invoke recordForOrder() alongside
 * their existing logic (wrapped in try/catch), so the state machine + audit log
 * come alive without changing any existing behaviour.
 */

const logger = require('../utils/logger');

// state → { event: nextState }
const TRANSITIONS = {
  created:     { ready: 'ready', offer: 'offered', assign: 'accepted', cancel: 'cancelled' },
  ready:       { offer: 'offered', assign: 'accepted', cancel: 'cancelled' },
  offered:     { accept: 'accepted', assign: 'accepted', reject: 'ready', reoffer: 'offered', no_courier: 'no_courier', cancel: 'cancelled' },
  accepted:    { arrive_store: 'at_store', pickup: 'picked_up', cancel: 'cancelled', fail: 'failed' },
  at_store:    { pickup: 'picked_up', cancel: 'cancelled', fail: 'failed' },
  picked_up:   { depart: 'en_route', arrive_customer: 'at_customer', deliver: 'delivered', fail: 'failed', return: 'returned' },
  en_route:    { arrive_customer: 'at_customer', deliver: 'delivered', fail: 'failed', return: 'returned' },
  at_customer: { deliver: 'delivered', fail: 'failed', return: 'returned' },
  no_courier:  { offer: 'offered', assign: 'accepted', cancel: 'cancelled' },
  failed:      { retry: 'offered', return: 'returned', cancel: 'cancelled' },
  // terminal: delivered, cancelled, returned
};

const TERMINAL = ['delivered', 'cancelled', 'returned'];

// event → timestamp field on delivery.timestamps
const EVENT_TS = {
  ready: 'readyAt',
  offer: 'offeredAt', reoffer: 'offeredAt', retry: 'offeredAt',
  accept: 'acceptedAt', assign: 'acceptedAt',
  arrive_store: 'arrivedStoreAt',
  pickup: 'pickedUpAt',
  depart: 'enRouteAt',
  arrive_customer: 'arrivedCustomerAt',
  deliver: 'deliveredAt',
  no_courier: 'noCourierAt',
  fail: 'failedAt',
  return: 'returnedAt',
  cancel: 'cancelledAt',
};

function canTransition(fromState, event) {
  return !!(TRANSITIONS[fromState] && TRANSITIONS[fromState][event]);
}

/**
 * Ensure a Delivery exists for an order; create it (snapshotting order data) if not.
 * @param {Object} order  Order mongoose doc or lean object
 * @param {Object} opts   { initialState, driverId, partnerId, assignmentMethod }
 */
async function ensureDeliveryForOrder(order, opts = {}) {
  const Delivery = require('../Models/Delivery');
  const DeliveryEvent = require('../Models/DeliveryEvent');

  let delivery = await Delivery.findOne({ orderId: order._id });
  if (delivery) return delivery;

  delivery = new Delivery({
    orderId: order._id,
    businessId: order.businessId,
    orderNumber: order.orderNumber,
    state: opts.initialState || 'created',
    driverId: opts.driverId || order.deliveryPersonId || null,
    partnerId: opts.partnerId || order.assignedPartnerId || null,
    assignmentMethod: opts.assignmentMethod || order.assignmentMethod || null,
    customerName: order.customerName,
    customerPhone: order.phone,
    address: order.address,
    coordinates: order.deliveryCoordinates ? { lat: order.deliveryCoordinates.lat, lon: order.deliveryCoordinates.lon } : undefined,
    totalAmount: order.totalAmount || order.finalAmount || 0,
    deliveryFee: order.deliveryFee || 0,
    cashToCollect: ['cash', 'efectivo'].includes((order.paymentMethod || '').toLowerCase()) ? (order.finalAmount || order.totalAmount || 0) : 0,
    confirmationCode: order.confirmationCode || null,
    history: [{ state: opts.initialState || 'created', event: 'create', actor: opts.actor || 'system', at: new Date() }],
  });
  await delivery.save();

  await DeliveryEvent.create({
    deliveryId: delivery._id,
    orderId: order._id,
    businessId: order.businessId,
    event: 'create',
    fromState: null,
    toState: delivery.state,
    actor: opts.actor || 'system',
    actorId: opts.actorId || null,
    meta: { source: 'ensureDeliveryForOrder' },
  });

  return delivery;
}

/**
 * Apply a transition to a delivery.
 * @param {Object} delivery  Delivery mongoose doc
 * @param {String} event     transition event name
 * @param {Object} ctx       { actor, actorId, actorName, location, meta }
 * @returns {Object} { ok, delivery, reason? }
 */
async function transition(delivery, event, ctx = {}) {
  const DeliveryEvent = require('../Models/DeliveryEvent');
  const socketService = require('./socketService');

  const from = delivery.state;

  if (TERMINAL.includes(from)) {
    return { ok: false, reason: 'terminal_state', from };
  }
  if (!canTransition(from, event)) {
    logger.debug('Illegal delivery transition', { deliveryId: String(delivery._id), from, event });
    return { ok: false, reason: 'illegal_transition', from, event };
  }

  const to = TRANSITIONS[from][event];
  delivery.state = to;

  const tsField = EVENT_TS[event];
  if (tsField) {
    delivery.timestamps = delivery.timestamps || {};
    delivery.timestamps[tsField] = new Date();
  }

  // Context updates
  if (ctx.driverId !== undefined) delivery.driverId = ctx.driverId;
  if (ctx.partnerId !== undefined) delivery.partnerId = ctx.partnerId;
  if (ctx.assignmentMethod) delivery.assignmentMethod = ctx.assignmentMethod;
  if (ctx.failureReason) delivery.failureReason = ctx.failureReason;
  if (ctx.cancellationReason) delivery.cancellationReason = ctx.cancellationReason;
  if (ctx.proofPhoto) delivery.proofPhoto = ctx.proofPhoto;
  if (ctx.location) delivery.proofLocation = ctx.location;

  delivery.history = delivery.history || [];
  delivery.history.push({ state: to, event, actor: ctx.actor || 'system', at: new Date() });
  // keep inline history bounded
  if (delivery.history.length > 40) delivery.history = delivery.history.slice(-40);

  await delivery.save();

  await DeliveryEvent.create({
    deliveryId: delivery._id,
    orderId: delivery.orderId,
    businessId: delivery.businessId,
    event,
    fromState: from,
    toState: to,
    actor: ctx.actor || 'system',
    actorId: ctx.actorId || null,
    actorName: ctx.actorName || null,
    location: ctx.location || undefined,
    meta: ctx.meta || {},
  });

  // Emit a non-breaking socket event (existing UIs ignore it)
  try {
    socketService.emitToBusiness(String(delivery.businessId), 'delivery:state', {
      orderId: String(delivery.orderId), deliveryId: String(delivery._id), state: to, from, event,
    });
    socketService.emitToOrder(String(delivery.orderId), 'delivery:state', { state: to, event });
  } catch { /* non-critical */ }

  return { ok: true, delivery, from, to };
}

/**
 * Convenience bridge used at existing call sites: ensure the delivery exists,
 * then apply the transition. Safe to wrap in try/catch — never throws on illegal moves.
 * @param {Object} order  Order doc (must have _id, businessId, ...)
 */
async function recordForOrder(order, event, ctx = {}) {
  try {
    const delivery = await ensureDeliveryForOrder(order, ctx);
    return await transition(delivery, event, ctx);
  } catch (err) {
    logger.warn('recordForOrder failed (shadow mode, non-fatal)', { orderId: String(order?._id), event, error: err.message });
    return { ok: false, reason: 'error', error: err.message };
  }
}

module.exports = {
  TRANSITIONS,
  TERMINAL,
  canTransition,
  ensureDeliveryForOrder,
  transition,
  recordForOrder,
};
