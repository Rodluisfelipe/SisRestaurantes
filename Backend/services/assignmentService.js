/**
 * assignmentService — core delivery assignment algorithm.
 *
 * Modes (business.deliverySettings.assignmentMode):
 *   - manual        → admin assigns by hand (this service is a no-op)
 *   - auto_nearest  → assign to the closest available own-fleet driver
 *   - auto_scored   → assign by weighted score (distance + load + rating)
 *
 * Fallback: if no own-fleet driver is available and usePartners is on, the order
 * is OFFERED to the highest-priority active partner company (they accept in their portal).
 */

const logger = require('../utils/logger');

const EARTH_R_KM = 6371;

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateConfirmationCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Consider a driver "online" if seen within this window (ms)
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Gather available own-fleet drivers for a business with a usable last location.
 */
async function getAvailableDrivers(businessId) {
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  return DeliveryPerson.find({
    businessId,
    active: true,
    isOnline: true,
    status: 'available',
    lastSeenAt: { $gte: since },
    'lastLocation.coordinates': { $exists: true, $ne: undefined },
  }).lean();
}

/**
 * Score a driver — lower is better.
 * distanceKm dominates; each active delivery adds ~2km of "cost"; low rating adds cost.
 */
function scoreDriver(distanceKm, driver) {
  const load = driver.activeDeliveries || 0;
  const rating = driver.rating ?? 5;
  return distanceKm * 0.6 + load * 2 * 0.3 + (5 - rating) * 0.1;
}

/**
 * Pick the best own-fleet driver for a destination.
 * Returns { driver, distanceKm } or null.
 */
