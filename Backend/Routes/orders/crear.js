/**
 * Pedidos — Crear un pedido (menú, WhatsApp, POS, pedido rápido): precios validados en
 * el servidor, pedido mínimo, plan, cliente, cupón, domicilio, crédito,
 * inventario, caja y avisos.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const Customer = require("../../Models/Customer");
const { emitirLlave } = require("../../utils/cuentaCliente");
const BusinessConfig = require("../../Models/BusinessConfig");
const socketService = require("../../services/socketService");
const { validateAndResolveBusinessId } = require("../../utils/businessValidator");
const logger = require("../../utils/logger");
const { getSubscriptionForBusiness, getPlanLimitStatus, isFeatureEnabledForPlan } = require('../../utils/subscriptionHelper');
const { ORDER_STATUS } = require('../../utils/constants');
const { validateCreateOrder } = require('../../middleware/validate');
const { startOfMonthCOL, endOfMonthCOL } = require('../../utils/timezone');
const { validateOrderPrices } = require('../../utils/orderPricing');
const { applyCoupon } = require('../../utils/orderCoupon');
const { stripHtml } = require('../../utils/sanitize');
/* El inventario se mueve en services/inventario.js: la misma operación la
   usan las ventas, las cancelaciones y las devoluciones. */
const { moverStock } = require('../../services/inventario');
const { sincronizarCreditoPedido, valorDelPedido } = require('../../services/credito');
const { createOrderLimiter, orderPhoneLimiter, generateCustomerToken, generateOrderNumber, esPersonalDelNegocio, personalDeEsteNegocio } = require('./compartido');

