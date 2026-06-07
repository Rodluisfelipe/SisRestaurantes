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
const multer = require('multer');
const { Worker, VALID_SKILLS } = require('../Models/Worker');
const ShiftPost = require('../Models/ShiftPost');
const ShiftApplication = require('../Models/ShiftApplication');
const ShiftBooking = require('../Models/ShiftBooking');
const BusinessConfig = require('../Models/BusinessConfig');
const Conversation = require('../Models/Conversation');
const Message = require('../Models/Message');
const { tenantAuth } = require('../middleware/tenantAuth');
const { uploadImage, isSpacesConfigured } = require('../services/imageUploadService');
const logger = require('../utils/logger');

// Multer en memoria para imágenes (foto perfil, KYC)
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB para fotos de cédula
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.mimetype);
    cb(ok ? null : new Error('Solo imágenes JPG/PNG/WebP'), ok);
  },
});

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
      'cedula', 'skills', 'languages', 'availability', 'acceptsSOS',
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
 *  WORKER — foto de perfil
 * ───────────────────────────────────────────── */

// POST /crew/workers/me/photo (multipart: file=imagen)
router.post('/workers/me/photo', requireWorker, memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Falta el archivo' });
    if (!isSpacesConfigured()) return res.status(503).json({ message: 'Storage no configurado' });
    const result = await uploadImage(req.file.buffer, 'crew/profile-photos', { maxWidth: 600, quality: 82 });
    req.worker.photo = result.url;
    await req.worker.save();
    res.json({ success: true, photo: result.url, worker: req.worker });
  } catch (e) {
    logger.error('crew photo upload error', e);
    res.status(500).json({ message: e.message || 'Error al subir foto' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — experiencias, educación, referencias (CV)
 * ───────────────────────────────────────────── */

// POST /crew/workers/me/experiences
router.post('/workers/me/experiences', requireWorker, async (req, res) => {
  try {
    const { company, role, startDate, endDate, description, city } = req.body || {};
    if (!company || !role || !startDate) {
      return res.status(400).json({ message: 'company, role y startDate son requeridos' });
    }
    req.worker.experiences.push({ company, role, startDate, endDate: endDate || null, description: description || '', city: city || '' });
    await req.worker.save();
    res.status(201).json({ success: true, worker: req.worker });
  } catch (e) {
    logger.error('crew add experience error', e);
    res.status(500).json({ message: e.message || 'Error al agregar experiencia' });
  }
});

// DELETE /crew/workers/me/experiences/:id
router.delete('/workers/me/experiences/:id', requireWorker, async (req, res) => {
  req.worker.experiences = req.worker.experiences.filter((e) => String(e._id) !== req.params.id);
  await req.worker.save();
  res.json({ success: true, worker: req.worker });
});

// POST /crew/workers/me/education
router.post('/workers/me/education', requireWorker, async (req, res) => {
  try {
    const { institution, degree, fieldOfStudy, startYear, endYear, isCurrent } = req.body || {};
    if (!institution) return res.status(400).json({ message: 'institution requerida' });
    req.worker.education.push({
      institution, degree: degree || '', fieldOfStudy: fieldOfStudy || '',
      startYear: startYear || null, endYear: endYear || null, isCurrent: !!isCurrent,
    });
    await req.worker.save();
    res.status(201).json({ success: true, worker: req.worker });
  } catch (e) {
    logger.error('crew add education error', e);
    res.status(500).json({ message: e.message || 'Error al agregar educación' });
  }
});

// DELETE /crew/workers/me/education/:id
router.delete('/workers/me/education/:id', requireWorker, async (req, res) => {
  req.worker.education = req.worker.education.filter((e) => String(e._id) !== req.params.id);
  await req.worker.save();
  res.json({ success: true, worker: req.worker });
});

// POST /crew/workers/me/references
router.post('/workers/me/references', requireWorker, async (req, res) => {
  const { name, relation, phone, email } = req.body || {};
  if (!name || !relation) return res.status(400).json({ message: 'name y relation requeridos' });
  req.worker.references.push({ name, relation, phone: phone || '', email: email || '' });
  await req.worker.save();
  res.status(201).json({ success: true, worker: req.worker });
});

// DELETE /crew/workers/me/references/:id
router.delete('/workers/me/references/:id', requireWorker, async (req, res) => {
  req.worker.references = req.worker.references.filter((r) => String(r._id) !== req.params.id);
  await req.worker.save();
  res.json({ success: true, worker: req.worker });
});

/* ─────────────────────────────────────────────
 *  WORKER — KYC (verificación de cédula propia)
 * ───────────────────────────────────────────── */

// POST /crew/workers/me/kyc/submit (multipart: cedulaFront, cedulaBack, selfie)
router.post(
  '/workers/me/kyc/submit',
  requireWorker,
  memUpload.fields([
    { name: 'cedulaFront', maxCount: 1 },
    { name: 'cedulaBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { cedulaFront, cedulaBack, selfie } = req.files || {};
      if (!cedulaFront?.[0] || !cedulaBack?.[0] || !selfie?.[0]) {
        return res.status(400).json({ message: 'Faltan documentos: cedulaFront, cedulaBack, selfie' });
      }
      const { cedulaNumber } = req.body || {};
      if (cedulaNumber) req.worker.cedula = cedulaNumber.trim();

      // Subir las 3 imágenes a Spaces bajo /crew/kyc/<workerId>/
      const folder = `crew/kyc/${req.worker._id}`;
      const [frontRes, backRes, selfieRes] = await Promise.all([
        uploadImage(cedulaFront[0].buffer, folder, { maxWidth: 1400, quality: 88 }),
        uploadImage(cedulaBack[0].buffer, folder, { maxWidth: 1400, quality: 88 }),
        uploadImage(selfie[0].buffer, folder, { maxWidth: 1200, quality: 88 }),
      ]);

      req.worker.kyc.cedulaFrontUrl = frontRes.url;
      req.worker.kyc.cedulaBackUrl = backRes.url;
      req.worker.kyc.selfieUrl = selfieRes.url;
      req.worker.kyc.status = 'pending';
      req.worker.kyc.submittedAt = new Date();
      req.worker.kyc.rejectionReason = null;
      await req.worker.save();

      res.json({ success: true, kyc: req.worker.kyc });
    } catch (e) {
      logger.error('crew kyc submit error', e);
      res.status(500).json({ message: e.message || 'Error al subir documentos' });
    }
  }
);

// GET /crew/workers/me/kyc — estado
router.get('/workers/me/kyc', requireWorker, async (req, res) => {
  res.json({ success: true, kyc: req.worker.kyc, cedula: req.worker.cedula });
});

/* ─────────────────────────────────────────────
 *  CHAT — conversaciones (worker side y business side)
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/conversations
router.get('/workers/me/conversations', requireWorker, async (req, res) => {
  const convs = await Conversation.find({ workerId: req.worker._id })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate('businessId', 'businessName logo coverImage')
    .lean();
  res.json({ success: true, conversations: convs });
});

// GET /crew/businesses/conversations  (tenantAuth — business side)
router.get('/businesses/conversations', tenantAuth, async (req, res) => {
  const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
  const convs = await Conversation.find({ businessId })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .populate('workerId', 'name photo level rating')
    .lean();
  res.json({ success: true, conversations: convs });
});

// POST /crew/conversations  — crear o reusar conversación (worker o business)
// Body: { workerId, businessId, bookingId? }  (lado business)
// Body: { businessId, bookingId? }            (lado worker — workerId del token)
router.post('/conversations/start', async (req, res, next) => {
  // Detectar quién llama por el token
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.kind === 'worker') {
      const { businessId, bookingId } = req.body || {};
      if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
      const conv = await Conversation.findOneAndUpdate(
        { workerId: decoded.id, businessId, bookingId: bookingId || null },
        { $setOnInsert: { workerId: decoded.id, businessId, bookingId: bookingId || null } },
        { new: true, upsert: true }
      );
      return res.json({ success: true, conversation: conv });
    } else {
      // Asumimos admin del negocio
      const { workerId, bookingId } = req.body || {};
      if (!workerId) return res.status(400).json({ message: 'workerId requerido' });
      const businessId = req.body.businessId || decoded.businessId;
      if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
      const conv = await Conversation.findOneAndUpdate(
        { workerId, businessId, bookingId: bookingId || null },
        { $setOnInsert: { workerId, businessId, bookingId: bookingId || null } },
        { new: true, upsert: true }
      );
      return res.json({ success: true, conversation: conv });
    }
  } catch (e) {
    logger.error('crew start conversation error', e);
    return res.status(401).json({ message: 'Token inválido' });
  }
});

// GET /crew/conversations/:id/messages — ambos lados pueden leer si participan
router.get('/conversations/:id/messages', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ message: 'Conversación no encontrada' });
    // Validar participación
    if (decoded.kind === 'worker' && String(conv.workerId) !== String(decoded.id)) {
      return res.status(403).json({ message: 'No eres parte de esta conversación' });
    }
    if (decoded.kind !== 'worker' && String(conv.businessId) !== String(decoded.businessId)) {
      return res.status(403).json({ message: 'No eres parte de esta conversación' });
    }
    const messages = await Message.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Marcar como leídos los mensajes que NO son míos
    const myKind = decoded.kind === 'worker' ? 'worker' : 'business';
    await Message.updateMany(
      { conversationId: conv._id, senderKind: { $ne: myKind }, readAt: null },
      { $set: { readAt: new Date() } }
    );
    // Reset contador no leídos del lector
    if (myKind === 'worker') conv.workerUnread = 0;
    else conv.businessUnread = 0;
    await conv.save();

    res.json({ success: true, conversation: conv, messages });
  } catch (e) {
    logger.error('crew list messages error', e);
    res.status(401).json({ message: 'Token inválido' });
  }
});

// POST /crew/conversations/:id/messages — envía mensaje
router.post('/conversations/:id/messages', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { body, attachmentUrl } = req.body || {};
    if (!body && !attachmentUrl) return res.status(400).json({ message: 'Mensaje vacío' });

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ message: 'Conversación no encontrada' });

    const isWorker = decoded.kind === 'worker';
    if (isWorker && String(conv.workerId) !== String(decoded.id)) {
      return res.status(403).json({ message: 'No eres parte de esta conversación' });
    }
    if (!isWorker && String(conv.businessId) !== String(decoded.businessId)) {
      return res.status(403).json({ message: 'No eres parte de esta conversación' });
    }

    const msg = await Message.create({
      conversationId: conv._id,
      senderKind: isWorker ? 'worker' : 'business',
      senderId: isWorker ? decoded.id : decoded.id,
      body: (body || '').slice(0, 2000),
      attachmentUrl: attachmentUrl || null,
    });

    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = (body || '[imagen]').slice(0, 100);
    if (isWorker) conv.businessUnread += 1;
    else conv.workerUnread += 1;
    await conv.save();

    // Emitir por socket si está disponible
    const io = req.app.get('io');
    if (io) {
      io.to(`crew-conv-${conv._id}`).emit('crew-message', { conversationId: String(conv._id), message: msg });
    }

    res.status(201).json({ success: true, message: msg });
  } catch (e) {
    logger.error('crew post message error', e);
    res.status(500).json({ message: e.message || 'Error al enviar mensaje' });
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
