/**
 * Crew — marketplace de turnos para restaurantes.
 *
 * Dos audiencias:
 *   - Workers (estudiantes/casuales) → sub-rutas /workers/* protegidas con workerAuth
 *   - Businesses (admins de MenuBy) → sub-rutas /businesses/* y /admin/* con tenantAuth existente
 *
 * MVP scope (este archivo):
 *   - Worker: signup, login, perfil, feed, aplicar, mis bookings, check-in
 *   - Business: publicar shift, ver applicants, aceptar worker, completar booking
 *
 * Lo que NO está aquí todavía (sprint 2+):
 *   - KYC con biometría (Truora)
 *   - Escrow real de pagos
 *   - Chat in-app (irá por sockets)
 *   - Sistema de quests/badges automáticos avanzado
 *   - Wallet movements completos
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Worker, VALID_SKILLS } = require('../Models/Worker');
const ShiftPost = require('../Models/ShiftPost');
const ShiftApplication = require('../Models/ShiftApplication');
const ShiftBooking = require('../Models/ShiftBooking');
const BusinessConfig = require('../Models/BusinessConfig');
const { tenantAuth } = require('../middleware/tenantAuth');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const WORKER_TOKEN_TTL = '30d';

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function signWorkerToken(workerId) {
  return jwt.sign({ id: workerId, kind: 'worker' }, JWT_SECRET, { expiresIn: WORKER_TOKEN_TTL });
}

async function requireWorker(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autenticado' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.kind !== 'worker') return res.status(401).json({ message: 'Token inválido' });
    const worker = await Worker.findById(decoded.id);
    if (!worker) return res.status(401).json({ message: 'Worker no existe' });
    if (worker.status !== 'active') return res.status(403).json({ message: `Cuenta ${worker.status}` });
    req.worker = worker;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

/**
 * Algoritmo de score para ordenar applicants y recomendar workers.
 * Devuelve número 0-100.
 */
function calcMatchScore(shift, worker) {
  let score = 0;
  // Skill match (40%)
  const hasMainSkill = worker.skills.some(s => s.key === shift.role);
  if (hasMainSkill) {
    const skill = worker.skills.find(s => s.key === shift.role);
    score += 40 * ({ principiante: 0.6, intermedio: 0.85, experto: 1 }[skill.level] || 0.6);
  }
  // Rating (25%)
  score += (worker.rating.avg / 5) * 25;
  // Level (15%)
  score += Math.min(worker.level / 20, 1) * 15;
  // Experience (10%)
  if (worker.stats.shiftsCompleted > 0) score += Math.min(worker.stats.shiftsCompleted / 20, 1) * 10;
  // No-show penalty (10%)
  const noShowRate = worker.stats.shiftsCompleted > 0
    ? worker.stats.noShows / (worker.stats.shiftsCompleted + worker.stats.noShows)
    : 0;
  score += (1 - noShowRate) * 10;
  return Math.round(Math.min(100, score));
}

/* ─────────────────────────────────────────────
 *  WORKER — auth
 * ───────────────────────────────────────────── */

// POST /crew/workers/signup
router.post('/workers/signup', async (req, res) => {
  try {
    const { phone, name, password } = req.body || {};
    if (!phone || !name || !password) {
      return res.status(400).json({ message: 'phone, name y password requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Contraseña mínima 6 caracteres' });
    }
    const exists = await Worker.findOne({ phone });
    if (exists) return res.status(409).json({ message: 'Ya hay una cuenta con ese teléfono' });

    const worker = new Worker({ phone, name: name.trim(), password });
    await worker.save();
    const token = signWorkerToken(worker._id);
    res.status(201).json({
      success: true,
      token,
      worker: { id: worker._id, name: worker.name, phone: worker.phone, level: worker.level, xp: worker.xp },
    });
  } catch (e) {
    logger.error('crew signup error', e);
    res.status(500).json({ message: 'Error al registrar' });
  }
});

