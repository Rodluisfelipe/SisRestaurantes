const cron = require('node-cron');
const Subscription = require('../Models/Subscription');
const { sendPushToBusinessId } = require('./pushService');
const logger = require('../utils/logger');

/**
 * Servicio de recordatorios automáticos de suscripción.
 * 
 * Envía push notifications a los negocios cuando su suscripción está por vencer.
 * Recordatorios: 7 días, 3 días, 1 día antes del vencimiento, y día del vencimiento.
 * 
 * También notifica cuando entra en período de gracia y cuando se suspende.
 */

// Días antes del vencimiento en que se envían recordatorios
const REMINDER_DAYS = [7, 3, 1, 0];

/**
 * Normaliza una fecha a medianoche (00:00:00) para comparar solo por día.
 */
function normalizeDate(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calcula la diferencia en días entre dos fechas (solo parte de día).
 */
function daysDiff(dateA, dateB) {
  const a = normalizeDate(dateA);
  const b = normalizeDate(dateB);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Busca suscripciones que necesitan recordatorio y envía notificaciones.
 */
async function checkSubscriptionReminders() {
  try {
    const now = new Date();
    const today = normalizeDate(now);

    // Buscar suscripciones activas con periodEnd definido
    // Incluir las que tienen periodEnd entre hoy y 8 días en el futuro
    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + 8);

    const subscriptions = await Subscription.find({
      periodEnd: { $gte: today, $lte: futureLimit },
      $or: [
        { status: 'active' },
        { status: { $exists: false } }
      ]
    }).populate('businessId', 'name slug');

    logger.info(`[SubscriptionCron] Verificando ${subscriptions.length} suscripción(es) próximas a vencer`);
    console.log(`[SubscriptionCron] Verificando ${subscriptions.length} suscripción(es) próximas a vencer`);

    let notificationsSent = 0;

    for (const sub of subscriptions) {
      try {
        const daysUntilExpiry = daysDiff(today, sub.periodEnd);

        // Solo enviar si coincide con uno de los días de recordatorio
        if (!REMINDER_DAYS.includes(daysUntilExpiry)) continue;

        const businessName = sub.businessId?.name || 'tu negocio';
        const businessId = sub.businessId?._id || sub.businessId;

        if (!businessId) continue;

        let title, body;

        if (daysUntilExpiry === 0) {
          title = '⚠️ Tu suscripción vence HOY';
          body = `La suscripción de ${businessName} vence hoy. Realiza tu pago para evitar la suspensión del servicio.`;
        } else if (daysUntilExpiry === 1) {
          title = '🔔 Tu suscripción vence MAÑANA';
          body = `La suscripción de ${businessName} vence mañana. Realiza tu pago para mantener el servicio activo.`;
        } else if (daysUntilExpiry === 3) {
          title = '📅 Tu suscripción vence en 3 días';
          body = `La suscripción de ${businessName} vence en 3 días. Te recomendamos realizar el pago pronto.`;
        } else if (daysUntilExpiry === 7) {
          title = '📢 Recordatorio de suscripción';
          body = `La suscripción de ${businessName} vence en 7 días. Planifica tu pago con anticipación.`;
        }

        if (title && body) {
          const payload = {
            title,
            body,
            clickUrl: '/admin/subscription',
            data: {
              type: 'subscription_reminder',
              daysUntilExpiry,
              subscriptionId: sub._id.toString(),
              businessId: businessId.toString()
            }
          };

          const result = await sendPushToBusinessId(businessId, payload);
          if (result.sent > 0) {
            notificationsSent++;
            logger.info(`[SubscriptionCron] Recordatorio enviado a ${businessName} (${daysUntilExpiry} días para vencer) - ${result.sent} notificación(es)`);
          }
        }
      } catch (err) {
        logger.error(`[SubscriptionCron] Error procesando suscripción ${sub._id}:`, err);
      }
    }

    // También verificar suscripciones que acaban de entrar en gracia (vencieron ayer)
    await checkGraceNotifications(today);

    // También verificar suscripciones que se acaban de suspender
    await checkSuspendedNotifications(today);

    logger.info(`[SubscriptionCron] Completado: ${notificationsSent} recordatorio(s) enviado(s)`);
    return notificationsSent;
  } catch (error) {
    logger.error('[SubscriptionCron] Error en checkSubscriptionReminders:', error);
    return 0;
  }
}

/**
 * Notifica a negocios que acaban de entrar en período de gracia
 * (su periodEnd fue ayer, ahora están en grace).
 */
async function checkGraceNotifications(today) {
  try {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Suscripciones cuyo periodEnd fue ayer (acaban de entrar en gracia)
    const dayAfterYesterday = new Date(yesterday);
    dayAfterYesterday.setDate(dayAfterYesterday.getDate() + 1);

    const graceSubs = await Subscription.find({
      periodEnd: { $gte: yesterday, $lt: dayAfterYesterday },
      graceUntil: { $gte: today }
    }).populate('businessId', 'name slug');

    for (const sub of graceSubs) {
      try {
        const businessName = sub.businessId?.name || 'tu negocio';
        const businessId = sub.businessId?._id || sub.businessId;
        if (!businessId) continue;

        // Calcular cuántas horas quedan de gracia
        const graceHoursLeft = Math.max(0, Math.round((sub.graceUntil - new Date()) / (1000 * 60 * 60)));

        const payload = {
          title: '🚨 Suscripción vencida - Período de gracia',
          body: `${businessName}: tu suscripción ha vencido. Tienes ${graceHoursLeft} hora(s) de gracia para realizar el pago antes de la suspensión.`,
          clickUrl: '/admin/subscription',
          data: {
            type: 'subscription_grace',
            subscriptionId: sub._id.toString(),
            businessId: businessId.toString()
          }
        };

        await sendPushToBusinessId(businessId, payload);
        logger.info(`[SubscriptionCron] Notificación de gracia enviada a ${businessName}`);
      } catch (err) {
        logger.error(`[SubscriptionCron] Error en notificación de gracia para ${sub._id}:`, err);
      }
    }
  } catch (error) {
    logger.error('[SubscriptionCron] Error en checkGraceNotifications:', error);
  }
}

/**
 * Notifica a negocios cuya suscripción se acaba de suspender
 * (graceUntil fue ayer).
 */
async function checkSuspendedNotifications(today) {
  try {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayAfterYesterday = new Date(yesterday);
    dayAfterYesterday.setDate(dayAfterYesterday.getDate() + 1);

    const suspendedSubs = await Subscription.find({
      graceUntil: { $gte: yesterday, $lt: dayAfterYesterday }
    }).populate('businessId', 'name slug');

    for (const sub of suspendedSubs) {
      try {
        const businessName = sub.businessId?.name || 'tu negocio';
        const businessId = sub.businessId?._id || sub.businessId;
        if (!businessId) continue;

        const payload = {
          title: '🔴 Servicio suspendido',
          body: `${businessName}: tu suscripción ha sido suspendida por falta de pago. Realiza el pago para reactivar tu servicio.`,
          clickUrl: '/admin/subscription',
          data: {
            type: 'subscription_suspended',
            subscriptionId: sub._id.toString(),
            businessId: businessId.toString()
          }
        };

        await sendPushToBusinessId(businessId, payload);
        logger.info(`[SubscriptionCron] Notificación de suspensión enviada a ${businessName}`);
      } catch (err) {
        logger.error(`[SubscriptionCron] Error en notificación de suspensión para ${sub._id}:`, err);
      }
    }
  } catch (error) {
    logger.error('[SubscriptionCron] Error en checkSuspendedNotifications:', error);
  }
}

/**
 * Inicia el cron job de recordatorios de suscripción.
 * Se ejecuta todos los días a las 9:00 AM (hora del servidor).
 */
function startSubscriptionCron() {
  // Ejecutar todos los días a las 9:00 AM
  const task = cron.schedule('0 9 * * *', async () => {
    logger.info('[SubscriptionCron] Ejecutando verificación diaria de suscripciones...');
    await checkSubscriptionReminders();
  }, {
    timezone: 'America/Bogota' // Zona horaria de Colombia
  });

  logger.info('✅ Cron de recordatorios de suscripción iniciado (diario a las 9:00 AM COT)');
  console.log('✅ Cron de recordatorios de suscripción iniciado (diario a las 9:00 AM COT)');

  // Ejecutar una primera vez 30s después de iniciar el servidor (para verificar inmediatamente)
  setTimeout(async () => {
    console.log('[SubscriptionCron] Ejecución inicial al iniciar servidor...');
    const count = await checkSubscriptionReminders();
    console.log(`[SubscriptionCron] Ejecución inicial completada: ${count} recordatorio(s) enviado(s)`);
  }, 30000);

  return task;
}

module.exports = {
  startSubscriptionCron,
  checkSubscriptionReminders
};
