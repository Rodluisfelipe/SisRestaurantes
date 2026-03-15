const express = require('express');
const router = express.Router();
const BusinessConfig = require('../Models/BusinessConfig');
const Order = require('../Models/Order');
const CompletedOrder = require('../Models/CompletedOrder');
const Customer = require('../Models/Customer');
const logger = require('../utils/logger');

/**
 * GET /api/bookings/slots
 * Returns available time slots for a given date and service duration.
 * 
 * Query params:
 *   businessId - MongoDB _id of the business
 *   date       - ISO date string YYYY-MM-DD
 *   duration   - service duration in minutes (default: 30)
 */
router.get('/slots', async (req, res) => {
  try {
    const { businessId, date, duration } = req.query;

    if (!businessId || !date) {
      return res.status(400).json({ message: 'businessId and date are required' });
    }

    const durationMin = parseInt(duration, 10) || 30;

    // Load business config
    const config = await BusinessConfig.findById(businessId);
    if (!config) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (!config.enableBookings) {
      return res.status(400).json({ message: 'Bookings not enabled for this business' });
    }

    // Determine the day of week for the requested date
    const requestedDate = new Date(date + 'T00:00:00');
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[requestedDate.getUTCDay()];
    const dayHours = config.businessHours?.[dayName];

    if (!dayHours || !dayHours.isOpen) {
      return res.json({ slots: [], closed: true });
    }

    // Parse open/close times
    const [openH, openM] = dayHours.openTime.split(':').map(Number);
    const [closeH, closeM] = dayHours.closeTime.split(':').map(Number);

    const interval = config.bookingSettings?.slotInterval || 30;
    const buffer = config.bookingSettings?.bufferMinutes || 0;

    // Build all possible slots within business hours
    const allSlots = [];
    let cursor = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    while (cursor + durationMin <= closeMinutes) {
      const h = Math.floor(cursor / 60);
      const m = cursor % 60;
      allSlots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        startMinutes: cursor,
        endMinutes: cursor + durationMin
      });
      cursor += interval;
    }

    // Get existing bookings for that day
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const existingBookings = await Order.find({
      businessId,
      isBooking: true,
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['cancelled'] }
    }).select('bookingDate bookingEndDate').lean();

    // Convert existing bookings to minute ranges
    const occupied = existingBookings.map(b => {
      const bStart = new Date(b.bookingDate);
      const bEnd = new Date(b.bookingEndDate);
      return {
        startMinutes: bStart.getUTCHours() * 60 + bStart.getUTCMinutes(),
        endMinutes: bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes()
      };
    });

    // Check slot availability considering buffer time
    const slots = allSlots.map(slot => {
      const slotStart = slot.startMinutes;
      const slotEnd = slot.endMinutes + buffer;

      const isOccupied = occupied.some(occ => {
        const occStart = occ.startMinutes;
        const occEnd = occ.endMinutes + buffer;
        return slotStart < occEnd && slotEnd > occStart;
      });

      return {
        time: slot.time,
        available: !isOccupied
      };
    });

    // Filter out past slots if date is today
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const filteredSlots = date === today
      ? slots.filter(s => {
          const [sh, sm] = s.time.split(':').map(Number);
          const slotMinutes = sh * 60 + sm;
          const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          return slotMinutes > nowMinutes;
        })
      : slots;

    res.json({ slots: filteredSlots, closed: false });
  } catch (error) {
    logger.error('Error fetching booking slots', error);
    res.status(500).json({ message: 'Error fetching slots' });
  }
});

/**
 * GET /api/bookings
 * Returns bookings for a business, with optional date range filtering.
 * Used by the admin BookingsManager.
 * 
 * Query params:
 *   businessId - MongoDB _id
 *   from       - ISO date (optional, default: today)
 *   to         - ISO date (optional, default: from + 7 days)
 */