// POST /crew/workers/login
router.post('/workers/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const worker = await Worker.findOne({ phone });
    if (!worker || !(await worker.comparePassword(password))) {
      return res.status(401).json({ message: 'Teléfono o contraseña incorrectos' });
    }
    if (worker.status !== 'active') {
      return res.status(403).json({ message: `Cuenta ${worker.status}` });
    }
    worker.lastLoginAt = new Date();
    await worker.save();
    const token = signWorkerToken(worker._id);
    res.json({
      success: true,
      token,
      worker: { id: worker._id, name: worker.name, level: worker.level, xp: worker.xp },
    });
  } catch (e) {
    logger.error('crew login error', e);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — perfil
 * ───────────────────────────────────────────── */

// GET /crew/workers/me
router.get('/workers/me', requireWorker, async (req, res) => {
  const w = req.worker.toObject();
  delete w.password;
  delete w.refreshToken;
  res.json({ success: true, worker: w });
});

// PUT /crew/workers/me
router.put('/workers/me', requireWorker, async (req, res) => {
  try {
    const allowed = [
      'name', 'email', 'photo', 'birthDate', 'bio', 'university',
      'skills', 'languages', 'availability', 'acceptsSOS',
      'hourlyRate', 'location', 'payoutMethod', 'mascot',
    ];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];

    Object.assign(req.worker, patch);
    await req.worker.save();
    res.json({ success: true, worker: req.worker });
  } catch (e) {
    logger.error('crew profile update error', e);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — discover feed
 * ───────────────────────────────────────────── */

// GET /crew/shifts/feed?city=&role=&date=&maxDistanceKm=
router.get('/shifts/feed', requireWorker, async (req, res) => {
  try {
    const { city, role, dateFrom, dateTo, limit = 20 } = req.query;
    const q = { status: 'open', visibility: { $in: ['public'] } };
    if (city) q['location.city'] = city;
    if (role) q.role = role;
    if (dateFrom || dateTo) {
      q.date = {};
      if (dateFrom) q.date.$gte = new Date(dateFrom);
      if (dateTo) q.date.$lte = new Date(dateTo);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      q.date = { $gte: today };
    }
    // Excluir donde el worker ya aplicó
    const appliedShiftIds = await ShiftApplication.find({ workerId: req.worker._id }).distinct('shiftId');
    if (appliedShiftIds.length) q._id = { $nin: appliedShiftIds };

    const shifts = await ShiftPost.find(q)
      .sort({ isSOS: -1, featured: -1, date: 1 })
      .limit(Math.min(Number(limit), 50))
      .populate('businessId', 'businessName slug logo coverImage businessType')
      .lean();

    // Anexar matchScore para que el feed pueda priorizar
    const enriched = shifts.map(s => ({ ...s, matchScore: calcMatchScore(s, req.worker) }));
    res.json({ success: true, shifts: enriched });
  } catch (e) {
    logger.error('crew feed error', e);
    res.status(500).json({ message: e.message || 'Error al cargar el feed', error: e.name });
  }
});

// GET /crew/shifts/:id — detalle público + transparency
router.get('/shifts/:id', requireWorker, async (req, res) => {
  try {
    const shift = await ShiftPost.findById(req.params.id)
      .populate('businessId', 'businessName slug logo coverImage description businessType address whatsappNumber')
      .lean();
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });

    // Reviews previas de workers que ya trabajaron en este negocio
    const recentReviews = await ShiftBooking.find({
      businessId: shift.businessId._id,
      'reviewByWorker.rating': { $exists: true },
    })
      .sort({ 'reviewByWorker.reviewedAt': -1 })
      .limit(5)
      .select('reviewByWorker')
      .lean();

    // Scores agregados (sprint 2: cálculo más completo)
    const allReviews = await ShiftBooking.find({
      businessId: shift.businessId._id,
      'reviewByWorker.rating': { $exists: true },
    }).select('reviewByWorker').lean();

    const scores = {
      reviewCount: allReviews.length,
      avgRating: allReviews.length
        ? allReviews.reduce((s, b) => s + b.reviewByWorker.rating, 0) / allReviews.length
        : null,
    };

    res.json({
      success: true,
      shift,
      transparency: {
        scores,
        recentReviews: recentReviews.map(r => r.reviewByWorker),
      },
      matchScore: calcMatchScore(shift, req.worker),
    });
  } catch (e) {
    logger.error('crew shift detail error', e);
    res.status(500).json({ message: e.message || 'Error al cargar el shift', error: e.name });
  }
});

// POST /crew/shifts/:id/apply
router.post('/shifts/:id/apply', requireWorker, async (req, res) => {
  try {
    const shift = await ShiftPost.findById(req.params.id);
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });
    if (shift.status !== 'open' && shift.status !== 'partially_filled') {
      return res.status(400).json({ message: 'Este shift ya no está disponible' });
    }

    // Reglas mínimas (defensivas contra docs viejos sin requirements)
    const reqs = shift.requirements || {};
    const minLevel = reqs.minLevel || 1;
    const minRating = reqs.minRating || 0;
    if ((req.worker.level || 1) < minLevel) {
      return res.status(403).json({ message: `Nivel mínimo requerido: ${minLevel}` });
    }
    if ((req.worker.rating?.avg || 0) < minRating) {
      return res.status(403).json({ message: `Rating mínimo requerido: ${minRating}` });
    }
    if ((req.worker.blockedByBusinessIds || []).some(b => String(b) === String(shift.businessId))) {
      return res.status(403).json({ message: 'No puedes postularte a este negocio' });
    }

    try {
      const app = await ShiftApplication.create({
        shiftId: shift._id,
        workerId: req.worker._id,
        businessId: shift.businessId,
        message: (req.body?.message || '').slice(0, 200),
        matchScore: calcMatchScore(shift, req.worker),
      });
      res.status(201).json({ success: true, application: app });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(409).json({ message: 'Ya aplicaste a este shift' });
      }
      throw dupErr;
    }
  } catch (e) {
    logger.error('crew apply error', e);
    res.status(500).json({ message: e.message || 'Error al aplicar', error: e.name });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — mis cosas
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/applications
router.get('/workers/me/applications', requireWorker, async (req, res) => {
  const apps = await ShiftApplication.find({ workerId: req.worker._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'shiftId', populate: { path: 'businessId', select: 'businessName logo' } })
    .lean();
  res.json({ success: true, applications: apps });
});

// GET /crew/workers/me/bookings
router.get('/workers/me/bookings', requireWorker, async (req, res) => {
  const bookings = await ShiftBooking.find({ workerId: req.worker._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'shiftId' })
    .populate({ path: 'businessId', select: 'businessName logo address whatsappNumber' })
    .lean();
  res.json({ success: true, bookings });
});

// POST /crew/bookings/:id/checkin
router.post('/bookings/:id/checkin', requireWorker, async (req, res) => {
  try {
    const { lat, lng, photo } = req.body || {};
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking no encontrado' });
    if (String(booking.workerId) !== String(req.worker._id)) {
      return res.status(403).json({ message: 'No es tu booking' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Booking no se puede check-inear en este estado' });
    }
    booking.status = 'checked_in';
    booking.checkInAt = new Date();
    booking.checkInLat = lat || null;
    booking.checkInLng = lng || null;
    booking.checkInPhoto = photo || null;
    await booking.save();
    res.json({ success: true, booking });
  } catch (e) {
    logger.error('crew checkin error', e);
    res.status(500).json({ message: 'Error al hacer check-in' });
  }
});

// POST /crew/bookings/:id/review-business
router.post('/bookings/:id/review-business', requireWorker, async (req, res) => {
  try {
    const { rating, comment, tags } = req.body || {};
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'rating 1-5' });
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.workerId) !== String(req.worker._id)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Solo puedes revisar bookings completados' });
    }
    booking.reviewByWorker = { rating, comment: (comment || '').slice(0, 300), tags: tags || [] };
    await booking.save();
    res.json({ success: true });
  } catch (e) {
    logger.error('crew review business error', e);
    res.status(500).json({ message: 'Error al guardar review' });
  }
});

