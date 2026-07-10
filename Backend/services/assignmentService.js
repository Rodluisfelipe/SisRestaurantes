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

/**
 * Main entry: try to auto-assign an order.
 * Returns { assigned, method, driver?, partner?, reason }.
 */
async function autoAssignOrder(order, business) {
  const settings = business.deliverySettings || {};
  const mode = settings.assignmentMode || 'manual';

  if (mode === 'manual') {
    return { assigned: false, reason: 'manual_mode' };
  }

  const coords = order.deliveryCoordinates;
  if (!coords?.lat || !coords?.lon) {
    return { assigned: false, reason: 'no_coordinates' };
  }

  // 1) Try own-fleet drivers
  const drivers = await getAvailableDrivers(order.businessId);
  const pick = pickDriver(drivers, coords.lat, coords.lon, mode, settings.maxAssignRadiusKm);

  if (pick) {
    const driver = await assignToDriver(order, pick.driver, mode);
    return { assigned: true, method: mode, driver, distanceKm: pick.distanceKm };
  }

  // 2) Fallback to partner company
  if (settings.usePartners) {
    const partner = await offerToPartner(order, business);
    if (partner) return { assigned: false, offered: true, method: 'partner', partner };
  }

  return { assigned: false, reason: 'no_driver_available' };
}

module.exports = {
  autoAssignOrder,
  offerToPartner,
  assignToDriver,
  getAvailableDrivers,
  haversineKm,
  generateConfirmationCode,
};
