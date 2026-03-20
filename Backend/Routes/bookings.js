const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const BusinessConfig = require('../Models/BusinessConfig');
const Booking = require('../Models/Booking');
const Customer = require('../Models/Customer');
const Admin = require('../Models/Admin');
const Product = require('../Models/Product');
const logger = require('../utils/logger');
const { tenantAuth } = require('../middleware/tenantAuth');
const rateLimit = require('express-rate-limit');
const {
  validateCreateBooking,
  validateUpdateBookingStatus,
  validateAssignStaff,
  validateCreateRecurring,
} = require('../middleware/validators/bookingValidators');

// Rate limiter for public booking creation
const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Demasiadas solicitudes. Intente nuevamente más tarde.' }
});

// Generate a customer token for booking tracking
const generateCustomerToken = () => crypto.randomBytes(16).toString('hex');

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
    const { businessId, date, duration, staffId } = req.query;

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

    // Get existing bookings for that day — filter by staffId if provided
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const bookingFilter = {
      businessId,
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      bookingStatus: { $nin: ['cancelled'] }
    };
    if (staffId) {
      bookingFilter.staffId = staffId;
    }

    const existingBookings = await Booking.find(bookingFilter)
      .select('bookingDate bookingEndDate staffId').lean();

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
router.get('/', tenantAuth, async (req, res) => {
  try {
    const { businessId, from, to } = req.query;

    if (!businessId) {
      return res.status(400).json({ message: 'businessId is required' });
    }

    const fromDate = from ? new Date(from + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      businessId,
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
 * Enforces cancellation policy if customer cancels.
 */
router.patch('/:id/status', tenantAuth, validateUpdateBookingStatus, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus, reason, isCustomer } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(bookingStatus)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Enforce valid state transitions
    const BOOKING_TRANSITIONS = {
      'pending':   ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled', 'no_show'],
      'completed': [],
      'cancelled': [],
      'no_show':   []
    };
    const allowed = BOOKING_TRANSITIONS[booking.bookingStatus] || [];
    if (!allowed.includes(bookingStatus)) {
      return res.status(400).json({
        message: `No se puede cambiar de '${booking.bookingStatus}' a '${bookingStatus}'`,
        code: 'INVALID_TRANSITION'
      });
    }

    // Cancellation policy check (only for customer-initiated cancellations)
    if (bookingStatus === 'cancelled' && isCustomer) {
      const config = await BusinessConfig.findById(booking.businessId);
      const policy = config?.bookingSettings;

      if (policy && policy.allowCancellation === false) {
        return res.status(403).json({ message: 'Este negocio no permite cancelaciones' });
      }

      if (policy && policy.cancellationDeadlineHours > 0 && booking.bookingDate) {
        const deadlineMs = policy.cancellationDeadlineHours * 60 * 60 * 1000;
        const bookingTime = new Date(booking.bookingDate).getTime();
        const now = Date.now();
        if (bookingTime - now < deadlineMs) {
          const hours = policy.cancellationDeadlineHours;
          return res.status(403).json({
            message: `No puedes cancelar con menos de ${hours}h de anticipación`,
            tooLate: true,
            deadlineHours: hours
          });
        }
      }
    }

    booking.bookingStatus = bookingStatus;
    if (bookingStatus === 'cancelled') {
      booking.cancelledAt = new Date();
      if (reason) booking.cancellationReason = reason;
    } else if (bookingStatus === 'completed') {
      booking.completedAt = new Date();
    }

    booking.statusHistory.push({
      status: `booking_${bookingStatus}`,
      timestamp: new Date(),
      note: bookingStatus === 'confirmed' ? 'Cita confirmada' : bookingStatus === 'cancelled' ? (reason || 'Cita cancelada') : bookingStatus === 'completed' ? 'Cita completada' : bookingStatus === 'no_show' ? 'No asistió' : `Booking ${bookingStatus}`
    });

    await booking.save();

    // Emit socket event so customer OrderTracker updates in real-time
    try {
      const socketService = require('../services/socketService');
      socketService.emitToOrder(booking._id.toString(), 'booking_status_changed', {
        bookingId: booking._id.toString(),
        bookingStatus: booking.bookingStatus,
        booking: booking.toObject()
      });
      // Also emit generic event for dashboard refresh
      socketService.emitToBusiness(booking.businessId.toString(), 'booking_updated', { bookingId: booking._id.toString(), bookingStatus });
    } catch (e) { /* socket emit is best-effort */ }

    // Send email notification (best-effort)
    try {
      const emailService = require('../services/emailService');
      if (bookingStatus === 'confirmed') {
        emailService.sendBookingConfirmedEmail(booking.businessId.toString(), booking);
      } else if (bookingStatus === 'cancelled') {
        emailService.sendBookingCancelledEmail(booking.businessId.toString(), booking);
      }
    } catch (e) { /* email is best-effort */ }

    res.json({ message: 'Booking status updated', bookingStatus: booking.bookingStatus });
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
router.get('/stats', tenantAuth, async (req, res) => {
  try {
    const { businessId, from, to } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const fromDate = from ? new Date(from + 'T00:00:00.000Z') : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const toDate = to ? new Date(to + 'T23:59:59.999Z') : new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const match = { businessId: new (require('mongoose').Types.ObjectId)(businessId), bookingDate: { $gte: fromDate, $lte: toDate } };

    const all = await Booking.find(match).lean();

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
router.get('/customer/:phone', tenantAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    // Get customer profile
    const customer = await Customer.findOne({ businessId, phone }).lean();

    // Get all their bookings
    const bookingFilter = { businessId: new (require('mongoose').Types.ObjectId)(businessId), phone };
    const allBookings = await Booking.find(bookingFilter).sort({ bookingDate: -1 }).lean();

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

/**
 * GET /api/bookings/available-staff
 * Returns staff members available for a specific business.
 * Used by CartSummary to let customers pick a professional.
 */
router.get('/available-staff', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const staff = await Admin.find({
      businessId,
      role: { $in: ['staff', 'manager', 'admin'] }
    }).select('_id name username role').lean();

    res.json(staff.map(s => ({
      _id: s._id,
      name: s.name || s.username,
      role: s.role
    })));
  } catch (error) {
    logger.error('Error fetching available staff', error);
    res.status(500).json({ message: 'Error fetching available staff' });
  }
});

/**
 * PATCH /api/bookings/:id/assign-staff
 * Assign a staff member to a booking.
 */
router.patch('/:id/assign-staff', tenantAuth, validateAssignStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, staffName } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (staffId) {
      const staffMember = await Admin.findById(staffId).select('name username').lean();
      if (!staffMember) return res.status(404).json({ message: 'Staff member not found' });
      booking.staffId = staffId;
      booking.staffName = staffName || staffMember.name || staffMember.username;
    } else {
      booking.staffId = null;
      booking.staffName = null;
    }

    booking.statusHistory.push({
      status: 'staff_assigned',
      timestamp: new Date(),
      note: booking.staffName ? `Asignado a ${booking.staffName}` : 'Profesional desasignado'
    });

    await booking.save();
    res.json({ message: 'Staff assigned', staffId: booking.staffId, staffName: booking.staffName });
  } catch (error) {
    logger.error('Error assigning staff', error);
    res.status(500).json({ message: 'Error assigning staff' });
  }
});

/**
 * POST /api/bookings/recurring
 * Create recurring bookings (weekly, biweekly, monthly).
 * Creates individual booking orders for each occurrence.
 */
router.post('/recurring', tenantAuth, validateCreateRecurring, async (req, res) => {
  try {
    const { businessId, recurrenceType, endDate, bookingTemplate } = req.body;

    if (!businessId || !recurrenceType || !endDate || !bookingTemplate) {
      return res.status(400).json({ message: 'businessId, recurrenceType, endDate, and bookingTemplate are required' });
    }

    const validTypes = ['weekly', 'biweekly', 'monthly'];
    if (!validTypes.includes(recurrenceType)) {
      return res.status(400).json({ message: 'Invalid recurrence type' });
    }

    const config = await BusinessConfig.findById(businessId);
    if (!config || !config.enableBookings) {
      return res.status(400).json({ message: 'Bookings not enabled' });
    }

    const template = bookingTemplate;
    const startDate = new Date(template.bookingDate);
    const end = new Date(endDate);

    if (isNaN(startDate.getTime()) || isNaN(end.getTime()) || end <= startDate) {
      return res.status(400).json({ message: 'Invalid date range' });
    }

    // Generate dates based on recurrence
    const dates = [];
    let current = new Date(startDate);
    while (current <= end) {
      dates.push(new Date(current));
      if (recurrenceType === 'weekly') current.setDate(current.getDate() + 7);
      else if (recurrenceType === 'biweekly') current.setDate(current.getDate() + 14);
      else if (recurrenceType === 'monthly') current.setMonth(current.getMonth() + 1);
    }

    // Limit to prevent abuse
    if (dates.length > 52) {
      return res.status(400).json({ message: 'Too many occurrences (max 52)' });
    }

    // Generate order numbers
    const { generateOrderNumber } = require('./orders');
    const createdBookings = [];

    for (const date of dates) {
      const bookingEndDate = new Date(date.getTime() + (parseInt(template.duration, 10) || 30) * 60000);
      const orderNumber = await generateOrderNumber(businessId);

      const booking = new Booking({
        businessId,
        orderNumber,
        customerName: template.customerName,
        phone: template.phone || '',
        customerId: template.customerId || null,
        orderChannel: template.orderChannel || 'inapp',
        bookingDate: date,
        bookingEndDate,
        bookingStatus: 'pending',
        staffId: template.staffId || null,
        staffName: template.staffName || null,
        recurrence: {
          type: recurrenceType,
          parentBookingId: null,
          endDate: end
        },
        items: template.items || [],
        totalAmount: template.totalAmount || 0,
        finalAmount: template.finalAmount || template.totalAmount || 0,
        paymentMethod: template.paymentMethod || null,
        statusHistory: [{
          status: 'booking_pending',
          timestamp: new Date(),
          note: `Cita recurrente (${recurrenceType})`
        }]
      });

      await booking.save();

      if (createdBookings.length === 0) {
        booking.recurrence.parentBookingId = booking._id;
        await booking.save();
      } else {
        booking.recurrence.parentBookingId = createdBookings[0]._id;
        await booking.save();
      }

      createdBookings.push(booking);
    }

    // Emit socket event
    try {
      const socketService = require('../services/socketService');
      socketService.emitToBusiness(businessId, 'new_booking', { count: createdBookings.length });
    } catch (e) { /* best-effort */ }

    res.json({
      message: `${createdBookings.length} citas recurrentes creadas`,
      count: createdBookings.length,
      bookings: createdBookings.map(b => ({ _id: b._id, bookingDate: b.bookingDate, bookingStatus: b.bookingStatus }))
    });
  } catch (error) {
    logger.error('Error creating recurring bookings', error);
    res.status(500).json({ message: 'Error creating recurring bookings' });
  }
});

/**
 * GET /api/bookings/cancellation-policy
 * Returns the cancellation policy for a business (public endpoint).
 */
router.get('/cancellation-policy', async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });

    const config = await BusinessConfig.findById(businessId)
      .select('bookingSettings.allowCancellation bookingSettings.cancellationDeadlineHours').lean();

    if (!config) return res.status(404).json({ message: 'Business not found' });

    res.json({
      allowCancellation: config.bookingSettings?.allowCancellation !== false,
      cancellationDeadlineHours: config.bookingSettings?.cancellationDeadlineHours || 0
    });
  } catch (error) {
    logger.error('Error fetching cancellation policy', error);
    res.status(500).json({ message: 'Error fetching cancellation policy' });
  }
});

