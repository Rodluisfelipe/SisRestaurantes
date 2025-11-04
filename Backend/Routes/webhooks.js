const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const wompiService = require('../services/wompiService');
const { emitToBusiness } = require('../services/socketService');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

/**
 * Webhook de Wompi para recibir confirmaciones de pago
 * POST /api/webhooks/wompi
 * 
 * Eventos soportados:
 * - TRANSACTION_APPROVED: Pago exitoso → activar suscripción
 * - TRANSACTION_DECLINED: Pago rechazado → marcar como fallido
 */
router.post('/wompi', express.json(), async (req, res) => {
  // Responder 200 OK inmediatamente para evitar timeouts
  res.status(200).json({ received: true });
  
  try {
    const event = req.body;
    
    if (!event || !event.event) {
      logger.warn('Wompi webhook: Invalid event format', { body: req.body });
      return;
    }
    
    // Validar firma del webhook (seguridad)
    const signature = req.headers['x-wompi-signature'] || req.headers['signature'];
    if (signature && !wompiService.verifyWebhookSignature(event, signature)) {
      logger.error('Invalid Wompi webhook signature', { 
        signature: signature?.substring(0, 20) + '...',
        eventId: event.data?.transaction?.id 
      });
      return;
    }
    
    logger.info('Wompi webhook received', { 
      event: event.event,
      transactionId: event.data?.transaction?.id 
    });
    
    // Buscar suscripción por transactionId o reference
    const transactionId = event.data?.transaction?.id;
    const reference = event.data?.transaction?.reference;
    
    if (!transactionId && !reference) {
      logger.warn('Wompi webhook: No transactionId or reference found', { event });
      return;
    }
    
    // Buscar suscripción por wompiTransactionId o wompiReference
    const subscription = await Subscription.findOne({
      $or: [
        { wompiTransactionId: transactionId },
        { wompiReference: reference }
      ]
    }).populate('businessId', 'businessName slug adminEmail');
    
    if (!subscription) {
      logger.warn('Subscription not found for Wompi transaction', { 
        transactionId, 
        reference 
      });
      return;
    }
    
    // Verificar que no se haya procesado ya (idempotencia)
    if (event.event === 'TRANSACTION_APPROVED') {
      if (subscription.paymentStatus === 'paid' && subscription.status === 'active') {
        logger.info('Transaction already processed', { 
          subscriptionId: subscription._id,
          transactionId 
        });
        return;
      }
    }
    
    // Procesar según el tipo de evento
    if (event.event === 'TRANSACTION_APPROVED') {
      // ✅ PAGO EXITOSO → REACTIVAR SUSCRIPCIÓN
      
      // Calcular nuevas fechas según planType
      const now = new Date();
      const startDate = now;
      let endDate = new Date(startDate);
      
      if (subscription.planType === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      
      // Calcular gracePeriodEnd (1 día después de endDate)
      const gracePeriodEnd = new Date(endDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
      
      // Actualizar suscripción
      subscription.status = 'active';
      subscription.paymentStatus = 'paid';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.gracePeriodEnd = gracePeriodEnd;
      subscription.wompiTransactionId = transactionId;
      subscription.wompiReference = reference || subscription.wompiReference;
      subscription.paymentMethod = event.data?.transaction?.payment_method?.type || 'CARD';
      subscription.lastPaymentAttempt = now;
      subscription.isActive = true;
      
      await subscription.save();
      
      logger.info('✅ Subscription activated via Wompi webhook', { 
        subscriptionId: subscription._id, 
        businessId: subscription.businessId._id,
        transactionId,
        planType: subscription.planType,
        endDate: subscription.endDate
      });
      
      // Emitir evento socket al negocio para actualizar UI en tiempo real
      emitToBusiness(subscription.businessId._id.toString(), 'subscription_activated', {
        subscriptionId: subscription._id,
        planType: subscription.planType,
        endDate: subscription.endDate,
        status: 'active'
      });
      
      // TODO: Enviar email de confirmación
      // await sendEmail({
      //   to: subscription.businessId.adminEmail,
      //   subject: 'Suscripción activada',
      //   template: 'subscription-activated',
      //   data: { subscription }
      // });
      
    } else if (event.event === 'TRANSACTION_DECLINED' || event.event === 'TRANSACTION_VOIDED') {
      // ❌ PAGO RECHAZADO/CANCELADO → MARCAR COMO FALLIDO
      
      subscription.paymentStatus = 'failed';
      subscription.lastPaymentAttempt = new Date();
      
      // Solo cambiar status si estaba pendiente
      if (subscription.status === 'pending') {
        subscription.status = 'cancelled';
      }
      
      await subscription.save();
      
      logger.info('❌ Subscription payment failed via Wompi webhook', { 
        subscriptionId: subscription._id,
        transactionId,
        event: event.event
      });
      
      // Emitir evento socket
      emitToBusiness(subscription.businessId._id.toString(), 'subscription_payment_failed', {
        subscriptionId: subscription._id,
        reason: event.event
      });
      
    } else {
      logger.debug('Wompi webhook event not processed', { 
        event: event.event,
        transactionId 
      });
    }
    
  } catch (error) {
    logger.error('Error processing Wompi webhook', error);
    // No lanzar error para evitar que Wompi reintente
  }
});

/**
 * Endpoint de callback manual (por si el usuario regresa sin webhook)
 * GET /api/webhooks/wompi/callback?transactionId=xxx
 */
router.get('/wompi/callback', async (req, res) => {
  try {
    const { transactionId, reference } = req.query;
    
    if (!transactionId) {
      return res.status(400).json(formatHttpError(req, 'transactionId es requerido', 400));
    }
    
    // Primero intentar buscar la suscripción por transactionId
    let subscription = await Subscription.findOne({ 
      wompiTransactionId: transactionId 
    });
    
    // Si no se encuentra y tenemos reference en query, buscar por reference
    if (!subscription && reference) {
      logger.debug('Searching subscription by reference', { reference }, req);
      subscription = await Subscription.findOne({ 
        wompiReference: reference 
      });
      if (subscription) {
        logger.info('Subscription found by reference', { 
          subscriptionId: subscription._id,
          reference,
          businessId: subscription.businessId
        }, req);
      } else {
        logger.warn('Subscription not found by reference, trying partial match', { reference }, req);
        // Intentar buscar por parte de la reference (por si hay algún problema de formato)
        const referencePrefix = reference.split('_').slice(0, 2).join('_'); // SUB_68dcac91ee3c0da327230ea2
        if (referencePrefix) {
          subscription = await Subscription.findOne({
            wompiReference: { $regex: new RegExp(`^${referencePrefix}`) }
          }).sort({ lastPaymentAttempt: -1 });
          if (subscription) {
            logger.info('Subscription found by reference prefix', { 
              subscriptionId: subscription._id,
              referencePrefix,
              actualReference: subscription.wompiReference
            }, req);
          }
        }
      }
    }
    
    // Si aún no se encuentra, intentar obtener el estado de Wompi para obtener la reference
    let transactionStatus = null;
    if (!subscription) {
      try {
        transactionStatus = await wompiService.getTransactionStatus(transactionId);
        
        // Buscar por reference si la transacción existe en Wompi
        if (transactionStatus && transactionStatus.reference) {
          subscription = await Subscription.findOne({ 
            wompiReference: transactionStatus.reference 
          });
        }
      } catch (error) {
        // Si Wompi devuelve 404, buscar por suscripciones recientes con lastPaymentAttempt reciente
        logger.debug('Transaction not found in Wompi yet, searching recent subscriptions', { transactionId }, req);
        
        // Buscar suscripciones que hayan intentado pago recientemente (últimos 10 minutos)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        logger.debug('Searching recent subscriptions', { 
          transactionId,
          tenMinutesAgo,
          reference 
        }, req);
        
        subscription = await Subscription.findOne({
          lastPaymentAttempt: { $gte: tenMinutesAgo },
          wompiReference: { $exists: true, $ne: null }
        }).sort({ lastPaymentAttempt: -1 });
        
        if (subscription) {
          logger.info('Subscription found by recent payment attempt', { 
            subscriptionId: subscription._id,
            wompiReference: subscription.wompiReference,
            lastPaymentAttempt: subscription.lastPaymentAttempt
          }, req);
        } else {
          logger.warn('No recent subscriptions found', { 
            transactionId,
            reference 
          }, req);
        }
      }
    }
    
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'Suscripción no encontrada para esta transacción', 404));
    }
    
    // Si la suscripción aún no tiene wompiTransactionId, actualizarlo
    if (!subscription.wompiTransactionId && transactionId) {
      subscription.wompiTransactionId = transactionId;
      await subscription.save();
    }
    
    // Si aún no tenemos transactionStatus y la suscripción existe, intentar obtenerlo
    if (!transactionStatus) {
      try {
        transactionStatus = await wompiService.getTransactionStatus(transactionId);
      } catch (error) {
        // Si no podemos obtener el estado, continuar con la información de la suscripción
        logger.debug('Could not fetch transaction status, using subscription data', { transactionId }, req);
      }
    }
    
    // Si tenemos transactionStatus y está aprobado, activar la suscripción
    // También verificar si ya está activa pero el frontend solo necesita confirmación
    if (transactionStatus && transactionStatus.status === 'APPROVED') {
      const shouldActivate = subscription.paymentStatus !== 'paid' || subscription.status !== 'active';
      
      if (shouldActivate) {
        const now = new Date();
        let endDate = new Date(now);
        
        if (subscription.planType === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
        
        // Usar findByIdAndUpdate para asegurar que se guarde
        const updateData = {
          status: 'active',
          paymentStatus: 'paid',
          startDate: now,
          endDate: endDate,
          gracePeriodEnd: new Date(endDate.getTime() + 24 * 60 * 60 * 1000), // +1 día
          wompiTransactionId: transactionId
        };
        
        const updated = await Subscription.findByIdAndUpdate(
          subscription._id,
          { $set: updateData },
          { new: true }
        );
        
        if (!updated) {
          logger.error('Failed to activate subscription', {
            subscriptionId: subscription._id,
            transactionId
          }, req);
          return res.status(500).json(formatHttpError(req, 'Error al activar la suscripción', 500));
        }
        
        logger.info('Subscription activated via callback', { 
          subscriptionId: updated._id,
          transactionId,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          endDate: updated.endDate
        }, req);
        
        return res.json({
          success: true,
          message: 'Pago confirmado y suscripción activada',
          transactionStatus: 'APPROVED',
          subscriptionStatus: updated.status,
          paymentStatus: updated.paymentStatus,
          subscription: {
            status: updated.status,
            endDate: updated.endDate
          }
        });
      } else {
        // Ya está activa, solo confirmar
        logger.info('Subscription already active, confirming payment', {
          subscriptionId: subscription._id,
          transactionId,
          currentStatus: subscription.status,
          currentPaymentStatus: subscription.paymentStatus
        }, req);
      }
    }
    
    // Si llegamos aquí y tenemos transactionStatus APPROVED pero la suscripción no está activa,
    // significa que la activación anterior falló. Intentar activar nuevamente.
    if (transactionStatus && transactionStatus.status === 'APPROVED' && 
        (subscription.status !== 'active' || subscription.paymentStatus !== 'paid')) {
      logger.warn('Transaction APPROVED but subscription not active, forcing activation', {
        subscriptionId: subscription._id,
        transactionId,
        currentStatus: subscription.status,
        currentPaymentStatus: subscription.paymentStatus
      }, req);
      
      const now = new Date();
      let endDate = new Date(now);
      
      if (subscription.planType === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      
      const updateData = {
        status: 'active',
        paymentStatus: 'paid',
        startDate: now,
        endDate: endDate,
        gracePeriodEnd: new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
        wompiTransactionId: transactionId
      };
      
      const updated = await Subscription.findByIdAndUpdate(
        subscription._id,
        { $set: updateData },
        { new: true }
      );
      
      if (updated) {
        logger.info('Subscription force-activated', {
          subscriptionId: updated._id,
          transactionId,
          status: updated.status,
          paymentStatus: updated.paymentStatus
        }, req);
        
        return res.json({
          success: true,
          message: 'Pago confirmado y suscripción activada',
          transactionStatus: 'APPROVED',
          subscriptionStatus: updated.status,
          paymentStatus: updated.paymentStatus
        });
      }
    }
    
    // Devolver estado actual
    return res.json({
      success: true,
      transactionStatus: transactionStatus?.status || 'PENDING',
      subscriptionStatus: subscription.status,
      paymentStatus: subscription.paymentStatus,
      message: transactionStatus ? 'Estado de transacción obtenido' : 'Transacción pendiente de procesamiento en Wompi'
    });
    
  } catch (error) {
    logger.error('Error in Wompi callback', error, req);
    res.status(500).json(formatHttpError(req, 'Error al verificar el pago', 500));
  }
});

module.exports = router;

