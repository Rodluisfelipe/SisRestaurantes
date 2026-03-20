/**
 * Server-side price validation for orders.
 * Recalculates the total from DB prices to prevent price manipulation.
 */
const Product = require('../Models/Product');
const ToppingGroup = require('../Models/ToppingGroup');
const logger = require('./logger');

/**
 * Validate order prices against the database.
 * @param {Array} items - Order items from the client
 * @param {string|ObjectId} businessObjectId - Resolved business ObjectId
 * @param {number} clientTotal - The total amount sent by the client
 * @returns {{ valid: boolean, error?: { status: number, message: string, code?: string } }}
 */
async function validateOrderPrices(items, businessObjectId, clientTotal) {
  let calculatedTotal = 0;
  const debugItems = [];

  // Batch-fetch all products in one query instead of N sequential findOne calls
  const productIds = items.filter(i => i.productId).map(i => i.productId);
  const dbProducts = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds }, businessId: businessObjectId }).lean()
    : [];
  const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));

  // Batch-fetch all topping groups for this business for server-side validation
  const allToppingGroupIds = dbProducts.flatMap(p => (p.toppingGroups || []).map(id => id.toString()));
  const uniqueToppingGroupIds = [...new Set(allToppingGroupIds)];
  const dbToppingGroups = uniqueToppingGroupIds.length > 0
    ? await ToppingGroup.find({ _id: { $in: uniqueToppingGroupIds }, businessId: businessObjectId }).lean()
    : [];
  const toppingGroupMap = new Map(dbToppingGroups.map(tg => [tg._id.toString(), tg]));

  for (const item of items) {
    // Loyalty reward items are free (points already deducted via /loyalty/redeem)
    if (item.isLoyaltyReward) {
      debugItems.push({ name: item.name, dbPrice: 0, clientPrice: 0, serverItemPrice: 0, qty: item.quantity, loyaltyReward: true });
      continue;
    }
    if (item.productId) {
      const dbProduct = productMap.get(item.productId.toString());
      if (dbProduct) {
        let itemPrice = dbProduct.price;
        const debugToppings = [];
        // Validate toppings against DB — don't trust client prices
        if (item.selectedToppings && Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0) {
          // Build a set of valid topping group IDs for this product
          const validGroupIds = new Set((dbProduct.toppingGroups || []).map(id => id.toString()));

          for (const topping of item.selectedToppings) {
            // Try to find the matching DB topping group by name
            let dbGroup = null;
            for (const [gId, tg] of toppingGroupMap) {
              if (validGroupIds.has(gId) && tg.name === topping.groupName) {
                dbGroup = tg;
                break;
              }
            }

            if (dbGroup) {
              // Use DB basePrice, not client-sent basePrice
              if (dbGroup.basePrice && typeof dbGroup.basePrice === 'number') {
                itemPrice += dbGroup.basePrice;
              }
              // Find the selected option in DB and use DB price
              if (topping.optionName) {
                const dbOption = (dbGroup.options || []).find(o => o.name === topping.optionName);
                if (dbOption && dbOption.price) {
                  itemPrice += dbOption.price;
                }
              }
              // subGroups — validate against DB
              if (topping.subGroups && Array.isArray(topping.subGroups)) {
                for (const sub of topping.subGroups) {
                  const dbSubGroup = (dbGroup.subGroups || []).find(sg => sg.title === sub.subGroupTitle);
                  if (dbSubGroup && sub.optionName) {
                    const dbSubOption = (dbSubGroup.options || []).find(o => o.name === sub.optionName);
                    if (dbSubOption && dbSubOption.price) {
                      itemPrice += dbSubOption.price;
                    }
                  }
                }
              }
            } else {
              // Topping group not found in DB — do NOT trust client prices.
              // Log warning for debugging but add $0 for this topping.
              logger.warn('Topping group not found in DB, ignoring client price', {
                groupName: topping.groupName,
                productId: item.productId,
                businessId: businessObjectId
              });
            }
            debugToppings.push({ gn: topping.groupName, on: topping.optionName, bp: topping.basePrice, p: topping.price, dbValidated: !!dbGroup });
          }
        }
        debugItems.push({ name: item.name, dbPrice: dbProduct.price, clientPrice: item.price, serverItemPrice: itemPrice, qty: item.quantity, toppings: debugToppings });
        calculatedTotal += itemPrice * (item.quantity || 1);
      } else {
        // Product not found in DB — block order instead of trusting client price
        logger.warn('Product not found in DB during order creation', { productId: item.productId, businessId: businessObjectId, itemName: item.name });
        return {
          valid: false,
          error: {
            status: 400,
            message: `El producto "${item.name}" ya no está disponible. Por favor recarga la página.`,
            code: 'PRODUCT_NOT_FOUND'
          }
        };
      }
    } else {
      // No productId — use client price (legacy orders from WhatsApp)
      calculatedTotal += (item.price || 0) * (item.quantity || 1);
    }
  }

  // Allow 5% tolerance for rounding differences, delivery fees already excluded from totalAmount
  if (calculatedTotal > 0 && Math.abs(calculatedTotal - clientTotal) > calculatedTotal * 0.05) {
    logger.warn('Price mismatch detected — BLOCKING order', {
      clientTotal,
      serverTotal: calculatedTotal,
      diff: clientTotal - calculatedTotal,
      businessId: businessObjectId,
      debugItems
    });
    return {
      valid: false,
      error: {
        status: 400,
        message: 'El total del pedido no coincide con los precios del menú. Por favor recarga la página e intenta de nuevo.',
        code: 'PRICE_MISMATCH'
      }
    };
  }

  return { valid: true };
}

module.exports = { validateOrderPrices };
