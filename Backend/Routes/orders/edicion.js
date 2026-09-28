/**
 * Pedidos — Cambiar un pedido ya creado: agregar o editar productos, envío,
 * reimpresión de cambios y mandarlo a cocina.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const Order = require("../../Models/Order");
const socketService = require("../../services/socketService");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../../utils/subscriptionHelper');
const { tenantAuth } = require('../../middleware/tenantAuth');
const { validateSendToKitchen } = require('../../middleware/validators/orderValidators');
const { stripHtml } = require('../../utils/sanitize');
/* El inventario se mueve en services/inventario.js: la misma operación la
   usan las ventas, las cancelaciones y las devoluciones. */
const { moverStock } = require('../../services/inventario');
const { sincronizarCreditoPedido } = require('../../services/credito');
const { lineTotal } = require('./compartido');

// Add items to an existing active order (admin only)
router.patch("/:id/add-items", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and cannot be empty" });
    }

    // Validate each item
    for (const item of items) {
      if (!item.name || !item.quantity || item.quantity < 1 || item.price == null) {
        return res.status(400).json({ message: "Each item must have name, quantity (>= 1), and price" });
      }
    }

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;

    // Find the active order
    const order = await Order.findOne({
      _id: id,
      ...(tenantBizId ? { businessId: tenantBizId } : {})
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Don't allow adding items to completed/cancelled/delivered orders
    if (['completed', 'cancelled', 'delivered'].includes(order.status)) {
      return res.status(400).json({ message: "Cannot add items to a completed, cancelled, or delivered order" });
    }

    // Sanitize and build new items
    const newItems = items.map(item => ({
      productId: item.productId || undefined,
      name: stripHtml(String(item.name)),
      price: Number(item.price),
      quantity: Number(item.quantity),
      selectedToppings: Array.isArray(item.selectedToppings) ? item.selectedToppings : [],
      isLoyaltyReward: false,
    }));

    // Calculate new total for the added items
    const addedTotal = newItems.reduce((sum, item) => {
      const toppingsPrice = (item.selectedToppings || []).reduce((ts, t) => {
        let tp = Number(t.price) || 0;
        if (t.subGroups) {
          tp += t.subGroups.reduce((ss, sg) => ss + (Number(sg.price) || 0), 0);
        }
        return ts + tp;
      }, 0);
      return sum + (item.price + toppingsPrice) * item.quantity;
    }, 0);

    /* Se acumula para la comanda de cambios en vez de imprimir aquí: el admin
       suele agregar varias cosas seguidas y saldría un papel por cada una. */
    for (const it of newItems) {
      order.pendingKitchenChanges.push({ text: `AGREGAR: ${it.name}`, qty: it.quantity, at: new Date() });
    }

    // Lo agregado también sale del inventario: antes solo descontaba al crear
    await moverStock(newItems, -1, {
      businessId: order.businessId,
      type: 'sale',
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: req.user?.id,
      note: 'Productos agregados al pedido',
    });

    // Push new items and update totals
    order.items.push(...newItems);
    order.totalAmount = (order.totalAmount || 0) + addedTotal;

    // Recalculate finalAmount (total + delivery - discount)
    order.finalAmount = order.totalAmount + (order.deliveryFee || 0) - (order.discountAmount || 0);
    order.updatedAt = new Date();

    await order.save();
    try { await sincronizarCreditoPedido(order.toObject()); } catch (e) { logger.error('No se pudo ajustar el crédito del pedido', { error: e.message, orderId: order._id }); }

    // Emit socket event so dashboards update in real time
    socketService.emitToBusiness(order.businessId.toString(), "order_updated", order);
    socketService.emitToOrder(order._id, 'order_status_changed', { orderId: order._id, status: order.status, order });

    // Emit print event for the added items only (so kitchen gets the new items)
    socketService.emitToBusiness(order.businessId.toString(), "order_items_added", {
      orderId: order._id,
      orderNumber: order.orderNumber,
      addedItems: newItems,
      addedTotal
    });

    res.json(order);
  } catch (error) {
    logger.error('Error adding items to order', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * PATCH /orders/:id/items — cambiar la cantidad de una línea o quitarla.
 *
 * Para cuando el cliente cambia de opinión con el pedido ya tomado. Hasta
 * ahora solo se podían agregar productos: quitar obligaba a cancelar el
 * pedido entero y volver a montarlo.
 *
 * body: { businessId, itemId, quantity }  — quantity 0 quita la línea.
 */
router.patch("/:id/items", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;
    const quantity = Number(req.body.quantity);

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    if (!itemId) {
      return res.status(400).json({ message: "itemId es requerido" });
    }
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) {
      return res.status(400).json({ message: "La cantidad debe ser un entero entre 0 y 999" });
    }

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({
      _id: id,
      ...(tenantBizId ? { businessId: tenantBizId } : {})
    });

    if (!order) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }
    if (['completed', 'cancelled', 'delivered'].includes(order.status)) {
      return res.status(400).json({ message: "No se puede modificar un pedido completado, entregado o cancelado" });
    }

    /* Si el pedido ya entró a la caja, cambiar su valor descuadraría el conteo
       del turno sin que el cajero se entere. Se bloquea aquí en vez de dejar
       que la diferencia aparezca al cerrar. */
    const CashRegister = require('../../Models/CashRegister');
    const yaEnCaja = await CashRegister.findOne({
      businessId: order.businessId,
      status: 'open',
      'movements.orderId': order._id,
    }).select('_id').lean();
    if (yaEnCaja) {
      return res.status(409).json({
        message: 'Este pedido ya fue cobrado y registrado en la caja. Para cambiarlo, registra un reembolso o un movimiento de ajuste.',
        code: 'ORDER_IN_CASH_REGISTER',
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Ese producto no está en el pedido" });
    }

    /* Se guarda también el productId: al quitar la línea con .pull() el
       subdocumento queda desasociado y ya no se le puede leer. */
    const antes = { name: item.name, quantity: item.quantity, productId: item.productId };

    if (quantity === 0) {
      if (order.items.length === 1) {
        return res.status(400).json({
          message: 'Es el único producto del pedido. Si el cliente ya no quiere nada, cancela el pedido.',
          code: 'LAST_ITEM',
        });
      }
      order.items.pull(itemId);
    } else {
      item.quantity = quantity;
    }

    const nota = quantity === 0
      ? `Se quitó ${antes.name} (x${antes.quantity})`
      : `${antes.name}: ${antes.quantity} → ${quantity}`;

    /* El inventario sigue al cambio: quitar una línea devuelve todas sus
       unidades, bajar la cantidad devuelve la diferencia, y subirla descuenta.
       Sin esto, editar un pedido dejaba el conteo desviado. */
    const diferencia = antes.quantity - quantity;   // >0 sobran, <0 faltan
    if (diferencia !== 0 && antes.productId) {
      await moverStock(
        [{ productId: antes.productId, quantity: Math.abs(diferencia), name: antes.name }],
        diferencia > 0 ? +1 : -1,
        {
          businessId: order.businessId,
          type: diferencia > 0 ? 'return' : 'sale',
          orderId: order._id,
          orderNumber: order.orderNumber,
          userId: req.user?.id,
          note: nota,
        }
      );
    }

    // Se recalcula sobre todas las líneas, no se ajusta la diferencia: así el
    // total no puede quedar arrastrando un error de un cambio anterior.
    order.totalAmount = order.items.reduce((sum, it) => sum + lineTotal(it), 0);
    order.finalAmount = order.totalAmount
      + (order.deliveryFee || 0)
      - (order.discountAmount || 0)
      + (order.tipAmount || 0);
    order.updatedAt = new Date();

    order.statusHistory.push({ status: order.status, timestamp: new Date(), note: nota });

    /* No se imprime aquí: si el admin ajusta tres líneas saldrían tres
       comandas y en cocina serían imposibles de seguir. Se acumula y él
       imprime una sola cuando termina. */
    let linea, unidades;
    if (quantity === 0) {
      linea = `ANULAR: ${antes.name}`;
      unidades = antes.quantity;
    } else if (quantity > antes.quantity) {
      linea = `AGREGAR: ${antes.name} (queda en ${quantity})`;
      unidades = quantity - antes.quantity;
    } else {
      linea = `QUITAR: ${antes.name} (queda en ${quantity})`;
      unidades = antes.quantity - quantity;
    }
    order.pendingKitchenChanges.push({ text: linea, qty: unidades, at: new Date() });

    await order.save();
    try { await sincronizarCreditoPedido(order.toObject()); } catch (e) { logger.error('No se pudo ajustar el crédito del pedido', { error: e.message, orderId: order._id }); }

    logger.info('Pedido modificado', { orderId: order._id.toString(), orderNumber: order.orderNumber, cambio: nota });

    socketService.emitToBusiness(order.businessId.toString(), "order_updated", order);
    socketService.emitToOrder(order._id, 'order_status_changed', { orderId: order._id, status: order.status, order });

    res.json(order);
  } catch (error) {
    logger.error('Error modificando productos del pedido', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * PATCH /orders/:id/envio — despachar un pedido con transportadora y guía.
 *
 * Para las tiendas que mandan fuera de la ciudad. Hasta ahora el número de
 * guía se lo pasaban al cliente por WhatsApp y se perdía en la conversación;
 * aquí queda pegado al pedido, lo ve el cliente en su seguimiento y no
 * depende de que alguien lo vuelva a escribir.
 *
 * La URL de rastreo la manda el panel. Cuando se conecte la lógica de
 * transportadoras, es esta llamada la que la va a traer resuelta: el resto del
 * sistema ya solo lee `order.envio`.
 *
 * body: { businessId?, transportadora, guia, urlRastreo? }
 */
router.patch("/:id/envio", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const transportadora = String(req.body.transportadora || '').trim().slice(0, 40);
    const guia = String(req.body.guia || '').trim().slice(0, 60);
    if (!transportadora || !guia) {
      return res.status(400).json({ message: "La transportadora y el número de guía son obligatorios" });
    }

    const urlRastreo = String(req.body.urlRastreo || '').trim().slice(0, 400);
    if (urlRastreo && !/^https:\/\//i.test(urlRastreo)) {
      // Un enlace de rastreo que no sea https va directo al cliente: no se acepta a medias.
      return res.status(400).json({ message: "El enlace de rastreo debe empezar por https://" });
    }

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({
      _id: id,
      ...(tenantBizId ? { businessId: tenantBizId } : {})
    });
    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

    order.envio = { transportadora, guia, urlRastreo, despachadoAt: new Date() };

    /* Despachar es un hecho, no una intención: si el pedido seguía esperando,
       a partir de aquí va en camino. */
    if (['pending', 'confirmed', 'preparing'].includes(order.status)) {
      order.status = 'inProgress';
      order.statusHistory.push({
        status: 'inProgress',
        timestamp: new Date(),
        note: `Despachado por ${transportadora} · guía ${guia}`,
      });
    }

    await order.save();

    socketService.emitToBusiness(String(order.businessId), 'order_updated', order);
    socketService.emitToOrder(String(order._id), 'order_updated', order);

    logger.info('Pedido despachado', { orderId: id, transportadora });
    res.json(order);
  } catch (error) {
    logger.error('Error despachando el pedido', error, req);
    res.status(500).json({ message: 'No se pudo registrar el envío' });
  }
});

/**
 * POST /orders/:id/print-changes — comanda con los cambios acumulados.
 *
 * Se imprime cuando el admin termina de ajustar, no en cada clic: quitar tres
 * productos sacaría tres papeles y en cocina serían imposibles de seguir.
 *
 * Sale como comanda normal a propósito, para que funcione con los agentes ya
 * instalados sin recompilar el binario ni actualizarlo en cada negocio.
 */
router.post("/:id/print-changes", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const order = await Order.findOne({
      _id: id,
      ...(tenantBizId ? { businessId: tenantBizId } : {})
    });

    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

    const cambios = order.pendingKitchenChanges || [];
    if (cambios.length === 0) {
      return res.status(400).json({ message: 'No hay cambios pendientes de avisar a cocina', code: 'NO_CHANGES' });
    }

    const { printEmitter } = require('../../services/socketService');
    printEmitter.emit(`print:${order.businessId.toString()}`, {
      _id: order._id,
      orderNumber: `${order.orderNumber} CAMBIOS`,
      customerName: '*** CAMBIOS EN EL PEDIDO ***',
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      createdAt: new Date().toISOString(),
      items: cambios.map(c => ({ name: c.text, quantity: c.qty || 1, selectedToppings: [] })),
      totalAmount: order.totalAmount,
      isCorrection: true,
    });

    order.pendingKitchenChanges = [];
    order.updatedAt = new Date();
    await order.save();

    logger.info('Comanda de cambios enviada', { orderId: order._id.toString(), orderNumber: order.orderNumber, cambios: cambios.length });
    socketService.emitToBusiness(order.businessId.toString(), "order_updated", order);

    res.json({ message: 'Comanda enviada a la impresora', printed: cambios.length, order });
  } catch (error) {
    logger.error('Error imprimiendo cambios del pedido', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Send order to kitchen without changing status (admin only)
router.patch("/:id/send-to-kitchen", tenantAuth, validateSendToKitchen, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const tenantBizIdKitchen = req.user.businessId || req.body.businessId || req.query.businessId;
    const existingOrder = await Order.findOne(
      { _id: id, ...(tenantBizIdKitchen ? { businessId: tenantBizIdKitchen } : {}) },
      { businessId: 1 }
    ).lean();

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const { planConfig, commercialPlan } = await getSubscriptionForBusiness(existingOrder.businessId);
    if (!isFeatureEnabledForPlan(planConfig, 'kds')) {
      return res.status(403).json({
        message: 'Tu plan actual no incluye KDS.',
        code: 'PLAN_FEATURE_NOT_AVAILABLE',
        feature: 'kds',
        plan: commercialPlan
      });
    }
    
    // Update only the sentToKitchen field — compound query ensures tenant isolation
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizIdKitchen ? { businessId: tenantBizIdKitchen } : {}) },
      { 
        sentToKitchen: true,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });
    
    res.json(updatedOrder);
  } catch (error) {

    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