/* ─────────────────────────────────────────────
 *  BUSINESS — publicar y gestionar shifts
 *  Requiere tenantAuth (admin del negocio MenuBy).
 * ───────────────────────────────────────────── */

// POST /crew/businesses/shifts — publicar shift
router.post('/businesses/shifts', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: 'No se pudo identificar el negocio. Vuelve a iniciar sesión.' });
    const biz = await BusinessConfig.findById(businessId).lean();
    if (!biz) return res.status(404).json({ message: 'Negocio no encontrado' });

    const {
      title, description, role, skillsBonus, date, startTime, endTime, hoursTotal,
      workersNeeded, hourlyRate, requirements, perks, visibility, matchMode, isSOS,
    } = req.body || {};

    const missing = [];
    if (!title) missing.push('título');
    if (!role) missing.push('rol');
    if (!date) missing.push('fecha');
    if (!startTime) missing.push('hora de inicio');
    if (!endTime) missing.push('hora de fin');
    if (!hoursTotal) missing.push('horas');
    if (!hourlyRate) missing.push('tarifa por hora');
    if (missing.length) {
      return res.status(400).json({ message: `Faltan campos: ${missing.join(', ')}` });
    }
    if (!VALID_SKILLS.includes(role)) {
      return res.status(400).json({ message: `Rol no válido: ${role}` });
    }

    const shift = new ShiftPost({
      businessId,
      postedBy: req.user.id,
      title, description: description || '', role,
      skillsBonus: (skillsBonus || []).filter(s => VALID_SKILLS.includes(s)),
      date: new Date(date), startTime, endTime, hoursTotal,
      workersNeeded: workersNeeded || 1,
      hourlyRate,
      totalPay: Math.round(Number(hoursTotal) * Number(hourlyRate)),
      requirements: requirements || {},
      perks: perks || [],
      visibility: visibility || 'public',
      matchMode: matchMode || 'open',
      isSOS: !!isSOS,
      location: {
        city: biz.address?.city || biz.city || '',
        neighborhood: biz.address?.neighborhood || '',
        lat: biz.location?.lat || null,
        lng: biz.location?.lng || null,
        address: biz.address?.full || biz.address || '',
      },
      // Auto-expira a la hora de inicio del shift
      expiresAt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
    });
    await shift.save();
    res.status(201).json({ success: true, shift });
  } catch (e) {
    logger.error('crew biz post shift error', e);
    res.status(500).json({ message: e.message || 'Error al publicar shift', error: e.name });
  }
});