router.get('/', async (req, res) => {
  try {
    const { businessId, from, to } = req.query;

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const fromDate = from ? new Date(from + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const bookings = await Order.find({
      businessId,
      isBooking: true,
      bookingDate: { $gte: fromDate, $lte: toDate }
    }).sort({ bookingDate: 1 }).lean();

    res.json(bookings);
  } catch (error) {
    logger.error('Error fetching bookings', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Update booking status (confirm, cancel, complete, no-show).
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(bookingStatus)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }

    const order = await Order.findById(id);
    if (!order || !order.isBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    order.bookingStatus = bookingStatus;
    if (bookingStatus === 'cancelled') {
      order.status = 'cancelled';
    } else if (bookingStatus === 'completed') {
      order.status = 'completed';
    } else if (bookingStatus === 'confirmed') {
      order.status = 'confirmed';
    }

    order.statusHistory.push({
      status: `booking_${bookingStatus}`,
      timestamp: new Date(),
      note: bookingStatus === 'confirmed' ? 'Cita confirmada' : bookingStatus === 'cancelled' ? 'Cita cancelada' : bookingStatus === 'completed' ? 'Cita completada' : bookingStatus === 'no_show' ? 'No asistió' : `Booking ${bookingStatus}`
    });

    await order.save();

    // Emit socket event so customer OrderTracker updates in real-time
    try {
      const socketService = require('../services/socketService');
      socketService.emitToOrder(order._id.toString(), 'order_status_changed', {
        orderId: order._id.toString(),
        status: order.status,
        order: order.toObject()
      });
    } catch (e) { /* socket emit is best-effort */ }

    res.json({ message: 'Booking status updated', bookingStatus: order.bookingStatus });
  } catch (error) {
    logger.error('Error updating booking status', error);
    res.status(500).json({ message: 'Error updating booking status' });
  }
});

/**
 * GET /api/bookings/stats
 * Booking analytics: totals by status, top services, daily distribution.
 *
 * Query params:
 *   businessId - MongoDB _id
 *   from       - ISO date YYYY-MM-DD
 *   to         - ISO date YYYY-MM-DD
 */
router.get('/stats', async (req, res) => {
  try {
    const { businessId, from, to } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const fromDate = from ? new Date(from + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const match = { businessId: new (require('mongoose').Types.ObjectId)(businessId), isBooking: true, bookingDate: { $gte: fromDate, $lte: toDate } };

    // Merge active + completed bookings
    const [active, completed] = await Promise.all([
      Order.find(match).lean(),
      CompletedOrder.find(match).lean()
    ]);
    const all = [...active, ...completed];

    // Status counts
    const byStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
    all.forEach(b => { if (byStatus[b.bookingStatus] !== undefined) byStatus[b.bookingStatus]++; });

    // Top services
    const serviceCounts = {};
    all.forEach(b => {
      (b.items || []).forEach(item => {
        serviceCounts[item.name] = (serviceCounts[item.name] || 0) + item.quantity;
      });
    });
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Revenue from completed bookings
    const revenue = all
      .filter(b => b.bookingStatus === 'completed')
      .reduce((sum, b) => sum + (b.finalAmount || b.totalAmount || 0), 0);

    // Daily distribution (bookings per day of week)
    const dailyDist = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    all.filter(b => b.bookingStatus !== 'cancelled').forEach(b => {
      const d = new Date(b.bookingDate);
      dailyDist[d.getUTCDay()]++;
    });

    // Hourly distribution
    const hourlyDist = {};
    all.filter(b => b.bookingStatus !== 'cancelled').forEach(b => {
      const h = new Date(b.bookingDate).getUTCHours();
      hourlyDist[h] = (hourlyDist[h] || 0) + 1;
    });

    res.json({
      total: all.length,
      byStatus,
      topServices,
      revenue,
      dailyDistribution: dailyDist,
      hourlyDistribution: hourlyDist,
      cancellationRate: all.length ? Math.round((byStatus.cancelled / all.length) * 100) : 0,
      noShowRate: all.length ? Math.round((byStatus.no_show / all.length) * 100) : 0
    });
  } catch (error) {
    logger.error('Error fetching booking stats', error);
    res.status(500).json({ message: 'Error fetching booking stats' });
  }
});

/**
 * GET /api/bookings/customer/:phone
 * Returns customer profile + their booking history.
 *
 * Query params:
 *   businessId - MongoDB _id
 */
router.get('/customer/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    // Get customer profile
    const customer = await Customer.findOne({ businessId, phone }).lean();

    // Get all their bookings (active + completed)
    const bookingFilter = { businessId: new (require('mongoose').Types.ObjectId)(businessId), isBooking: true, phone };
    const [activeBookings, completedBookings] = await Promise.all([
      Order.find(bookingFilter).sort({ bookingDate: -1 }).lean(),
      CompletedOrder.find(bookingFilter).sort({ bookingDate: -1 }).lean()
    ]);
    const allBookings = [...activeBookings, ...completedBookings].sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    // Booking stats for this customer
    const totalBookings = allBookings.length;
    const completedCount = allBookings.filter(b => b.bookingStatus === 'completed').length;
    const cancelledCount = allBookings.filter(b => b.bookingStatus === 'cancelled').length;
    const noShowCount = allBookings.filter(b => b.bookingStatus === 'no_show').length;
    const bookingRevenue = allBookings
      .filter(b => b.bookingStatus === 'completed')
      .reduce((sum, b) => sum + (b.finalAmount || b.totalAmount || 0), 0);

    res.json({
      customer: customer || { phone, name: allBookings[0]?.customerName || phone },
      bookings: allBookings.slice(0, 20), // last 20
      stats: {
        totalBookings,
        completed: completedCount,
        cancelled: cancelledCount,
        noShow: noShowCount,
        revenue: bookingRevenue
      }
    });
  } catch (error) {
    logger.error('Error fetching customer bookings', error);
    res.status(500).json({ message: 'Error fetching customer bookings' });
  }
});

module.exports = router;
