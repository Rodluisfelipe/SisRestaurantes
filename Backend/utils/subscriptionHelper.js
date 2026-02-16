const Subscription = require('../Models/Subscription');
const logger = require('../utils/logger');

/**
 * Centralized subscription status calculation.
 * Eliminates the duplicated logic across subscriptions.js, paymentRequests.js, and orders.js.
 */

const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '1');

/**
 * Calculate the effective status of a subscription.
 * @param {Object} subscription - Mongoose subscription document
 * @returns {Object} { status, isActive, isGrace, isSuspended, periodEnd, graceUntil }
 */
function calculateSubscriptionStatus(subscription) {
  if (!subscription) {
    return { status: 'none', isActive: false, isGrace: false, isSuspended: false };
  }

  const now = new Date();
  const periodEndDate = subscription.periodEnd || subscription.endDate;
  
  // Calculate grace period end - SIEMPRE usar cálculo dinámico (no el valor almacenado)
  let graceUntilDate;
  if (subscription.calculateGraceUntil) {
    graceUntilDate = subscription.calculateGraceUntil();
  }
  if (!graceUntilDate && periodEndDate) {
    graceUntilDate = new Date(periodEndDate);
    graceUntilDate.setDate(graceUntilDate.getDate() + GRACE_DAYS);
  }

  let status = 'active';

  if (periodEndDate) {
    if (now > periodEndDate) {
      if (graceUntilDate && now <= graceUntilDate) {
        status = 'grace';
      } else {
        status = 'suspended';
      }
    }
  }

  // Also check using the model method if available
  if (subscription.getCurrentStatus) {
    const modelStatus = subscription.getCurrentStatus();
    if (modelStatus === 'suspended') {
      status = 'suspended';
    }
  }

  return {
    status,
    isActive: status === 'active',
    isGrace: status === 'grace',
    isSuspended: status === 'suspended',
    periodEnd: periodEndDate,
    graceUntil: graceUntilDate
  };
}

/**
 * Get the latest subscription for a business with calculated status.
 * @param {string} businessId - The business ObjectId
 * @returns {Object} { subscription, ...statusInfo }
 */
async function getSubscriptionForBusiness(businessId) {
  const subscription = await Subscription.findOne({ businessId })
    .sort({ createdAt: -1 });

  const statusInfo = calculateSubscriptionStatus(subscription);

  return {
    subscription,
    ...statusInfo
  };
}

module.exports = {
  calculateSubscriptionStatus,
  getSubscriptionForBusiness,
  GRACE_DAYS
};