// GET /crew/businesses/shifts — mis shifts
router.get('/businesses/shifts', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId es requerido' });
    }
    const { status } = req.query;
    const q = { businessId };
    if (status) q.status = status;
    const shifts = await ShiftPost.find(q).sort({ date: -1 }).limit(50).lean();
    res.json({ success: true, shifts });
  } catch (e) {
    logger.error('crew biz shifts list error', e);
    res.status(500).json({ success: false, message: 'Error al cargar los shifts' });
  }
});

// GET /crew/businesses/shifts/:id/applicants
router.get('/businesses/shifts/:id/applicants', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId es requerido' });
    }
    const shift = await ShiftPost.findOne({ _id: req.params.id, businessId });
    if (!shift) {
      logger.warn('Shift not found for applicants', { shiftId: req.params.id, businessId }, req);
      return res.status(404).json({ message: 'Shift no encontrado' });
    }

    const applications = await ShiftApplication.find({ shiftId: shift._id })
      .sort({ matchScore: -1, appliedAt: 1 })
      .populate('workerId', 'name photo level xp rating stats badgesEarned skills university bio')
      .lean();
    res.json({ success: true, applications });
  } catch (e) {
    logger.error('crew applicants error', e, req);
    res.status(500).json({ message: 'Error al cargar applicants' });
  }
});