// Create a new order — el personal autenticado no pasa por los límites del comensal
router.post("/", (req, res, next) => {
  if (esPersonalDelNegocio(req)) return next();
  return createOrderLimiter(req, res, next);
}, (req, res, next) => {
  if (esPersonalDelNegocio(req)) return next();
  return orderPhoneLimiter(req, res, next);
}, validateCreateOrder, async (req, res) => {
  try {


    
    const { 
      businessId, 
      customerName, 
      orderType, 
      items, 
      totalAmount, 
      tableNumber, 
      phone, 
      address, 
      couponCode,
      // Datos de delivery zone
      deliveryFee,
      deliveryZoneName,
      deliveryZoneId,
      deliveryZoneInfo,
      deliveryCalculated,
      deliveryNeedsConfirmation,
      // In-app ordering fields
      orderChannel,
      source,
      paymentMethod,
      customerNotes,
      // POS payment details (for ticket reprinting)
      posPaymentInfo,
      // Customer email
      customerEmail,
      // Gift order fields
      isGift,
      gift
    } = req.body;
    





    
    // Convertir totalAmount a número si es string
    const numericTotalAmount = typeof totalAmount === 'string' ? parseFloat(totalAmount) : totalAmount;
    
    // Input validation
    if (!businessId || !customerName || !orderType || !items || numericTotalAmount === undefined || numericTotalAmount === null || isNaN(numericTotalAmount)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items must be a non-empty array" });
    }
    if (items.length > 100) {
      return res.status(400).json({ message: "Too many items in order (max 100)" });
    }
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || !item.quantity || item.price == null) {
        return res.status(400).json({ message: "Each item must have name (string), quantity and price" });
      }
    }

    // Validate orderType
    const validOrderTypes = ['inSite', 'takeaway', 'delivery'];
    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({ message: `orderType must be one of: ${validOrderTypes.join(', ')}` });
    }

    // Validate string lengths
    if (customerName.length > 100) {
      return res.status(400).json({ message: "customerName exceeds max length (100)" });
    }
    if (address && address.length > 500) {
      return res.status(400).json({ message: "address exceeds max length (500)" });
    }

    // Validate gift fields
    if (isGift) {
      if (!gift || typeof gift !== 'object') {
        return res.status(400).json({ message: "gift data is required for gift orders" });
      }
      if (!gift.recipientName || typeof gift.recipientName !== 'string' || gift.recipientName.trim().length === 0) {
        return res.status(400).json({ message: "gift.recipientName is required" });
      }
      if (gift.recipientName.length > 100) {
        return res.status(400).json({ message: "gift.recipientName exceeds max length (100)" });
      }
      if (gift.recipientPhone && gift.recipientPhone.length > 30) {
        return res.status(400).json({ message: "gift.recipientPhone exceeds max length (30)" });
      }
      if (gift.message && gift.message.length > 300) {
        return res.status(400).json({ message: "gift.message exceeds max length (300)" });
      }
    }
    
    // Use centralized business validation
    const businessResult = await validateAndResolveBusinessId(businessId);
    if (!businessResult.success) {
      return res.status(404).json({ message: businessResult.error });
    }
    
    const businessObjectId = businessResult.businessId;

    // === IDEMPOTENCY CHECK (POS offline sync) ===
    // If client sends an offlineId, reject if an order with that offlineId already exists
    if (req.body.offlineId) {
      const existingOffline = await Order.findOne({ 
        businessId: businessObjectId, 
        offlineId: req.body.offlineId 
      }).select('_id orderNumber').lean();
      if (existingOffline) {
        logger.info('Duplicate offline order rejected', { offlineId: req.body.offlineId, existingOrderNumber: existingOffline.orderNumber });
        return res.status(409).json({ 
          message: 'Este pedido ya fue sincronizado',
          code: 'DUPLICATE_OFFLINE_ORDER',
          existingOrderId: existingOffline._id,
          existingOrderNumber: existingOffline.orderNumber
        });
      }
    }

    // === SERVER-SIDE PRICE VALIDATION ===
    try {
      const priceResult = await validateOrderPrices(items, businessObjectId, numericTotalAmount);
      if (!priceResult.valid) {
        return res.status(priceResult.error.status).json({
          message: priceResult.error.message,
          code: priceResult.error.code
        });
      }
    } catch (priceErr) {
      // Non-blocking: if price check fails, log and continue (don't break orders)
      logger.warn('Price validation failed, continuing', { error: priceErr.message });
    }

    // === PEDIDO MÍNIMO === (no se puede saltar por API)
    try {
      const bizMin = await BusinessConfig.findById(businessObjectId).select('minOrderAmount').lean();
      const minOrderAmount = Number(bizMin?.minOrderAmount) || 0;
      if (minOrderAmount > 0 && numericTotalAmount < minOrderAmount) {
        return res.status(400).json({
          message: `El pedido mínimo es $${minOrderAmount.toLocaleString('es-CO')}. Agrega más productos para continuar.`,
          code: 'BELOW_MIN_ORDER',
          minOrderAmount,
        });
      }
    } catch (minErr) {
      logger.warn('Min order validation failed, continuing', { error: minErr.message });
    }

    // Verificar estado de la suscripción antes de permitir crear órdenes
    const {
      subscription,
      status: subscriptionStatus,
      isSuspended,
      periodEnd: periodEndDate,
      graceUntil: graceUntilDate,
      planConfig,
      commercialPlan
    } = await getSubscriptionForBusiness(businessObjectId);
    
    if (subscription) {
      logger.info('Verificación de suscripción al crear orden', {
        businessId: businessObjectId,
        subscriptionId: subscription._id,
        periodEnd: periodEndDate,
        graceUntil: graceUntilDate,
        subscriptionStatus,
        isSuspended
      });
      
      if (isSuspended) {
        logger.warn('Intento de crear orden con suscripción suspendida', { 
          businessId: businessObjectId,
          periodEnd: periodEndDate,
          graceUntil: graceUntilDate
        });
        return res.status(403).json({ 
          message: 'El menú está desactivado. La suscripción ha expirado y el período de gracia ha finalizado. Por favor, contacta al restaurante para renovar la suscripción.',
          code: 'SUBSCRIPTION_SUSPENDED',
          subscriptionStatus: 'suspended'
        });
      }
    }

    if (orderChannel === 'inapp' && !isFeatureEnabledForPlan(planConfig, 'inAppOrdering')) {
      return res.status(403).json({
        message: 'Tu plan actual no incluye pedidos en la app.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'inAppOrdering',
        plan: commercialPlan
      });
    }

    if (orderChannel === 'pos' && !isFeatureEnabledForPlan(planConfig, 'pos')) {
      return res.status(403).json({
        message: 'Tu plan actual no incluye POS.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'pos',
        plan: commercialPlan
      });
    }

    const monthStart = startOfMonthCOL();
    const monthEnd = endOfMonthCOL();
    const [activeMonthOrders, completedMonthOrders] = await Promise.all([
      Order.countDocuments({ businessId: businessObjectId, createdAt: { $gte: monthStart, $lt: monthEnd } }),
      CompletedOrder.countDocuments({ businessId: businessObjectId, createdAt: { $gte: monthStart, $lt: monthEnd } })
    ]);
    const currentMonthOrders = activeMonthOrders + completedMonthOrders;
    const orderLimitStatus = await getPlanLimitStatus({
      businessId: businessObjectId,
      resourceKey: 'monthlyOrders',
      currentCount: currentMonthOrders
    });

    if (orderLimitStatus.limitReached) {
      return res.status(403).json({
        message: orderLimitStatus.message,
        code: 'PLAN_LIMIT_REACHED',
        resource: 'monthlyOrders',
        plan: orderLimitStatus.commercialPlan,
        limit: orderLimitStatus.limitValue,
        current: currentMonthOrders
      });
    }
    
    // Generate order number
    const orderNumber = await generateOrderNumber(businessObjectId);
    
    /* Pedido rápido a crédito: solo el personal del negocio, a un cliente con
       crédito habilitado y sin pasar su cupo. Se revisa antes de tocar nada;
       el cargo se hace con el pedido ya guardado (más abajo). */
    let clienteCredito = null;
    if (req.body.usarCredito === true) {
      if (!(await personalDeEsteNegocio(req, businessObjectId))) {
        return res.status(403).json({ message: 'Solo el personal del negocio puede cargar un pedido a crédito.' });
      }
      clienteCredito = phone ? await Customer.findOne({ phone, businessId: businessObjectId }).select('name credito').lean() : null;
      if (!clienteCredito?.credito?.habilitado) {
        return res.status(400).json({ message: 'Este cliente no tiene crédito habilitado.' });
      }
      const valor = Math.round((Number(numericTotalAmount) || 0) + (orderType === 'delivery' ? Math.max(0, parseFloat(deliveryFee) || 0) : 0));
      const disponible = Math.max(0, (clienteCredito.credito.cupo || 0) - (clienteCredito.credito.saldo || 0));
      if (valor > disponible) {
        return res.status(400).json({ message: `Supera el cupo: le quedan $${disponible.toLocaleString('es-CO')} disponibles.` });
      }
    }

    // Find or create customer
    let customer = null;
    if (phone) {

      
      customer = await Customer.findOne({ phone, businessId: businessObjectId });
      
      if (customer) {

        // Update existing customer stats
        await customer.updateStats(numericTotalAmount);
      } else {

        // Create new customer
        customer = new Customer({
          businessId: businessObjectId,
          phone,
          name: customerName,
          totalOrders: 1,
          totalSpent: numericTotalAmount,
          lastOrderDate: new Date()
        });
        await customer.save();

      }
    }

    // Handle coupon validation and application
    let coupon = null;
    let discountAmount = 0;
    let finalAmount = numericTotalAmount;
    
    if (couponCode) {
      const couponResult = await applyCoupon(couponCode, businessObjectId, numericTotalAmount, orderType, items, customer);
      if (!couponResult.valid) {
        return res.status(couponResult.error.status).json({ message: couponResult.error.message });
      }
      coupon = couponResult.coupon;
      discountAmount = couponResult.discountAmount;
      finalAmount = couponResult.finalAmount;
    }

    // POS: propina y descuento manual (staff autenticado). No aplica a canales públicos.
    let tipAmount = 0;
    if (orderChannel === 'pos') {
      tipAmount = Math.max(0, Math.round(parseFloat(req.body.tipAmount) || 0));
      if (!couponCode) {
        const manualDiscount = Math.max(0, Math.round(parseFloat(req.body.discountAmount) || 0));
        if (manualDiscount > 0) {
          discountAmount = Math.min(manualDiscount, numericTotalAmount);
          finalAmount = numericTotalAmount - discountAmount;
        }
      }
      finalAmount = finalAmount + tipAmount;
    }

    /* El domicilio se suma AL FINAL, después de cupones y descuentos: no se
       descuenta sobre el envío. Va aparte de totalAmount, que por convención
       (y porque así lo valida orderPricing) contiene solo los productos.
       Antes no se sumaba nunca, así que en los pedidos a domicilio finalAmount
       —y con él la caja y el cobro— se quedaba corto por el valor del envío. */
    if (orderType === 'delivery') {
      finalAmount += Math.max(0, parseFloat(deliveryFee) || 0);
    }

    // Validate delivery fee server-side to prevent fee tampering
    if (orderType === 'delivery' && deliveryCalculated && !deliveryNeedsConfirmation && deliveryZoneInfo?.coordinates) {
      const { validateDeliveryForOrder } = require('../../services/deliveryZoneService');
      const coords = deliveryZoneInfo.coordinates;
      const point = { type: 'Point', coordinates: [parseFloat(coords.lon ?? coords.lng), parseFloat(coords.lat)] };
      try {
        const validation = await validateDeliveryForOrder(businessObjectId, point, numericTotalAmount);
        if (validation.valid && validation.coverage?.delivery?.price !== undefined) {
          const expectedFee = validation.coverage.delivery.price;
          const claimedFee = parseFloat(deliveryFee) || 0;
          if (claimedFee < expectedFee) {
            return res.status(400).json({ message: 'Tarifa de envío inválida. Por favor recarga la página e intenta de nuevo.' });
          }
        }
      } catch (err) {
        logger.warn('No se pudo re-validar tarifa de envío, continuando', { err: err.message });
      }
    }

    // Determine initial status based on ordering channel
    const isInApp = orderChannel === 'inapp';
    const isPOS = orderChannel === 'pos';
    // Cuenta abierta de mesa: solo para POS. No cobra al crear; acumula hasta pay-tab.
    const isOpenTab = isPOS && !!req.body.posOpenTab;
    const isAdmin = orderChannel === 'admin';
    const initialStatus = isPOS ? ORDER_STATUS.CONFIRMED : isAdmin ? ORDER_STATUS.CONFIRMED : isInApp ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.PENDING;
    /* Seguimiento para todo pedido que hace un cliente desde el menú, también
       los que se mandan por WhatsApp: así puede volver y ver cómo va. El POS,
       el pedido rápido y el personal no lo necesitan. */
    const customerToken = (isPOS || isAdmin || esPersonalDelNegocio(req)) ? null : generateCustomerToken();

    // Create the order
    const newOrder = new Order({
      businessId: businessObjectId,
      orderNumber,
      customerName: stripHtml(customerName),
      orderType,
      items,
      totalAmount: numericTotalAmount,
      tableNumber: tableNumber || "",
      phone: phone || "",
      customerEmail: customerEmail || "",
      address: stripHtml(address || ""),
      customerId: customer ? customer._id : null,
      couponCode: coupon ? coupon.code : null,
      couponId: coupon ? coupon._id : null,
      discountAmount,
      tipAmount,
      posOpenTab: isOpenTab,
      finalAmount,
      // In-app ordering fields
      orderChannel: orderChannel || 'whatsapp',
      /* De qué enlace vino el cliente. Se recorta y se limpia porque llega de
         la URL, que la escribe cualquiera. */
      source: source ? String(source).trim().slice(0, 40).replace(/[^\w.-]/g, '') || null : null,
      paymentMethod: clienteCredito ? 'credito' : (paymentMethod || null),
      ...(clienteCredito ? { credito: { customerId: clienteCredito._id, cargado: 0, version: 0 } } : {}),
      customerToken,
      customerNotes: stripHtml(customerNotes || ''),
      // Gift order fields
      isGift: !!isGift,
      gift: isGift ? {
        recipientName: stripHtml(gift.recipientName || ''),
        recipientPhone: stripHtml(gift.recipientPhone || ''),
        message: stripHtml(gift.message || ''),
        hidePrices: !!gift.hidePrices
      } : undefined,
      statusHistory: [{ status: initialStatus, timestamp: new Date(), note: 'Pedido creado' }],
      // Datos de zona de entrega
      deliveryFee: deliveryFee ?? null,
      deliveryZoneName: deliveryZoneName || null,
      deliveryZoneInfo: deliveryZoneInfo || null,
      deliveryCalculated: deliveryCalculated || false,
      deliveryNeedsConfirmation: deliveryNeedsConfirmation || false,
      deliveryZoneId: deliveryZoneId || null,
      // POS: persist payment info for ticket reprinting
      posPaymentInfo: isPOS && posPaymentInfo ? posPaymentInfo : undefined,
      // POS: offline sync idempotency key
      offlineId: req.body.offlineId || null,
      // Map delivery zone details to top-level fields
      deliveryCoordinates: deliveryZoneInfo?.coordinates || { lat: null, lon: null },
      deliveryDistance: deliveryZoneInfo?.distance || 0,
      estimatedDeliveryTime: deliveryZoneInfo?.estimatedTime || { min: 0, max: 0 },
      status: initialStatus,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    logger.debug('Orden creada con datos de delivery', {
      deliveryFee,
      deliveryZoneName,
      deliveryCalculated,
      deliveryNeedsConfirmation
    });
    
    const savedOrder = await newOrder.save();

    // El cargo a la cuenta del cliente, con el pedido ya guardado.
    if (clienteCredito) {
      try {
        const r = await sincronizarCreditoPedido(savedOrder.toObject(), { usuario: req.user?.name || '' });
        if (r) savedOrder.credito.cargado = valorDelPedido(savedOrder);
      } catch (errCredito) {
        logger.error('No se pudo cargar el pedido al crédito', { error: errCredito.message, orderId: savedOrder._id });
      }
    }

    /* La venta descuenta del inventario y queda registrada en el historial.
       Antes esto se hacía con un updateOne suelto que no dejaba rastro: el
       stock bajaba y nadie podía saber por qué pedido. */
    await moverStock(items || [], -1, {
      businessId: businessObjectId,
      type: 'sale',
      orderId: savedOrder._id,
      orderNumber,
      note: 'Venta',
    });

    // POS: Auto-register sale in open cash register (only for POS orders) — atomic $push.
    // Las cuentas abiertas (posOpenTab) NO cobran al crear: se registran al cobrar la mesa (pay-tab).
    if (orderChannel === 'pos' && !isOpenTab) {
      try {
        const CashRegister = require('../../Models/CashRegister');
        await CashRegister.findOneAndUpdate(
          { businessId: businessObjectId, status: 'open' },
          { $push: { movements: {
            type: 'sale',
            amount: finalAmount,
            paymentMethod: paymentMethod || 'cash',
            orderId: savedOrder._id,
            orderNumber: orderNumber,
            orderChannel: 'pos',
            description: `Venta POS #${orderNumber} - ${customerName}`,
            createdAt: new Date()
          }}}  
        );
      } catch (cashErr) {
        logger.warn('Failed to register sale in cash register', { error: cashErr.message, orderId: savedOrder._id });
      }
    }

    // Record coupon per-customer usage AFTER successful order save (global usage already recorded atomically)
    if (coupon && !coupon.__usageAlreadyRecorded) {
      try {
        await coupon.recordUsage(customer ? customer._id : null, discountAmount);
      } catch (couponErr) {
        logger.warn('Failed to record coupon usage (order was created)', { error: couponErr.message, orderId: savedOrder._id });
      }
    } else if (coupon && customer) {
      // Record per-customer usage only (global count already incremented atomically)
      try {
        const CouponModel = coupon.constructor;
        if (coupon.usageByCustomer) {
          await CouponModel.updateOne(
            { _id: coupon._id },
            { $inc: { [`usageByCustomer.${customer._id}`]: 1 } }
          );
        }
      } catch (couponErr) {
        logger.warn('Failed to record per-customer coupon usage', { error: couponErr.message });
      }
    }

    // NOTE: Loyalty points are awarded only when admin completes the order (PATCH /:id/status → completed)

    // Emit socket event
    socketService.emitToBusiness(businessObjectId.toString(), "order_created", savedOrder);
    
    // Enviar notificación push por nuevo pedido
    const { sendPushToBusinessId } = require('../../services/pushService');
    try {
      const payload = {
        title: `🆕 Nuevo Pedido #${orderNumber}`,
        body: `Nuevo pedido de ${customerName} - ${numericTotalAmount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
        clickUrl: `/admin/orders/${savedOrder._id}`,
        /* El estado real, no 'pending' fijo: un pedido del POS nace
           'confirmed' y uno del menú 'pending_payment'. Quien reaccione a
           este dato estaba recibiendo un estado que no era el del pedido. */
        data: { orderId: savedOrder._id.toString(), orderNumber, status: initialStatus }
      };
      await sendPushToBusinessId(businessObjectId.toString(), payload);
    } catch (pushError) {
      // No fallar la request si el push falla
      logger.warn('Failed to send push notification for new order', { error: pushError.message });
    }
    
    logger.info(`Created new order ${orderNumber} for business ${businessId} (channel: ${orderChannel || 'whatsapp'})`);
    
    // Mark viewer session as converted (fire and forget)
    try {
      const viewerTracker = require('../../services/viewerTracker');
      viewerTracker.markConverted(businessObjectId.toString(), phone).catch(() => {});
    } catch (_) {}
    
    res.status(201).json({
      ...savedOrder.toObject(),
      customerToken: customerToken, // Include token in response for client tracking
      /* La llave de "Mi cuenta" para el celular que pidió. Nunca cuando crea
         el pedido el personal: esa respuesta va al panel, no al cliente. */
      ...(!esPersonalDelNegocio(req) && phone
        ? { cuentaToken: emitirLlave({ businessId: businessObjectId, telefono: phone }) }
        : {}),
    });
  } catch (error) {
    logger.error("Error creating order", error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