function pickDriver(drivers, destLat, destLon, mode, maxRadiusKm) {
  const scored = drivers
    .map((d) => {
      const [lng, lat] = d.lastLocation.coordinates;
      const distanceKm = haversineKm(destLat, destLon, lat, lng);
      return { driver: d, distanceKm };
    })
    .filter((x) => x.distanceKm <= (maxRadiusKm || 8));

  if (!scored.length) return null;

  if (mode === 'auto_scored') {
    scored.sort((a, b) => scoreDriver(a.distanceKm, a.driver) - scoreDriver(b.distanceKm, b.driver));
  } else {
    // auto_nearest
    scored.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  return scored[0];
}

/**
 * Offer an order to the highest-priority active partner.
 * Returns the partner doc offered to, or null.
 */
async function offerToPartner(order, business) {
  const DeliveryPartner = require('../Models/DeliveryPartner');
  const socketService = require('./socketService');

  const assoc = (business.deliverySettings?.partners || [])
    .filter((p) => p.enabled && p.partnerId)
    .sort((a, b) => (a.priority || 1) - (b.priority || 1));

  for (const a of assoc) {
    const partner = await DeliveryPartner.findOne({ _id: a.partnerId, active: true }).lean();
    if (!partner) continue;

    order.assignedPartnerId = partner._id;
    order.partnerStatus = 'offered';
    order.partnerOfferedAt = new Date();
    order.assignmentMethod = 'partner';
    await order.save();

    // Shadow: record on the delivery state machine
    try {
      const dsm = require('./deliveryStateMachine');
      await dsm.recordForOrder(order, 'offer', {
        actor: 'system', partnerId: partner._id, assignmentMethod: 'partner',
        meta: { partnerName: partner.name },
      });
    } catch (e) { /* shadow, non-fatal */ }

    try {
      socketService.emitToPartner(String(partner._id), 'partner:new_offer', {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        businessId: String(order.businessId),
      });
    } catch (e) { /* non-critical */ }

    logger.info('Order offered to partner', { orderId: String(order._id), partnerId: String(partner._id) });
    return partner;
  }
  return null;
}

/**
 * Assign an order to a specific own-fleet driver (used by auto modes).
 */
async function assignToDriver(order, driver, method) {
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const BusinessConfig = require('../Models/BusinessConfig');
  const socketService = require('./socketService');

  order.deliveryPersonId = driver._id;
  order.deliveryAssignedAt = new Date();
  order.assignmentMethod = method;
  order.partnerStatus = 'none';
  order.assignedPartnerId = null;
  if (!order.confirmationCode) order.confirmationCode = generateConfirmationCode();
  await order.save();

  await DeliveryPerson.updateOne(
    { _id: driver._id },
    { $set: { status: 'on_delivery' }, $inc: { activeDeliveries: 1 } }
  );

  // Shadow: record on the delivery state machine (direct assign → accepted)
  try {
    const dsm = require('./deliveryStateMachine');
    await dsm.recordForOrder(order, 'assign', {
      actor: 'system', driverId: driver._id, assignmentMethod: method, actorName: driver.name,
      meta: { auto: true },
    });
  } catch (e) { /* shadow, non-fatal */ }

  try {
    const business = await BusinessConfig.findById(order.businessId).select('slug').lean();
    const slug = business?.slug;
    socketService.emitToBusiness(String(order.businessId), 'delivery:assigned', {
      orderId: String(order._id),
      deliveryPersonId: String(driver._id),
      driverName: driver.name,
      method,
    });
    if (slug) {
      socketService.emitToDeliveryRoom(slug, 'delivery:assigned', {
        orderId: String(order._id),
        deliveryPersonId: String(driver._id),
      });
    }
    socketService.emitToDeliveryPerson?.(String(driver._id), 'delivery:assigned', {
      orderId: String(order._id),
    });
  } catch (e) { /* non-critical */ }

  return driver;
}

/* ════════════════ OFFER ENGINE (Phase C) ════════════════ */

// Drivers who already rejected or let an offer expire for this delivery
async function getExcludedDriverIds(deliveryId) {
  const DeliveryOffer = require('../Models/DeliveryOffer');
  const past = await DeliveryOffer.find({ deliveryId, state: { $in: ['rejected', 'expired'] } }).select('driverId').lean();
  return past.map(o => String(o.driverId));
}

// Create an exclusive, time-boxed offer to one driver
async function offerToDriver(order, business, driver, distanceKm, attempt = 1) {
  const DeliveryOffer = require('../Models/DeliveryOffer');
  const dsm = require('./deliveryStateMachine');
  const socketService = require('./socketService');

  const delivery = await dsm.ensureDeliveryForOrder(order, {});
  const timeoutSec = (business.deliverySettings && business.deliverySettings.offerTimeoutSec) || 30;
  const expiresAt = new Date(Date.now() + timeoutSec * 1000);

  const offer = await DeliveryOffer.create({
    deliveryId: delivery._id, orderId: order._id, businessId: order.businessId,
    driverId: driver._id, distanceKm, attempt, expiresAt,
  });

  await dsm.transition(delivery, 'offer', {
    actor: 'system', driverId: driver._id,
    meta: { driverName: driver.name, distanceKm, attempt },
  });

  try {
    socketService.emitToDeliveryPerson(String(driver._id), 'delivery:offer', {
      offerId: String(offer._id), orderId: String(order._id), orderNumber: order.orderNumber,
      customerName: order.customerName, address: order.address, totalAmount: order.totalAmount,
      distanceKm, expiresAt: expiresAt.toISOString(), timeoutSec,
    });
    socketService.emitToBusiness(String(order.businessId), 'delivery:offered', {
      orderId: String(order._id), driverId: String(driver._id), driverName: driver.name,
    });
  } catch { /* non-critical */ }

  return { offer, driver, delivery };
}

// Pick the best remaining candidate and offer to them; fall back to partner, then no_courier
async function pickAndOffer(order, business) {
  const settings = business.deliverySettings || {};
  const mode = settings.assignmentMode || 'manual';
  if (mode === 'manual') return { ok: false, reason: 'manual_mode' };

  const coords = order.deliveryCoordinates;
  if (!coords?.lat || !coords?.lon) return { ok: false, reason: 'no_coordinates' };

  const dsm = require('./deliveryStateMachine');
  const delivery = await dsm.ensureDeliveryForOrder(order, {});
  const excluded = await getExcludedDriverIds(delivery._id);

  let drivers = await getAvailableDrivers(order.businessId);
  drivers = drivers.filter(d => !excluded.includes(String(d._id)));
  const pick = pickDriver(drivers, coords.lat, coords.lon, mode, settings.maxAssignRadiusKm);

  if (pick) {
    const attempt = excluded.length + 1;
    const { offer, driver } = await offerToDriver(order, business, pick.driver, pick.distanceKm, attempt);
    return { ok: true, offered: true, offer, driver, distanceKm: pick.distanceKm };
  }

  // No more own drivers → partner fallback
  if (settings.usePartners) {
    const partner = await offerToPartner(order, business);
    if (partner) return { ok: true, offered: true, partner };
  }

  // Nobody available → no_courier (alert the restaurant)
  try {
    const socketService = require('./socketService');
    await dsm.transition(delivery, 'no_courier', { actor: 'system' });
    socketService.emitToBusiness(String(order.businessId), 'delivery:no_courier', { orderId: String(order._id) });
  } catch { /* non-critical */ }
  return { ok: false, reason: 'no_courier' };
}

// Driver accepts an offer → assign the order to them
async function acceptOffer(offer, driver) {
  const DeliveryOffer = require('../Models/DeliveryOffer');
  const Order = require('../Models/Order');
  const DeliveryPerson = require('../Models/DeliveryPerson');
  const Delivery = require('../Models/Delivery');
  const dsm = require('./deliveryStateMachine');
  const socketService = require('./socketService');

  if (offer.state !== 'pending') return { ok: false, reason: 'offer_not_pending' };
  if (offer.expiresAt < new Date()) {
    offer.state = 'expired'; offer.respondedAt = new Date(); await offer.save();
    return { ok: false, reason: 'expired' };
  }

  const order = await Order.findById(offer.orderId);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.deliveryPersonId) return { ok: false, reason: 'already_assigned' };

  offer.state = 'accepted'; offer.respondedAt = new Date(); await offer.save();
  await DeliveryOffer.updateMany(
    { deliveryId: offer.deliveryId, state: 'pending', _id: { $ne: offer._id } },
    { $set: { state: 'superseded' } }
  );

  order.deliveryPersonId = driver._id;
  order.deliveryAssignedAt = new Date();
  order.assignmentMethod = 'auto_offer';
  order.deliveryMode = 'profile';
  if (!order.confirmationCode) order.confirmationCode = generateConfirmationCode();
  order.status = 'inProgress';
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push({ status: 'inProgress', timestamp: new Date(), note: `Oferta aceptada por ${driver.name}` });
  await order.save();

  await DeliveryPerson.updateOne({ _id: driver._id }, { $set: { status: 'on_delivery' }, $inc: { activeDeliveries: 1 } });

  const delivery = await Delivery.findOne({ orderId: order._id });
  if (delivery) {
    await dsm.transition(delivery, 'accept', { actor: 'driver', actorId: driver._id, actorName: driver.name, driverId: driver._id });
  }

  try {
    const BusinessConfig = require('../Models/BusinessConfig');
    const biz = await BusinessConfig.findById(order.businessId).select('slug').lean();
    socketService.emitToBusiness(String(order.businessId), 'delivery:assigned', {
      orderId: String(order._id), deliveryPersonId: String(driver._id), driverName: driver.name, method: 'auto_offer',
    });
    if (biz?.slug) socketService.emitToDeliveryRoom(biz.slug, 'delivery:assigned', { orderId: String(order._id) });
  } catch { /* non-critical */ }

  return { ok: true, order };
}

