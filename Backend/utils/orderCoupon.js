/**
 * Coupon validation and atomic application for orders.
 */
const Coupon = require('../Models/Coupon');
const BusinessCoupon = require('../Models/BusinessCoupon');
const BusinessConfig = require('../Models/BusinessConfig');
const logger = require('./logger');

/**
 * Validate and atomically apply a coupon to an order.
 * @param {string} couponCode - The coupon code from the client
 * @param {string|ObjectId} businessObjectId - Resolved business ObjectId
 * @param {number} totalAmount - The numeric total amount
 * @param {string} orderType - The order type (inSite, takeaway, delivery)
 * @param {Array} items - Order items
 * @param {Object|null} customer - The customer document (or null)
 * @returns {{ valid: boolean, coupon?: Object, discountAmount: number, finalAmount: number, error?: { status: number, message: string } }}
 */
async function applyCoupon(couponCode, businessObjectId, totalAmount, orderType, items, customer) {
  // Resolve businessId to slug for BusinessCoupon lookup
  let businessSlug = null;
  try {
    const businessConfig = await BusinessConfig.findById(businessObjectId).select('slug').lean();
    if (businessConfig && businessConfig.slug) {
      businessSlug = businessConfig.slug;
    }
  } catch (err) {
    logger.warn('Could not resolve business slug for coupon lookup', { error: err.message });
  }

  // Search in BusinessCoupon (business discount coupons) using slug
  let coupon = null;
  if (businessSlug) {
    coupon = await BusinessCoupon.findOne({
      businessId: businessSlug,
      code: couponCode.toUpperCase()
    });
  }

  // Fallback: search in subscription Coupon model with ObjectId
  if (!coupon) {
    coupon = await Coupon.findOne({
      businessId: businessObjectId,
      code: couponCode.toUpperCase()
    });
  }

  if (!coupon) {
    return {
      valid: false,
      discountAmount: 0,
      finalAmount: totalAmount,
      error: { status: 404, message: 'Cupón no encontrado' }
    };
  }

  const orderData = { totalAmount, orderType, items };
  const validation = coupon.validateForOrder(orderData, customer ? customer._id : null);

  if (!validation.valid) {
    return {
      valid: false,
      discountAmount: 0,
      finalAmount: totalAmount,
      error: { status: 400, message: `Cupón inválido: ${validation.error}` }
    };
  }

  const discountAmount = coupon.calculateDiscount(totalAmount);
  const finalAmount = totalAmount - discountAmount;

  // Atomic usage reservation — prevents double-spending race condition
  // Only increments if usageCount is still below usageLimit
  const usageFilter = { _id: coupon._id };
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
    usageFilter.usageCount = { $lt: coupon.usageLimit };
  }
  const CouponModel = coupon.constructor;
  const reserved = await CouponModel.findOneAndUpdate(
    usageFilter,
    { $inc: { usageCount: 1, totalDiscountGiven: discountAmount } },
    { new: true }
  );
  if (!reserved) {
    return {
      valid: false,
      discountAmount: 0,
      finalAmount: totalAmount,
      error: { status: 400, message: 'Este cupón ha alcanzado su límite de usos' }
    };
  }

  reserved.__usageAlreadyRecorded = true;

  return {
    valid: true,
    coupon: reserved,
    discountAmount,
    finalAmount
  };
}

module.exports = { applyCoupon };