// POST /crew/businesses/applications/:id/accept
router.post('/businesses/applications/:id/accept', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    const app = await ShiftApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application no encontrada' });
    if (String(app.businessId) !== String(businessId)) {
      return res.status(403).json({ message: 'No es tu shift' });
    }
    if (app.status !== 'pending') {
      return res.status(400).json({ message: `Application está ${app.status}` });
    }

    const shift = await ShiftPost.findById(app.shiftId);
    if (!shift || (shift.status !== 'open' && shift.status !== 'partially_filled')) {
      return res.status(400).json({ message: 'Shift no aceptable' });
    }

    // Crear booking
    const booking = await ShiftBooking.create({
      shiftId: shift._id, workerId: app.workerId, businessId: shift.businessId,
      agreedRate: shift.hourlyRate, agreedHours: shift.hoursTotal, agreedTotal: shift.totalPay,
      status: 'confirmed',
    });

    // Marcar app aceptada
    app.status = 'accepted';
    app.respondedAt = new Date();
    await app.save();

    // Actualizar shift
    shift.workersBooked += 1;
    if (shift.workersBooked >= shift.workersNeeded) shift.status = 'filled';
    else shift.status = 'partially_filled';
    await shift.save();

    res.json({ success: true, booking });
  } catch (e) {
    logger.error('crew accept app error', e);
    res.status(500).json({ message: e.message || 'Error al aceptar', error: e.name });
  }
});

// POST /crew/businesses/applications/:id/reject
router.post('/businesses/applications/:id/reject', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'businessId es requerido' });
    }
    const app = await ShiftApplication.findById(req.params.id);
    if (!app || String(app.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Application no encontrada' });
    }
    app.status = 'rejected';
    app.respondedAt = new Date();
    await app.save();
    res.json({ success: true });
  } catch (e) {
    logger.error('crew reject app error', e, req);
    res.status(500).json({ message: 'Error al rechazar' });
  }
});

// POST /crew/businesses/bookings/:id/complete — confirma fin de turno
router.post('/businesses/bookings/:id/complete', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ message: 'Ya completado' });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.confirmedByBusinessAt = new Date();
    // En sprint 2: pago real en escrow → liberar aquí. MVP marca el flag.
    booking.payoutStatus = 'released';
    booking.releasedAt = new Date();
    await booking.save();

    // Awards: XP + stats + posible badge "primer turno"
    const xpGained = Math.round(booking.agreedHours * 25); // 25 XP por hora trabajada
    const result = await Worker.addXP(booking.workerId, xpGained);
    const worker = result.worker;
    worker.stats.shiftsCompleted += 1;
    worker.stats.hoursWorked += booking.agreedHours;
    worker.stats.totalEarned += booking.agreedTotal;
    worker.lastShiftAt = new Date();
    worker.wallet.balance += booking.agreedTotal; // MVP: directo a wallet sin escrow

    // Badge "first_shift"
    if (worker.stats.shiftsCompleted === 1 && !worker.badgesEarned.some(b => b.key === 'first_shift')) {
      worker.badgesEarned.push({ key: 'first_shift' });
      booking.badgesAwarded.push('first_shift');
    }
    // Badge "10_shifts"
    if (worker.stats.shiftsCompleted === 10 && !worker.badgesEarned.some(b => b.key === '10_shifts')) {
      worker.badgesEarned.push({ key: '10_shifts' });
      booking.badgesAwarded.push('10_shifts');
    }

    booking.xpAwarded = xpGained;
    await booking.save();
    await worker.save();

    res.json({ success: true, booking, leveledUp: result.leveledUp, xpGained });
  } catch (e) {
    logger.error('crew complete booking error', e);
    res.status(500).json({ message: e.message || 'Error al completar booking', error: e.name });
  }
});

// POST /crew/businesses/bookings/:id/review-worker
router.post('/businesses/bookings/:id/review-worker', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    const { rating, comment, tags } = req.body || {};
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'rating 1-5' });

    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Solo puedes revisar completados' });
    }
    booking.reviewByBusiness = { rating, comment: (comment || '').slice(0, 300), tags: tags || [] };
    await booking.save();

    // Recalc del worker rating
    const allBusinessReviews = await ShiftBooking.find({
      workerId: booking.workerId,
      'reviewByBusiness.rating': { $exists: true },
    }).select('reviewByBusiness').lean();
    const avg = allBusinessReviews.reduce((s, b) => s + b.reviewByBusiness.rating, 0) / allBusinessReviews.length;
    await Worker.findByIdAndUpdate(booking.workerId, {
      'rating.avg': Math.round(avg * 100) / 100,
      'rating.count': allBusinessReviews.length,
    });

    res.json({ success: true });
  } catch (e) {
    logger.error('crew review worker error', e);
    res.status(500).json({ message: 'Error al guardar review' });
  }
});

module.exports = router;