// Driver rejects an offer → re-offer to the next candidate
async function rejectOffer(offer) {
  const Order = require('../Models/Order');
  const BusinessConfig = require('../Models/BusinessConfig');

  if (offer.state !== 'pending') return { ok: false, reason: 'offer_not_pending' };
  offer.state = 'rejected'; offer.respondedAt = new Date(); await offer.save();

  const order = await Order.findById(offer.orderId);
  const business = await BusinessConfig.findById(offer.businessId).lean();
  if (order && !order.deliveryPersonId && business) return pickAndOffer(order, business);
  return { ok: true, reoffered: false };
}

// Sweeper: expire stale pending offers and re-offer automatically
async function expireStaleOffers() {
  const DeliveryOffer = require('../Models/DeliveryOffer');
  const Order = require('../Models/Order');
  const BusinessConfig = require('../Models/BusinessConfig');

  const now = new Date();
  const stale = await DeliveryOffer.find({ state: 'pending', expiresAt: { $lt: now } }).limit(50);
  for (const offer of stale) {
    try {
      offer.state = 'expired'; offer.respondedAt = now; await offer.save();
      const order = await Order.findById(offer.orderId);
      if (!order || order.deliveryPersonId) continue; // already handled
      const business = await BusinessConfig.findById(offer.businessId).lean();
      if (business) await pickAndOffer(order, business);
    } catch (e) {
      logger.warn('expireStaleOffers item failed', { offerId: String(offer._id), error: e.message });
    }
  }
  return stale.length;
}

let sweeperStarted = false;
function startOfferSweeper(intervalMs = 10000) {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => { expireStaleOffers().catch(() => {}); }, intervalMs);
  logger.info('Delivery offer sweeper started', { intervalMs });
}

/**
 * Main entry used by the admin "auto-assign" action. In auto modes this now
 * OFFERS the order (Phase C) instead of assigning it directly.
 * Returns a shape compatible with the existing admin endpoint.
 */
async function autoAssignOrder(order, business) {
  const result = await pickAndOffer(order, business);
  if (result.ok && result.offered && result.driver) {
    return { assigned: false, offered: true, method: 'offer', driver: result.driver, distanceKm: result.distanceKm };
  }
  if (result.ok && result.offered && result.partner) {
    return { assigned: false, offered: true, method: 'partner', partner: result.partner };
  }
  return { assigned: false, reason: result.reason || 'no_driver_available' };
}

module.exports = {
  autoAssignOrder,
  pickAndOffer,
  offerToDriver,
  acceptOffer,
  rejectOffer,
  expireStaleOffers,
  startOfferSweeper,
  offerToPartner,
  assignToDriver,
  getAvailableDrivers,
  haversineKm,
  generateConfirmationCode,
};
