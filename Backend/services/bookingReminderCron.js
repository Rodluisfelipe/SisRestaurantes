const cron = require('node-cron');
const Booking = require('../Models/Booking');
const BusinessConfig = require('../Models/BusinessConfig');
const { sendPushToBusinessId, sendPushToCustomer } = require('./pushService');
const logger = require('../utils/logger');
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');

/**
 * Booking Reminder Cron
 * 
 * Runs every 15 minutes. For each upcoming booking:
 *   - 24h before → sends reminder to customer + business
 *   - 1h before  → sends reminder to customer + business
 * 
 * Tracks sent reminders via order.remindersSent to avoid duplicates.
 */

const REMINDER_WINDOWS = [
  { key: '24h', hoursBeforeMin: 23.5, hoursBeforeMax: 24.5 },
  { key: '1h', hoursBeforeMin: 0.75, hoursBeforeMax: 1.25 }
];

async function checkBookingReminders() {
  try {
    const now = new Date();

    // Find bookings in the next 25 hours that are confirmed and not cancelled
    const lookAhead = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const upcomingBookings = await Booking.find({
      bookingDate: { $gte: now, $lte: lookAhead },
      bookingStatus: { $in: ['pending', 'confirmed'] }
    }).lean();

    if (upcomingBookings.length === 0) return;

    // Group by businessId to check settings
    const businessIds = [...new Set(upcomingBookings.map(b => b.businessId.toString()))];
    const configs = await BusinessConfig.find({ _id: { $in: businessIds } })
      .select('bookingSettings businessName').lean();
    const configMap = {};
    configs.forEach(c => { configMap[c._id.toString()] = c; });

    const reminderFeatureMap = {};
    await Promise.all(
      businessIds.map(async (businessId) => {
        try {
          const { planConfig } = await getSubscriptionForBusiness(businessId);
          reminderFeatureMap[businessId] = isFeatureEnabledForPlan(planConfig, 'bookingReminders');
        } catch (error) {
          reminderFeatureMap[businessId] = false;
          logger.warn('[BookingReminder] Error checking bookingReminders feature', {
            businessId,
            error: error.message
          });
        }
      })
    );

    let totalSent = 0;

    for (const booking of upcomingBookings) {
      const config = configMap[booking.businessId.toString()];
      if (!config) continue;

      if (!reminderFeatureMap[booking.businessId.toString()]) continue;

      // Check if reminders are enabled (default: true)
      if (config.bookingSettings?.enableReminders === false) continue;

      const bookingTime = new Date(booking.bookingDate).getTime();
      const hoursUntil = (bookingTime - now.getTime()) / (1000 * 60 * 60);
      const sentKeys = (booking.remindersSent || []).map(r => r.type);

      for (const window of REMINDER_WINDOWS) {
        if (hoursUntil >= window.hoursBeforeMin && hoursUntil <= window.hoursBeforeMax && !sentKeys.includes(window.key)) {
          // Send reminder
          const bookingDateStr = new Date(booking.bookingDate).toLocaleDateString('es-CO', {
            weekday: 'short', day: 'numeric', month: 'short'
          });
          const bookingTimeStr = new Date(booking.bookingDate).toLocaleTimeString('es-CO', {
            hour: '2-digit', minute: '2-digit', hour12: true
          });
          const serviceName = booking.items?.map(i => i.name).join(', ') || 'tu cita';

          const isOneHour = window.key === '1h';
          const timeLabel = isOneHour ? 'en 1 hora' : 'mañana';

          // Push to customer
          if (booking.customerToken) {
            try {
              await sendPushToCustomer(booking.customerToken, {
                title: isOneHour ? '⏰ Tu cita es en 1 hora' : '📅 Recordatorio de cita mañana',
                body: `${serviceName} — ${bookingDateStr} a las ${bookingTimeStr}`,
                clickUrl: `/track/${booking._id}`,
                data: { type: 'booking_reminder', bookingId: booking._id.toString() }
              }, booking.businessId.toString());
            } catch (e) { logger.error('Error sending customer booking reminder', e); }
          }

          // Push to business
          try {
            await sendPushToBusinessId(booking.businessId.toString(), {
              title: `📋 Cita ${timeLabel}: ${booking.customerName}`,
              body: `${serviceName} — ${bookingTimeStr}${booking.staffName ? ` (${booking.staffName})` : ''}`,
              clickUrl: '/admin/bookings',
              data: { type: 'booking_reminder', bookingId: booking._id.toString() }
            });
          } catch (e) { logger.error('Error sending business booking reminder', e); }

          // Email reminder to customer (best-effort)
          try {
            const { sendBookingReminderEmail } = require('./emailService');
            await sendBookingReminderEmail(booking.businessId.toString(), booking, hoursUntil);
          } catch (e) { logger.error('Error sending booking reminder email', e); }

          // Mark reminder as sent
          await Booking.findByIdAndUpdate(booking._id, {
            $push: { remindersSent: { type: window.key, sentAt: new Date() } }
          });

          totalSent++;
        }
      }
    }

    if (totalSent > 0) {
      logger.info(`[BookingReminder] Sent ${totalSent} booking reminders`);
    }
  } catch (error) {
    logger.error('[BookingReminder] Error checking booking reminders', error);
  }
}

let _bookingCronRunning = false;
function startBookingReminderCron() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    if (_bookingCronRunning) {
      logger.warn('[BookingReminder] Previous run still in progress — skipping');
      return;
    }
    _bookingCronRunning = true;
    try {
      await checkBookingReminders();
    } finally {
      _bookingCronRunning = false;
    }
  }, { timezone: 'America/Bogota' });

  logger.info('✅ Booking reminder cron started (every 15 min)');

  // Also run once on startup (after brief delay), respecting overlap guard
  setTimeout(async () => {
    if (_bookingCronRunning) return;
    _bookingCronRunning = true;
    try {
      await checkBookingReminders();
    } finally {
      _bookingCronRunning = false;
    }
  }, 10000);
}

module.exports = {
  startBookingReminderCron,
  checkBookingReminders
};
