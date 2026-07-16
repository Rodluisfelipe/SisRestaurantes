/**
 * dailyPickupCode — the restaurant's daily pickup-confirmation code.
 *
 * The restaurant gives this to the domi on arrival so they can confirm the
 * pickup (proof the domi actually went to the store). Auto-generated per day,
 * per business, in the America/Bogota timezone.
 */
const crypto = require('crypto');

function todayBogota() {
  // en-CA yields YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Return today's pickup code for a business, regenerating it if the day changed.
 * @param {String|ObjectId} businessId
 * @returns {Promise<string>} the 4-digit code
 */
async function getOrCreateDailyPickupCode(businessId) {
  const BusinessConfig = require('../Models/BusinessConfig');
  const today = todayBogota();
  const biz = await BusinessConfig.findById(businessId).select('dailyPickupCode dailyPickupCodeDate').lean();
  if (biz && biz.dailyPickupCodeDate === today && biz.dailyPickupCode) {
    return biz.dailyPickupCode;
  }
  const code = crypto.randomInt(1000, 10000).toString();
  await BusinessConfig.updateOne(
    { _id: businessId },
    { $set: { dailyPickupCode: code, dailyPickupCodeDate: today } }
  );
  return code;
}

/** Validate a code against today's pickup code (regenerates if stale). */
async function verifyDailyPickupCode(businessId, code) {
  if (!code) return false;
  const current = await getOrCreateDailyPickupCode(businessId);
  return String(code).trim() === current;
}

module.exports = { getOrCreateDailyPickupCode, verifyDailyPickupCode, todayBogota };
