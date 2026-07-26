const Subscription = require('../Models/Subscription');
const logger = require('../utils/logger');
const {
  getPlanConfig,
  resolveSubscriptionCommercialPlan,
  resolveSubscriptionBillingCycle,
  isUnlimited,
  isLimitReached,
  getLimitExceededMessage
} = require('../utils/commercialPlans');

/**
 * Centralized subscription status calculation.
 * Eliminates the duplicated logic across subscriptions.js, paymentRequests.js, and orders.js.
 */

const GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_DAYS || '0');

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
  const commercialPlan = resolveSubscriptionCommercialPlan(subscription);
  const billingCycle = resolveSubscriptionBillingCycle(subscription);
  const planConfig = getPlanConfig(commercialPlan);

  return {
    subscription,
    commercialPlan,
    billingCycle,
    planConfig,
    ...statusInfo
  };
}

/**
 * Devuelve la información de límite para un recurso según el plan activo.
 * @param {Object} params
 * @param {string} params.businessId
 * @param {string} params.resourceKey
 * @param {number} params.currentCount
 */
async function getPlanLimitStatus({ businessId, resourceKey, currentCount }) {
  const subscriptionInfo = await getSubscriptionForBusiness(businessId);
  const { commercialPlan, planConfig } = subscriptionInfo;
  const limitValue = planConfig?.limits?.[resourceKey];
  const reached = isLimitReached(limitValue, currentCount);

  return {
    ...subscriptionInfo,
    resourceKey,
    currentCount,
    limitValue,
    isUnlimited: isUnlimited(limitValue),
    limitReached: reached,
    remaining: isUnlimited(limitValue) ? null : Math.max(0, limitValue - currentCount),
    message: reached
      ? getLimitExceededMessage(commercialPlan, resourceKey, limitValue)
      : null
  };
}

function isFeatureEnabledForPlan(planConfig, featureKey) {
  return !!planConfig?.features?.[featureKey];
}

module.exports = {
  calculateSubscriptionStatus,
  getSubscriptionForBusiness,
  getPlanLimitStatus,
  isFeatureEnabledForPlan,
  GRACE_DAYS
};
