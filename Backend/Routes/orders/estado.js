/**
 * Pedidos — Mover un pedido de estado. `actualizarEstadoPedido` también lo usa la caja
 * (Routes/pos.js): un solo camino para el panel y el POS.
 *
 * Parte de Routes/orders/ (ver index.js para el orden de montaje).
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../../Models/Order");
const CompletedOrder = require("../../Models/CompletedOrder");
const Customer = require("../../Models/Customer");
const BusinessConfig = require("../../Models/BusinessConfig");
const socketService = require("../../services/socketService");
const { isValidObjectId } = require("../../utils/validators");
const logger = require("../../utils/logger");
const LoyaltyProgram = require('../../Models/LoyaltyProgram');
const CustomerLoyalty = require('../../Models/CustomerLoyalty');
const { ORDER_STATUS } = require('../../utils/constants');
const { tenantAuth } = require('../../middleware/tenantAuth');
const { validateUpdateOrderStatus } = require('../../middleware/validators/orderValidators');
const path = require('path');
/* El inventario se mueve en services/inventario.js: la misma operación la
   usan las ventas, las cancelaciones y las devoluciones. */
const { moverStock } = require('../../services/inventario');
const { sincronizarCreditoPedido } = require('../../services/credito');

// Update order status (admin only)
/* Cambiar el estado de un pedido.

   Es una función con nombre, y no un handler anónimo, porque la caja
   (Routes/pos.js) la usa también: los pedidos web se despachan desde el POS
   con exactamente las mismas reglas —transiciones, archivo, caja,
   fidelización, avisos al cliente— que desde el panel. Dos copias de esto
   serían dos maneras de completar un pedido que con el tiempo cobran distinto. */