/**
 * POST /api/bookings
 * Create a new booking (separate from orders).
 */
router.post('/', bookingRateLimiter, validateCreateBooking, async (req, res) => {
  try {
    const {
      businessId, customerName, phone, customerEmail,
      items, totalAmount, bookingDate,
      staffId, staffName, orderChannel, paymentMethod,
      customerNotes, couponCode,
      // Loyalty
      loyaltyReward, loyaltyRewardId, loyaltyPointsCost
    } = req.body;

    if (!businessId || !customerName || !items || !bookingDate) {
      return res.status(400).json({ message: 'businessId, customerName, items, and bookingDate are required' });
    }

    const config = await BusinessConfig.findById(businessId);
    if (!config) return res.status(404).json({ message: 'Business not found' });
    if (!config.enableBookings) return res.status(400).json({ message: 'Bookings not enabled for this business' });

    const bDate = new Date(bookingDate);
    if (isNaN(bDate.getTime()) || bDate <= new Date()) {
      return res.status(400).json({ message: 'bookingDate must be a valid future date' });
    }

    // Calculate end date from longest service duration
    let maxDuration = 30;
    const serviceIds = items.filter(i => i.productId).map(i => i.productId);
    if (serviceIds.length > 0) {
      const products = await Product.find({ _id: { $in: serviceIds }, itemType: 'service' }).select('durationMinutes').lean();
      for (const p of products) {
        if (p.durationMinutes && p.durationMinutes > maxDuration) maxDuration = p.durationMinutes;
      }
    }
    const bookingEndDate = new Date(bDate.getTime() + maxDuration * 60 * 1000);

    // Conflict check
    const conflictFilter = {
      businessId,
      bookingStatus: { $nin: ['cancelled'] },
      bookingDate: { $lt: bookingEndDate },
      bookingEndDate: { $gt: bDate }
    };
    if (staffId) conflictFilter.staffId = staffId;
    const conflicting = await Booking.findOne(conflictFilter);
    if (conflicting) {
      return res.status(409).json({ message: 'Este horario ya no está disponible. Por favor selecciona otro.' });
    }

    // Resolve customer
    let customer = null;
    if (phone) {
      customer = await Customer.findOne({ businessId, phone }).lean();
    }

    // Coupon handling
    let coupon = null;
    let discountAmount = 0;
    const numericTotal = typeof totalAmount === 'string' ? parseFloat(totalAmount) : (totalAmount || 0);
    let finalAmount = numericTotal;

    if (couponCode) {
      try {
        const Coupon = require('../Models/Coupon');
        coupon = await Coupon.findOne({ businessId, code: couponCode.toUpperCase(), isActive: true });
        if (coupon) {
          discountAmount = coupon.discountType === 'percentage'
            ? Math.round(numericTotal * coupon.discountValue / 100)
            : coupon.discountValue;
          finalAmount = Math.max(0, numericTotal - discountAmount);
        }
      } catch (e) { /* coupon is optional */ }
    }

    // Generate order number (shares sequence with orders)
    const { generateOrderNumber } = require('./orders');
    const orderNumber = await generateOrderNumber(businessId);

    const isInApp = orderChannel === 'inapp';
    const customerToken = isInApp ? generateCustomerToken() : null;

    const booking = new Booking({
      businessId,
      orderNumber,
      customerName,
      phone: phone || '',
      customerEmail: customerEmail || '',
      customerId: customer ? customer._id : null,
      bookingDate: bDate,
      bookingEndDate,
      bookingStatus: 'pending',
      staffId: staffId || null,
      staffName: staffName || null,
      items,
      totalAmount: numericTotal,
      discountAmount,
      finalAmount,
      paymentMethod: paymentMethod || null,
      couponCode: coupon ? coupon.code : null,
      couponId: coupon ? coupon._id : null,
      orderChannel: orderChannel || 'inapp',
      customerToken,
      customerNotes: customerNotes || '',
      statusHistory: [{ status: 'booking_pending', timestamp: new Date(), note: 'Cita creada' }]
    });

    const saved = await booking.save();

    // Record coupon usage
    if (coupon) {
      try { await coupon.recordUsage(customer ? customer._id : null, discountAmount); } catch (e) { /* best-effort */ }
    }

    // Socket events
    try {
      const socketService = require('../services/socketService');
      socketService.emitToBusiness(businessId, 'new_booking', saved);
    } catch (e) { /* best-effort */ }

    // Push notification to business
    try {
      const { sendPushToBusinessId } = require('../services/pushService');
      await sendPushToBusinessId(businessId, {
        title: `📅 Nueva Cita #${orderNumber}`,
        body: `${customerName} — ${bDate.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}`,
        clickUrl: '/admin/bookings',
        data: { type: 'new_booking', bookingId: saved._id.toString() }
      });
    } catch (e) { /* best-effort */ }

    // Email (best-effort)
    try {
      const emailService = require('../services/emailService');
      emailService.sendBookingCreatedEmail(businessId, saved);
    } catch (e) { /* best-effort */ }

    res.status(201).json({
      _id: saved._id,
      orderNumber: saved.orderNumber,
      bookingStatus: saved.bookingStatus,
      bookingDate: saved.bookingDate,
      customerToken: saved.customerToken
    });
  } catch (error) {
    logger.error('Error creating booking', error);
    res.status(500).json({ message: 'Error creating booking' });
  }
});

/**
 * GET /api/bookings/:id
 * Get a single booking by ID. Used by OrderTracker.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Validate ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }
    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    logger.error('Error fetching booking', error);
    res.status(500).json({ message: 'Error fetching booking' });
  }
});

module.exports = router;
