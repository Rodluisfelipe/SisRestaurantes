const ReferralConfig = require('../Models/ReferralConfig');
const Referral = require('../Models/Referral');
const BusinessConfig = require('../Models/BusinessConfig');
const logger = require('./logger');

/**
 * Process a referral when a referred business activates/pays a subscription.
 * Called from ePayco, dLocal, and manual subscription activation.
 *
 * @param {string} businessId - The referred business that just paid
 * @param {number} subscriptionPrice - Price paid (COP)
 * @param {number} months - Months purchased
 * @returns {{ processed: boolean, referral?: object }} Result
 */
async function processReferralOnPayment(businessId, subscriptionPrice, months) {
  try {
    // Find pending referral for this referred business
    const referral = await Referral.findOne({
      referredBusinessId: businessId,
      status: 'pending'
    });

    if (!referral) {
      return { processed: false };
    }

    const config = await ReferralConfig.getConfig();

    if (!config.isActive) {
      logger.info('[Referral] Program inactive, skipping referral processing', { businessId });
      return { processed: false };
    }

    // Check minimum months requirement
    if (months < config.minSubscriptionMonths) {
      logger.info('[Referral] Subscription months below minimum', {
        businessId, months, required: config.minSubscriptionMonths
      });
      return { processed: false };
    }

    // Calculate credits
    const referrerCredits = Math.round(subscriptionPrice * config.referrerDiscountPercent / 100);
    const referredDiscount = Math.round(subscriptionPrice * config.referredDiscountPercent / 100);

    referral.qualifiedAt = new Date();
    referral.referrerCreditsAwarded = referrerCredits;
    referral.referredDiscountAwarded = referredDiscount;

    if (config.requireApproval) {
      // Wait for superadmin approval
      referral.status = 'qualified';
      await referral.save();
      logger.info('[Referral] Referral qualified, awaiting approval', {
        referralId: referral._id,
        referrerCredits,
        referredDiscount
      });
      return { processed: true, referral, awaitingApproval: true };
    }

    // Auto-approve: deposit credits to referrer
    return await depositCredits(referral, config);
  } catch (error) {
    logger.error('[Referral] Error processing referral on payment', error);
    return { processed: false };
  }
}

/**
 * Deposit credits to the referrer business.
 * Used by both auto-approve and manual superadmin approve.
 *
 * @param {object} referral - Referral document
 * @param {object} config - ReferralConfig document (optional, will fetch if not provided)
 * @returns {{ processed: boolean, referral: object }}
 */
async function depositCredits(referral, config) {
  try {
    if (!config) {
      config = await ReferralConfig.getConfig();
    }

    const referrerBusiness = await BusinessConfig.findById(referral.referrerBusinessId);
    if (!referrerBusiness) {
      logger.warn('[Referral] Referrer business not found', { referralId: referral._id });
      referral.status = 'rejected';
      referral.rejectionReason = 'Negocio referente no encontrado';
      referral.rejectedAt = new Date();
      await referral.save();
      return { processed: false };
    }

    // Check max credits cap
    const currentCredits = referrerBusiness.referralCredits || 0;
    let creditsToAdd = referral.referrerCreditsAwarded;
    if (currentCredits + creditsToAdd > config.maxCreditsPerBusiness) {
      creditsToAdd = Math.max(0, config.maxCreditsPerBusiness - currentCredits);
    }

    // Atomic increment of credits
    await BusinessConfig.findByIdAndUpdate(referral.referrerBusinessId, {
      $inc: { referralCredits: creditsToAdd }
    });

    referral.referrerCreditsAwarded = creditsToAdd;
    referral.status = 'credited';
    referral.creditedAt = new Date();
    await referral.save();

    logger.info('[Referral] Credits deposited to referrer', {
      referralId: referral._id,
      referrerBusinessId: referral.referrerBusinessId,
      creditsAdded: creditsToAdd
    });

    return { processed: true, referral };
  } catch (error) {
    logger.error('[Referral] Error depositing credits', error);
    return { processed: false };
  }
}

/**
 * Apply referral credits when a business renews/pays their subscription.
 * Deducts from BusinessConfig.referralCredits and returns the discount amount.
 *
 * @param {string} businessId - The business paying for a subscription
 * @param {number} subscriptionPrice - The price to pay (COP)
 * @returns {{ discountApplied: number, remainingCredits: number }}
 */
async function applyReferralCredits(businessId, subscriptionPrice) {
  try {
    const business = await BusinessConfig.findById(businessId);
    if (!business || !business.referralCredits || business.referralCredits <= 0) {
      return { discountApplied: 0, remainingCredits: 0 };
    }

    const discount = Math.min(business.referralCredits, subscriptionPrice);

    // Atomic decrement
    await BusinessConfig.findByIdAndUpdate(businessId, {
      $inc: { referralCredits: -discount }
    });

    logger.info('[Referral] Credits applied to subscription', {
      businessId, discount, previousCredits: business.referralCredits
    });

    return {
      discountApplied: discount,
      remainingCredits: business.referralCredits - discount
    };
  } catch (error) {
    logger.error('[Referral] Error applying referral credits', error);
    return { discountApplied: 0, remainingCredits: 0 };
  }
}

module.exports = {
  processReferralOnPayment,
  depositCredits,
  applyReferralCredits
};