async function actualizarEstadoPedido(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    
    if (!status || !["pending", "pending_payment", "payment_uploaded", "payment_confirmed", "inProgress", "completed", "ready", "preparing", "confirmed", "cancelled", "delivered"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    /* Transiciones válidas: impide retrocesos imposibles, pero sin obligar a
       pasar por estados intermedios que nadie usa.

       Antes, ningún canal podía completar un pedido desde su estado inicial:
       el POS y el pedido rápido nacen en 'confirmed', WhatsApp en 'pending', y
       desde ninguno se permitía 'completed'. Como los botones de completar sí
       estaban en pantalla, el cajero le daba y el servidor lo rechazaba.
       Eso explica que 'preparing' y 'ready' tengan CERO usos en más de 5.000
       pedidos: la gente no quiere ese trámite, quiere despachar.

       Ahora se puede completar (o entregar) desde cualquier estado en que el
       pedido ya está aceptado. Los estados de cocina siguen disponibles para
       quien los quiera usar, pero dejan de ser obligatorios.

       'pending_payment' y 'payment_uploaded' son la excepción a propósito: ahí
       nadie ha confirmado que el cliente pagó, y completar sería dar por
       cobrado algo que no lo está. */
    const FIN = ['completed', 'delivered', 'cancelled'];
    const VALID_TRANSITIONS = {
      'pending': ['confirmed', 'preparing', 'inProgress', 'ready', 'pending_payment', ...FIN],
      'pending_payment': ['payment_uploaded', 'payment_confirmed', 'cancelled'],
      'payment_uploaded': ['payment_confirmed', 'confirmed', 'preparing', 'cancelled'],
      'payment_confirmed': ['confirmed', 'preparing', 'inProgress', 'ready', ...FIN],
      'confirmed': ['preparing', 'inProgress', 'ready', ...FIN],
      'preparing': ['ready', ...FIN],
      'inProgress': ['ready', ...FIN],
      'ready': [...FIN],
      /* 'completed' es terminal. Antes decía que podía pasar a 'delivered',
         pero completar archiva el pedido a otra colección y este endpoint
         busca en la de activos: la transición devolvía 404 y por eso
         'delivered' se usó UNA vez en toda la historia. Para los domicilios,
         'delivered' sigue disponible desde los estados de arriba. */
      'completed': [],
      'delivered': [],
      'cancelled': []
    };
    
    // Fetch order first to check current status
    const tenantBizId = req.user.businessId || req.body.businessId || req.query.businessId;
    const currentOrder = await Order.findOne(
      { _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) }
    ).select('status').lean();
    
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    const allowedNext = VALID_TRANSITIONS[currentOrder.status] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({ 
        message: `No se puede cambiar de "${currentOrder.status}" a "${status}"`,
        code: 'INVALID_TRANSITION',
        currentStatus: currentOrder.status,
        allowedTransitions: allowedNext
      });
    }
    
    // Create update object
    const updateData = { 
      status,
      updatedAt: new Date(),
      $push: { statusHistory: { status, timestamp: new Date(), note: '' } }
    };
    
    // If status is changing to inProgress, set sentToKitchen to true
    if (status === "inProgress") {
      updateData.sentToKitchen = true;
    }
    
    // Update the order — compound query ensures tenant isolation
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id, ...(tenantBizId ? { businessId: tenantBizId } : {}) },
      updateData,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    /* Al cancelar se devuelve lo que se había descontado al crear el pedido.
       Antes no se devolvía nunca: cada cancelación restaba del inventario
       unidades que en realidad seguían en la nevera. */
    if (status === ORDER_STATUS.CANCELLED) {
      await moverStock(updatedOrder.items, +1, {
        businessId: updatedOrder.businessId,
        type: 'return',
        orderId: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        userId: req.user?.id,
        note: 'Pedido cancelado',
      });
      // Si usó el premio de su tarjeta de sellos, vuelve a quedar disponible
      if (updatedOrder.premioSellos && !updatedOrder.premioSellos.devuelto && updatedOrder.premioSellos.telefono) {
        try {
          const marcado = await Order.updateOne(
            { _id: updatedOrder._id, 'premioSellos.devuelto': false },
            { $set: { 'premioSellos.devuelto': true } },
          );
          if (marcado.modifiedCount) {
            await require('../../services/sellos').devolverPremio({
              businessId: updatedOrder.businessId,
              telefono: updatedOrder.premioSellos.telefono,
              motivo: `Pedido #${updatedOrder.orderNumber} cancelado`,
              orderId: updatedOrder._id,
            });
          }
        } catch (e) {
          logger.error('No se pudo devolver el premio de sellos', { error: e.message, orderId: id });
        }
      }
      // Si era a crédito, se le devuelve al cliente.
      try {
        await sincronizarCreditoPedido(updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder);
      } catch (e) {
        logger.error('No se pudo devolver el crédito del pedido cancelado', { error: e.message, orderId: id });
      }
    }

    // Emit socket event
    socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_updated", updatedOrder);
    // Emit to per-order tracking room for customer real-time updates
    socketService.emitToOrder(updatedOrder._id, 'order_status_changed', { orderId: updatedOrder._id, status: updatedOrder.status, order: updatedOrder });

    // Release the assigned domi when the order ends (delivered/completed/cancelled)
    if (["completed", "delivered", "cancelled"].includes(status) && updatedOrder.deliveryPersonId) {
      try {
        const { releaseDriver } = require('../../services/orderCompletionService');
        await releaseDriver(updatedOrder.deliveryPersonId, { delivered: status !== 'cancelled' });
        socketService.emitToBusiness(updatedOrder.businessId.toString(), 'domi:status', {
          deliveryPersonId: updatedOrder.deliveryPersonId, status: 'available'
        });
      } catch (relErr) {
        logger.warn('Failed to release driver on order end', { error: relErr.message, orderId: id });
      }
    }
    
    // Send push notification to customer about status change
    try {
      const { sendCustomerOrderStatusPush } = require('../../services/pushService');
      const pushResult = await sendCustomerOrderStatusPush(updatedOrder, status);
      if (pushResult.sent > 0) {
        logger.info(`Customer push sent for order #${updatedOrder.orderNumber} -> ${status}`, pushResult);
      }
    } catch (pushErr) {
      logger.warn('Failed to send customer push for status change', { error: pushErr.message });
    }

    // Send WhatsApp notification to customer (best-effort, queued with rate limit)
    try {
      if (updatedOrder.phone) {
        const BusinessConfig = require('../../Models/BusinessConfig');
        const biz = await BusinessConfig.findById(updatedOrder.businessId, 'businessName').lean();
        const { sendOrderStatusNotification } = require('../../services/whatsappService');
        sendOrderStatusNotification(updatedOrder, status, biz?.businessName);
      }
    } catch (waErr) {
      logger.warn('Failed to enqueue WhatsApp notification', { error: waErr.message });
    }

    // Schedule WhatsApp review request 30 min after delivery (best-effort)
    try {
      if (status === 'delivered' && updatedOrder.phone) {
        const Review = require('../../Models/Review');
        const alreadyReviewed = await Review.exists({ orderId: updatedOrder._id });
        if (!alreadyReviewed) {
          const BusinessConfig = require('../../Models/BusinessConfig');
          const bizForReview = await BusinessConfig.findById(updatedOrder.businessId, 'businessName slug').lean();
          if (bizForReview?.slug) {
            const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menuby.tech';
            const reviewLink = `${FRONTEND_URL}/${bizForReview.slug}?review=${updatedOrder._id}`;
            const reviewMsg = [
              `⭐ *${bizForReview.businessName}*`,
              '',
              '¡Gracias por tu pedido! ¿Cómo fue tu experiencia?',
              '',
              'Déjanos tu reseña (solo toma 1 min):',
              reviewLink
            ].join('\n');
            const { enqueueRaw } = require('../../services/whatsappService');
            setTimeout(() => {
              try { enqueueRaw(updatedOrder.phone, reviewMsg); } catch {}
            }, 30 * 60 * 1000);
          }
        }
      }
    } catch (reviewWaErr) {
      logger.warn('Failed to schedule WhatsApp review request', { error: reviewWaErr.message });
    }

    // If order is completed or delivered, move it to CompletedOrders collection
    if (status === "completed" || status === "delivered") {
      // Register MenuBy orders in cash register if one is open — atomic $push
      if (updatedOrder.orderChannel !== 'pos') {
        try {
          const CashRegister = require('../../Models/CashRegister');
          await CashRegister.findOneAndUpdate(
            { businessId: updatedOrder.businessId, status: 'open' },
            { $push: { movements: {
              type: 'sale',
              amount: updatedOrder.finalAmount || updatedOrder.totalAmount,
              paymentMethod: updatedOrder.paymentMethod || 'cash',
              orderId: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber,
              orderChannel: 'menuby',
              description: `MenuBy #${updatedOrder.orderNumber} - ${updatedOrder.customerName}`,
              createdAt: new Date()
            }}}
          );
        } catch (cashErr) {
          logger.warn('Failed to register MenuBy sale in cash register', { error: cashErr.message, orderId: updatedOrder._id });
        }
      }

      // Red de seguridad: cuenta abierta POS completada sin pasar por pay-tab.
      // pay-tab pone posOpenTab=false y saca la orden de Order, así que esto solo
      // se dispara si se cerró la cuenta desde Órdenes sin cobrar → registrar la venta.
      if (updatedOrder.orderChannel === 'pos' && updatedOrder.posOpenTab) {
        try {
          const CashRegister = require('../../Models/CashRegister');
          await CashRegister.findOneAndUpdate(
            { businessId: updatedOrder.businessId, status: 'open' },
            { $push: { movements: {
              type: 'sale',
              amount: updatedOrder.finalAmount || updatedOrder.totalAmount,
              paymentMethod: updatedOrder.paymentMethod || 'cash',
              orderId: updatedOrder._id,
              orderNumber: updatedOrder.orderNumber,
              orderChannel: 'pos',
              description: `Venta POS #${updatedOrder.orderNumber} - ${updatedOrder.customerName}`,
              createdAt: new Date()
            }}}
          );
        } catch (cashErr) {
          logger.warn('Failed to register POS tab sale on completion', { error: cashErr.message, orderId: updatedOrder._id });
        }
      }

      try {
        // Convert Mongoose document to plain object
        const orderData = updatedOrder.toObject();
        
        // Delete payment proof file if exists
        if (orderData.paymentProof) {
          try {
            const proofFilePath = path.join(__dirname, '..', '..', orderData.paymentProof);
            const fs = require('fs');
            if (fs.existsSync(proofFilePath)) {
              fs.unlinkSync(proofFilePath);
              logger.info(`Payment proof deleted: ${proofFilePath}`);
            }
          } catch (fileErr) {
            logger.warn('Could not delete payment proof file', { error: fileErr.message });
          }
        }
        
        // Create a new completed order (without proof path)
        const completedOrder = new CompletedOrder({
          ...orderData,
          paymentProof: null,
          completedAt: new Date(),
          status: "completed"
        });
        
        // Use transaction to atomically save completed order + delete active order
        const session = await mongoose.startSession();
        let moveSucceeded = false;
        try {
          await session.withTransaction(async () => {
            await completedOrder.save({ session });
            await Order.findByIdAndDelete(id, { session });
          });
          moveSucceeded = true;
        } catch (txErr) {
          logger.error('Transaction failed for order completion — order preserved in active', { error: txErr.message, orderId: id });
        } finally {
          session.endSession();
        }

        /* Respaldo sin transacción. Si la transacción fallaba (un conflicto
           momentáneo de la base), el pedido quedaba "completado" en la
           colección de activos: no salía ni en Pedidos ni en Terminados ni en
           las ventas del día. Se copia a terminados sin duplicar (mismo _id,
           upsert) y después se borra de activos: repetirlo no hace daño. */
        if (!moveSucceeded) {
          try {
            await CompletedOrder.updateOne(
              { _id: completedOrder._id },
              { $setOnInsert: completedOrder.toObject() },
              { upsert: true },
            );
            await Order.deleteOne({ _id: id });
            moveSucceeded = true;
            logger.warn('Pedido pasado a terminados sin transacción', { orderId: id });
          } catch (fallbackErr) {
            logger.error('No se pudo pasar el pedido a terminados', { error: fallbackErr.message, orderId: id });
          }
        }

        if (moveSucceeded) {
          // Notify clients that order was removed from active list
          setTimeout(() => {
            socketService.emitToBusiness(updatedOrder.businessId.toString(), "order_deleted", { _id: id });
          }, 3000);
        }

        // ─── Loyalty: award points on completion ───
        if (updatedOrder.customerId) {
          try {
            const loyaltyProgram = await LoyaltyProgram.findOne({ businessId: updatedOrder.businessId, isActive: true }).lean();
            if (loyaltyProgram?.mode === 'stamps') {
              // Tarjeta de sellos: un sello por pedido (si alcanza el mínimo), no puntos
              await require('../../services/sellos').sumarSello(updatedOrder, loyaltyProgram);
            } else if (loyaltyProgram) {
              const amountForPoints = updatedOrder.finalAmount || updatedOrder.totalAmount;
              let pointsToAward = Math.floor(amountForPoints / loyaltyProgram.amountPerPoints) * loyaltyProgram.pointsPerAmount;

              // Apply tier multiplier
              if (loyaltyProgram.tiersEnabled && loyaltyProgram.tiers.length) {
                const existingLoyalty = await CustomerLoyalty.findOne({ businessId: updatedOrder.businessId, customerId: updatedOrder.customerId }).lean();
                if (existingLoyalty) {
                  const sorted = [...loyaltyProgram.tiers].sort((a, b) => b.minPoints - a.minPoints);
                  const tier = sorted.find(t => existingLoyalty.totalEarned >= t.minPoints);
                  if (tier && tier.multiplier > 1) {
                    pointsToAward = Math.floor(pointsToAward * tier.multiplier);
                  }
                }
              }

              if (pointsToAward > 0) {
                const expiresAt = loyaltyProgram.pointsExpiryDays > 0
                  ? new Date(Date.now() + loyaltyProgram.pointsExpiryDays * 86400000)
                  : undefined;

                let loyalty = await CustomerLoyalty.findOne({ businessId: updatedOrder.businessId, customerId: updatedOrder.customerId });
                const isFirstOrder = !loyalty;

                if (!loyalty) {
                  const customer = await Customer.findById(updatedOrder.customerId).lean();
                  loyalty = new CustomerLoyalty({
                    businessId: updatedOrder.businessId,
                    customerId: updatedOrder.customerId,
                    phone: customer ? customer.phone : ''
                  });
                }

                loyalty.earnPoints(pointsToAward, updatedOrder._id, `Pedido #${updatedOrder.orderNumber}`, expiresAt);

                // First order bonus
                if (isFirstOrder && loyaltyProgram.firstOrderBonus > 0) {
                  loyalty.earnPoints(loyaltyProgram.firstOrderBonus, updatedOrder._id, 'Bonus primer pedido', expiresAt);
                }

                // Compute tier
                if (loyaltyProgram.tiersEnabled && loyaltyProgram.tiers.length) {
                  loyalty.computeTier(loyaltyProgram.tiers);
                }

                await loyalty.save();
                logger.info(`Loyalty points awarded on completion: ${pointsToAward} pts for order #${updatedOrder.orderNumber}`);
              }
            }
          } catch (loyaltyErr) {
            logger.warn('Failed to award loyalty points on order completion', { error: loyaltyErr.message, orderId: updatedOrder._id });
          }
        }

        // Wait a bit to ensure clients receive the update before removing from active orders
        // (delete already handled inside transaction above)
      } catch (err) {
        logger.error('Error saving completed order', { error: err.message, orderId: id });
        // Continue with response even if saving to CompletedOrder fails
      }
    }
    
    res.json(updatedOrder);
  } catch (error) {
    logger.error('Error updating order status', { error: error.message, orderId: req.params.id });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

router.patch("/:id/status", tenantAuth, validateUpdateOrderStatus, actualizarEstadoPedido);

module.exports = router;
module.exports.actualizarEstadoPedido = actualizarEstadoPedido;
