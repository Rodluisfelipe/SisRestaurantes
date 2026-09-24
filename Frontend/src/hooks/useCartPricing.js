import { precioDeOpciones } from '../utils/orderUtils';
/**
 * Calculate the total price for a single cart item including toppings.
 */
export function calculateItemTotal(item) {
  const basePrice = parseFloat(item.finalPrice || item.price || 0);
  const quantity = parseInt(item.quantity || 0);

  const toppingPriceSum = precioDeOpciones(item.selectedToppings);

  // Precio total: (base + toppings) * cantidad
  return (basePrice + toppingPriceSum) * quantity;
}

/**
 * Hook that computes cart pricing: totalItems, totalAmount, finalAmount, loyaltyDiscountAmount.
 */
export default function useCartPricing(cart, appliedCoupon, loyaltyReward) {
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const totalAmount = cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  // Calcular total final con descuento de cupón y/o loyalty
  let finalAmount = appliedCoupon ? appliedCoupon.finalAmount : totalAmount;

  // Apply loyalty reward discount (stacks with coupon)
  let loyaltyDiscountAmount = 0;
  if (loyaltyReward) {
    const r = loyaltyReward.reward;
    if (r.type === 'discount_fixed') {
      loyaltyDiscountAmount = Math.min(r.discountValue, finalAmount);
    } else if (r.type === 'discount_percent') {
      loyaltyDiscountAmount = Math.round(finalAmount * r.discountValue / 100);
      if (r.maxDiscount > 0) loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, r.maxDiscount);
    } else if (r.type === 'free_delivery') {
      // Delivery discount handled separately
      loyaltyDiscountAmount = 0;
    }
    finalAmount = Math.max(0, finalAmount - loyaltyDiscountAmount);
  }

  return { totalItems, totalAmount, finalAmount, loyaltyDiscountAmount, calculateItemTotal };
}
