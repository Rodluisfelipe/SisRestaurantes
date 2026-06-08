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
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const Conversation = require('../Models/Conversation');
const Message = require('../Models/Message');
const CrewFavorite = require('../Models/CrewFavorite');
const CrewWalletTxn = require('../Models/CrewWalletTxn');
const CrewWithdrawalRequest = require('../Models/CrewWithdrawalRequest');
const CrewRechargeRequest = require('../Models/CrewRechargeRequest');
const { tenantAuth } = require('../middleware/tenantAuth');
const { uploadImage, isSpacesConfigured } = require('../services/imageUploadService');
const crewLedger = require('../services/crewLedger');
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
 *  WORKER — misiones diarias (daily quests)
 *  Las misiones se computan server-side a partir del estado real del worker:
 *  postulaciones de hoy, completitud del perfil, racha, KYC enviado, etc.
 *  El worker reclama el XP via /claim cuando una misión está al 100%.
 *  Se reinicia el contador `claimed` al cambiar el día (Bogotá).
 * ───────────────────────────────────────────── */

function bogotaToday() {
  // 'YYYY-MM-DD' en hora Colombia (sin DST → -05:00 fijo).
  const now = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

const QUEST_DEFS = [
  {
    key: 'apply_today',
    title: 'Postúlate a un turno',
    desc: 'Envía al menos una postulación hoy',
    reward: 30,
    icon: 'send',
    requires: 1,
  },
  {
    key: 'profile_complete',
    title: 'Perfil completo',
    desc: 'Agrega universidad, bio, foto y al menos una habilidad',
    reward: 50,
    icon: 'user',
  },
  {
    key: 'week_streak',
    title: 'Racha de 3 días',
    desc: 'Trabaja 3 días consecutivos esta semana',
    reward: 100,
    icon: 'fire',
    requires: 3,
  },
  {
    key: 'submit_kyc',
    title: 'Verifica tu identidad',
    desc: 'Sube tu cédula y selfie para activar tu perfil',
    reward: 80,
    icon: 'shield',
  },
];

async function computeQuestState(worker) {
  // Resetear claimed si cambió el día
  const today = bogotaToday();
  if (worker.dailyQuestsState?.date !== today) {
    worker.dailyQuestsState = { date: today, claimed: [] };
  }

  const startOfBogotaDay = new Date(`${today}T00:00:00-05:00`);
  const appliedToday = await ShiftApplication.countDocuments({
    workerId: worker._id,
    appliedAt: { $gte: startOfBogotaDay },
  });

  // Progress por misión (0..1)
  const profileScore = [
    !!worker.university,
    !!(worker.bio && worker.bio.trim().length >= 20),
    !!worker.photo,
    (worker.skills || []).length > 0,
  ].filter(Boolean).length / 4;

  const kycSubmitted = ['pending', 'approved'].includes(worker.kyc?.status);
  const claimedSet = new Set(worker.dailyQuestsState.claimed || []);

  return QUEST_DEFS.map((def) => {
    let progress = 0;
    if (def.key === 'apply_today') progress = Math.min(1, appliedToday / def.requires);
    else if (def.key === 'profile_complete') progress = profileScore;
    else if (def.key === 'week_streak') progress = Math.min(1, (worker.streakDays || 0) / def.requires);
    else if (def.key === 'submit_kyc') progress = kycSubmitted ? 1 : 0;
    return { ...def, progress, claimed: claimedSet.has(def.key) };
  });
}

// GET /crew/workers/me/quests — lista de misiones del día
router.get('/workers/me/quests', requireWorker, async (req, res) => {
  try {
    const quests = await computeQuestState(req.worker);
    await req.worker.save(); // persiste el reset diario si tocó
    res.json({ success: true, date: bogotaToday(), quests });
  } catch (e) {
    logger.error('crew quests list error', e);
    res.status(500).json({ message: e.message || 'Error al cargar misiones' });
  }
});

// POST /crew/workers/me/quests/:key/claim — reclamar XP de una misión completada
router.post('/workers/me/quests/:key/claim', requireWorker, async (req, res) => {
  try {
    const { key } = req.params;
    const def = QUEST_DEFS.find((q) => q.key === key);
    if (!def) return res.status(404).json({ message: 'Misión no encontrada' });

    const quests = await computeQuestState(req.worker);
    const target = quests.find((q) => q.key === key);
    if (target.claimed) return res.status(400).json({ message: 'Ya reclamaste esta misión hoy' });
    if (target.progress < 1) return res.status(400).json({ message: 'Aún no completas la misión' });

    req.worker.dailyQuestsState.claimed.push(key);
    await req.worker.save();
    const result = await Worker.addXP(req.worker._id, def.reward);

    res.json({
      success: true,
      reward: def.reward,
      worker: result.worker,
      leveledUp: result.leveledUp,
      quests: quests.map((q) => (q.key === key ? { ...q, claimed: true } : q)),
    });
  } catch (e) {
    logger.error('crew quest claim error', e);
    res.status(500).json({ message: e.message || 'Error al reclamar la misión' });
  }
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

    // Menú del negocio para que el worker se haga una idea del lugar (solo lectura)
    const [categories, products] = await Promise.all([
      Category.find({ businessId: shift.businessId._id }).sort({ displayOrder: 1, name: 1 }).lean(),
      Product.find({ businessId: shift.businessId._id, active: true })
        .sort({ displayOrder: 1, name: 1 })
        .select('name description price image category displayOrder')
        .lean(),
    ]);

    // Agrupar productos por categoría para render directo
    const byCategory = {};
    for (const p of products) {
      const k = String(p.category || 'sin_categoria');
      if (!byCategory[k]) byCategory[k] = [];
      byCategory[k].push(p);
    }
    const menu = categories.map((c) => ({
      _id: c._id, name: c.name, displayOrder: c.displayOrder || 0,
      products: byCategory[String(c._id)] || [],
    })).filter((c) => c.products.length > 0);
    if (byCategory.sin_categoria?.length) {
      menu.push({ _id: 'sin_categoria', name: 'Otros', displayOrder: 999, products: byCategory.sin_categoria });
    }

    res.json({
      success: true,
      shift,
      transparency: {
        scores,
        recentReviews: recentReviews.map(r => r.reviewByWorker),
      },
      menu,
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

    const totalPay = Math.round(Number(hoursTotal) * Number(hourlyRate));
    const wn = Number(workersNeeded || 1);
    const quote = crewLedger.quoteShiftEscrow({ totalPay, workersNeeded: wn, isSOS: !!isSOS });

    // Validar saldo ANTES de crear el shift, para no dejar shifts huérfanos si
    // el negocio no puede pagar. La reserva real ocurre después con findOneAndUpdate
    // atómico (cubre la race condition de dos posts simultáneos).
    const available = biz.crewWallet?.balance || 0;
    if (available < quote.totalReserveNeeded) {
      return res.status(402).json({
        message: `Saldo Crew insuficiente. Necesitas ${quote.totalReserveNeeded.toLocaleString('es-CO')} COP y tienes ${available.toLocaleString('es-CO')} COP.`,
        code: 'INSUFFICIENT_FUNDS',
        required: quote.totalReserveNeeded,
        available,
        quote,
      });
    }

    const shift = new ShiftPost({
      businessId,
      postedBy: req.user.id,
      title, description: description || '', role,
      skillsBonus: (skillsBonus || []).filter(s => VALID_SKILLS.includes(s)),
      date: new Date(date), startTime, endTime, hoursTotal,
      workersNeeded: wn,
      hourlyRate,
      totalPay,
      requirements: requirements || {},
      perks: perks || [],
      visibility: visibility || 'public',
      matchMode: matchMode || 'open',
      isSOS: !!isSOS,
      commissionRate: quote.commissionRate,
      commissionAmount: quote.commissionPerWorker,
      reservedAmount: quote.totalReserveNeeded,
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

    // Reserva atómica del escrow. Si falla, eliminamos el shift huérfano.
    try {
      const result = await crewLedger.reserveShiftEscrow({
        businessId, shift, performedBy: { kind: 'admin', id: req.user.id },
      });
      res.status(201).json({ success: true, shift, escrow: result.quote, wallet: result.wallet });
    } catch (reserveErr) {
      await ShiftPost.deleteOne({ _id: shift._id }).catch(() => {});
      if (reserveErr.code === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({
          message: reserveErr.message, code: 'INSUFFICIENT_FUNDS',
          required: reserveErr.required, available: reserveErr.available,
        });
      }
      throw reserveErr;
    }
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

// GET /crew/businesses/workers/:workerId — perfil completo del worker
// Solo accesible si este worker tiene application o booking con este business.
router.get('/businesses/workers/:workerId', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const { workerId } = req.params;
    if (!mongoose.isValidObjectId(workerId)) return res.status(400).json({ message: 'workerId inválido' });

    // Verifica que haya relación previa (application o booking)
    const hasApp = await ShiftApplication.exists({ workerId, businessId });
    const hasBooking = await ShiftBooking.exists({ workerId, businessId });
    if (!hasApp && !hasBooking) {
      return res.status(403).json({ message: 'No hay relación con este trabajador' });
    }

    const worker = await Worker.findById(workerId)
      .select('-password -refreshToken -payoutMethod -cedula -kyc.cedulaFrontUrl -kyc.cedulaBackUrl -kyc.selfieUrl -wallet')
      .lean();
    if (!worker) return res.status(404).json({ message: 'Trabajador no encontrado' });

    // Sanitizar: las referencias no exponen teléfono/email completos al business
    if (worker.references) {
      worker.references = worker.references.map(r => ({
        name: r.name, relation: r.relation,
        hasContact: !!(r.phone || r.email),
      }));
    }

    // Historial de turnos completados con este negocio
    const pastBookings = await ShiftBooking.find({
      workerId, businessId, status: 'completed',
    }).select('agreedTotal completedAt reviewByBusiness').sort({ completedAt: -1 }).limit(5).lean();

    res.json({ success: true, worker, pastBookings });
  } catch (e) {
    logger.error('crew worker profile error', e);
    res.status(500).json({ message: e.message || 'Error al cargar perfil' });
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
      .populate('workerId', 'name photo level xp rating stats badgesEarned skills languages university bio experiences education references kyc.status acceptsSOS streakDays hourlyRate location')
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

    // Crear booking — snapshot del pago y la comisión vigente al momento del accept,
    // para que cambios posteriores en tasas no muevan lo ya pactado.
    const booking = await ShiftBooking.create({
      shiftId: shift._id, workerId: app.workerId, businessId: shift.businessId,
      agreedRate: shift.hourlyRate, agreedHours: shift.hoursTotal,
      agreedTotal: shift.totalPay,
      agreedCommission: shift.commissionAmount,
      payoutStatus: 'held',
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
    await booking.save();

    // Libera el dinero a través del ledger: business.pendingBalance → worker.wallet.balance,
    // y la comisión va al ingreso de la plataforma. Esto reemplaza el "MVP directo" anterior.
    await crewLedger.releaseBookingFunds({
      bookingId: booking._id,
      performedBy: { kind: 'admin', id: req.user.id },
    });

    // Awards: XP + stats + posible badge — la billetera ya quedó actualizada por el ledger.
    const xpGained = Math.round(booking.agreedHours * 25); // 25 XP por hora trabajada
    const result = await Worker.addXP(booking.workerId, xpGained);
    const worker = result.worker;
    worker.stats.shiftsCompleted += 1;
    worker.stats.hoursWorked += booking.agreedHours;
    worker.lastShiftAt = new Date();

    if (worker.stats.shiftsCompleted === 1 && !worker.badgesEarned.some(b => b.key === 'first_shift')) {
      worker.badgesEarned.push({ key: 'first_shift' });
      booking.badgesAwarded.push('first_shift');
    }
    if (worker.stats.shiftsCompleted === 10 && !worker.badgesEarned.some(b => b.key === '10_shifts')) {
      worker.badgesEarned.push({ key: '10_shifts' });
      booking.badgesAwarded.push('10_shifts');
    }

    booking.xpAwarded = xpGained;
    await booking.save();
    await worker.save();

    res.json({
      success: true, booking,
      leveledUp: result.leveledUp,
      xpGained,
      payout: booking.agreedTotal,
      commission: booking.agreedCommission,
    });
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

/* ─────────────────────────────────────────────
 *  WORKER — Favoritos (restaurantes guardados)
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/favorites
router.get('/workers/me/favorites', requireWorker, async (req, res) => {
  try {
    const favs = await CrewFavorite.find({ workerId: req.worker._id })
      .sort({ createdAt: -1 })
      .populate('businessId', 'businessName logo coverImage address businessType')
      .lean();
    res.json({ success: true, favorites: favs });
  } catch (e) {
    logger.error('crew favorites list error', e);
    res.status(500).json({ message: 'Error al cargar favoritos' });
  }
});

// POST /crew/workers/me/favorites — agregar favorito
router.post('/workers/me/favorites', requireWorker, async (req, res) => {
  try {
    const { businessId, note } = req.body || {};
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const existing = await CrewFavorite.findOne({ workerId: req.worker._id, businessId });
    if (existing) return res.json({ success: true, favorite: existing, alreadyExists: true });
    const fav = await CrewFavorite.create({ workerId: req.worker._id, businessId, note: note || '' });
    res.status(201).json({ success: true, favorite: fav });
  } catch (e) {
    logger.error('crew add favorite error', e);
    res.status(500).json({ message: 'Error al agregar favorito' });
  }
});

// DELETE /crew/workers/me/favorites/:businessId — quitar favorito
router.delete('/workers/me/favorites/:businessId', requireWorker, async (req, res) => {
  try {
    await CrewFavorite.deleteOne({ workerId: req.worker._id, businessId: req.params.businessId });
    res.json({ success: true });
  } catch (e) {
    logger.error('crew remove favorite error', e);
    res.status(500).json({ message: 'Error al quitar favorito' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — Wallet (historial y retiro)
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/wallet — balance + historial de movimientos
router.get('/workers/me/wallet', requireWorker, async (req, res) => {
  try {
    const w = req.worker;
    // Construimos historial a partir de bookings completados
    const completedBookings = await ShiftBooking.find({
      workerId: w._id,
      status: 'completed',
    })
      .sort({ completedAt: -1 })
      .limit(30)
      .populate('businessId', 'businessName logo')
      .populate('shiftId', 'title role date')
      .lean();

    const movements = completedBookings.map((b) => ({
      _id: b._id,
      type: 'income',
      amount: b.agreedTotal,
      description: b.shiftId?.title || 'Turno completado',
      businessName: b.businessId?.businessName || 'Negocio',
      businessLogo: b.businessId?.logo || null,
      date: b.completedAt || b.updatedAt,
    }));

    res.json({
      success: true,
      wallet: {
        balance: w.wallet?.balance || 0,
        pendingBalance: w.wallet?.pendingBalance || 0,
        currency: 'COP',
      },
      payoutMethod: w.payoutMethod || null,
      rates: { minWithdrawal: crewLedger.MIN_WITHDRAWAL },
      movements,
    });
  } catch (e) {
    logger.error('crew wallet error', e);
    res.status(500).json({ message: 'Error al cargar wallet' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — Check-out (finalizar turno desde su lado)
 * ───────────────────────────────────────────── */

// POST /crew/bookings/:id/checkout
router.post('/bookings/:id/checkout', requireWorker, async (req, res) => {
  try {
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking no encontrado' });
    if (String(booking.workerId) !== String(req.worker._id)) {
      return res.status(403).json({ message: 'No es tu booking' });
    }
    if (booking.status !== 'checked_in') {
      return res.status(400).json({ message: 'Solo puedes hacer check-out en turnos activos (checked_in)' });
    }
    // Worker marca fin — el business aún debe confirmar para liberar pago
    booking.completedAt = new Date();
    booking.status = 'completed';
    booking.payoutStatus = 'held'; // pendiente de confirmación del business
    await booking.save();

    res.json({ success: true, booking });
  } catch (e) {
    logger.error('crew checkout error', e);
    res.status(500).json({ message: 'Error al hacer check-out' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — Historial laboral (resumen automático)
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/work-history — CV automático
router.get('/workers/me/work-history', requireWorker, async (req, res) => {
  try {
    const bookings = await ShiftBooking.find({
      workerId: req.worker._id,
      status: 'completed',
    })
      .sort({ completedAt: -1 })
      .populate('businessId', 'businessName logo businessType address')
      .populate('shiftId', 'title role date startTime endTime')
      .lean();

    // Agrupar por negocio
    const byBusiness = {};
    for (const b of bookings) {
      const bizId = String(b.businessId?._id || b.businessId);
      if (!byBusiness[bizId]) {
        byBusiness[bizId] = {
          business: b.businessId,
          shifts: [],
          totalHours: 0,
          totalEarned: 0,
          avgRating: null,
          ratings: [],
        };
      }
      byBusiness[bizId].shifts.push(b);
      byBusiness[bizId].totalHours += b.agreedHours || 0;
      byBusiness[bizId].totalEarned += b.agreedTotal || 0;
      if (b.reviewByBusiness?.rating) byBusiness[bizId].ratings.push(b.reviewByBusiness.rating);
    }

    const history = Object.values(byBusiness).map((entry) => ({
      business: entry.business,
      shiftsCount: entry.shifts.length,
      totalHours: entry.totalHours,
      totalEarned: entry.totalEarned,
      avgRating: entry.ratings.length > 0
        ? Math.round((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length) * 10) / 10
        : null,
      firstShift: entry.shifts[entry.shifts.length - 1]?.shiftId?.date || null,
      lastShift: entry.shifts[0]?.shiftId?.date || null,
      roles: [...new Set(entry.shifts.map((s) => s.shiftId?.role).filter(Boolean))],
    }));

    res.json({
      success: true,
      history,
      summary: {
        totalBusinesses: history.length,
        totalShifts: bookings.length,
        totalHours: req.worker.stats?.hoursWorked || 0,
        totalEarned: req.worker.stats?.totalEarned || 0,
        avgRating: req.worker.rating?.avg || 0,
        memberSince: req.worker.createdAt,
      },
    });
  } catch (e) {
    logger.error('crew work-history error', e);
    res.status(500).json({ message: 'Error al cargar historial' });
  }
});

/* ─────────────────────────────────────────────
 *  BUSINESS — billetera Crew (recarga, saldo, extracto, cancelación)
 *  Toda plata que se mueva en turnos pasa por acá. Es la regla central
 *  del modelo de negocio.
 * ───────────────────────────────────────────── */

// GET /crew/businesses/wallet — saldo, pendings y resumen
router.get('/businesses/wallet', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const biz = await BusinessConfig.findById(businessId).select('crewWallet businessName').lean();
    if (!biz) return res.status(404).json({ message: 'Negocio no encontrado' });

    res.json({
      success: true,
      wallet: biz.crewWallet || {
        balance: 0, pendingBalance: 0, totalReserved: 0, totalSpent: 0, totalCommissionPaid: 0, currency: 'COP',
      },
      meta: { businessName: biz.businessName },
      rates: {
        standardCommission: crewLedger.STANDARD_COMMISSION,
        sosCommission: crewLedger.SOS_COMMISSION,
        minRecharge: crewLedger.MIN_RECHARGE,
      },
    });
  } catch (e) {
    logger.error('crew biz wallet error', e);
    res.status(500).json({ message: e.message || 'Error al cargar billetera' });
  }
});

// POST /crew/businesses/wallet/recharge — recarga manual (MVP).
// En producción esto vendría tras callback de ePayco/dLocal con su reference.
router.post('/businesses/wallet/recharge', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.body.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const { amount, externalReference } = req.body || {};
    if (!Number.isFinite(amount)) return res.status(400).json({ message: 'amount inválido' });

    const result = await crewLedger.depositBusinessWallet({
      businessId,
      amount: Math.round(amount),
      idempotencyKey: externalReference || null,
      note: externalReference ? `Recarga ref: ${externalReference}` : 'Recarga manual',
      performedBy: { kind: 'admin', id: req.user.id },
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (e.code === 'AMOUNT_BELOW_MIN') {
      return res.status(400).json({ message: e.message, code: e.code });
    }
    logger.error('crew biz wallet recharge error', e);
    res.status(500).json({ message: e.message || 'Error al recargar' });
  }
});

// POST /crew/businesses/wallet/recharge-requests — el negocio sube comprobante para que SuperAdmin apruebe
router.post(
  '/businesses/wallet/recharge-requests',
  tenantAuth,
  memUpload.single('proof'),
  async (req, res) => {
    try {
      const businessId = req.resolvedBusinessId || req.user?.businessId || req.body.businessId;
      if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
      const { amount, paymentMethod } = req.body || {};
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < crewLedger.MIN_RECHARGE) {
        return res.status(400).json({ message: `Monto mínimo: ${crewLedger.MIN_RECHARGE.toLocaleString('es-CO')} COP` });
      }
      if (!['Nequi', 'Daviplata', 'Breve', 'Transferencia', 'OTHER'].includes(paymentMethod)) {
        return res.status(400).json({ message: 'Método de pago inválido' });
      }
      if (!req.file) return res.status(400).json({ message: 'Falta el comprobante (imagen)' });
      if (!isSpacesConfigured()) return res.status(503).json({ message: 'Storage no configurado' });

      // Sube el comprobante a Spaces
      const upload = await uploadImage(req.file.buffer, `crew/recharges/${businessId}`, {
        maxWidth: 1600, quality: 88,
      });

      const request = await CrewRechargeRequest.create({
        businessId, amount: Math.round(amt), paymentMethod, proofUrl: upload.url,
        notes: (req.body.notes || '').slice(0, 200),
      });

      const io = req.app.get('io');
      if (io) io.to('superadmin-channel').emit('crew-recharge-pending', { request });

      res.status(201).json({ success: true, request });
    } catch (e) {
      logger.error('crew recharge request error', e);
      res.status(500).json({ message: e.message || 'Error al crear solicitud' });
    }
  }
);

// GET /crew/businesses/wallet/recharge-requests — historial del negocio
router.get('/businesses/wallet/recharge-requests', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const requests = await CrewRechargeRequest.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, requests });
  } catch (e) {
    logger.error('crew recharge list error', e);
    res.status(500).json({ message: e.message || 'Error al listar solicitudes' });
  }
});

// GET /crew/businesses/wallet/transactions — extracto paginado
router.get('/businesses/wallet/transactions', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const { limit = 50, kind } = req.query;
    const q = { actorType: 'business', actorId: new mongoose.Types.ObjectId(businessId) };
    if (kind) q.kind = kind;
    const txns = await CrewWalletTxn.find(q)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 200))
      .populate('shiftId', 'title date')
      .populate('counterpartId', 'name')
      .lean();
    res.json({ success: true, transactions: txns });
  } catch (e) {
    logger.error('crew biz wallet txns error', e);
    res.status(500).json({ message: e.message || 'Error al cargar extracto' });
  }
});

// POST /crew/businesses/wallet/quote-shift — calcula cuánto va a costar un turno
// (utilidad para el form de "Publicar turno" — muestra escrow antes de enviar).
router.post('/businesses/wallet/quote-shift', tenantAuth, async (req, res) => {
  const { totalPay, hoursTotal, hourlyRate, workersNeeded = 1, isSOS = false } = req.body || {};
  const computedTotal = Number(totalPay) || (Number(hoursTotal) * Number(hourlyRate));
  if (!computedTotal) return res.status(400).json({ message: 'Faltan datos de pago' });
  const quote = crewLedger.quoteShiftEscrow({
    totalPay: Math.round(computedTotal),
    workersNeeded: Number(workersNeeded),
    isSOS: !!isSOS,
  });
  res.json({ success: true, quote });
});

// POST /crew/businesses/shifts/:id/cancel — cancela turno y aplica reglas de refund
router.post('/businesses/shifts/:id/cancel', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.body.businessId;
    const shift = await ShiftPost.findById(req.params.id);
    if (!shift || String(shift.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }
    const { reason } = req.body || {};
    const result = await crewLedger.cancelShiftPost({
      shiftId: shift._id,
      reason,
      performedBy: { kind: 'admin', id: req.user.id },
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (e.code === 'INVALID_STATE') return res.status(400).json({ message: e.message });
    logger.error('crew biz cancel shift error', e);
    res.status(500).json({ message: e.message || 'Error al cancelar' });
  }
});

/* ─────────────────────────────────────────────
 *  WORKER — billetera (extracto + retiros)
 *  Nota: GET /workers/me/wallet está definido más arriba con `movements`
 *  pre-construidos para la UI vieja. Mantenemos ese y exponemos solo
 *  los endpoints nuevos acá abajo.
 * ───────────────────────────────────────────── */

// GET /crew/workers/me/wallet/transactions
router.get('/workers/me/wallet/transactions', requireWorker, async (req, res) => {
  const { limit = 50, kind } = req.query;
  const q = { actorType: 'worker', actorId: req.worker._id };
  if (kind) q.kind = kind;
  const txns = await CrewWalletTxn.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 200))
    .populate('shiftId', 'title date')
    .populate('counterpartId', 'businessName')
    .lean();
  res.json({ success: true, transactions: txns });
});

// POST /crew/workers/me/wallet/withdraw — solicitar retiro
router.post('/workers/me/wallet/withdraw', requireWorker, async (req, res) => {
  try {
    const { amount, payoutMethod } = req.body || {};
    const result = await crewLedger.requestWithdrawal({
      workerId: req.worker._id,
      amount: Math.round(Number(amount)),
      payoutMethod,
    });
    res.status(201).json({ success: true, ...result });
  } catch (e) {
    if (['AMOUNT_BELOW_MIN', 'MISSING_PAYOUT', 'INSUFFICIENT_FUNDS'].includes(e.code)) {
      return res.status(400).json({ message: e.message, code: e.code });
    }
    logger.error('crew worker withdrawal error', e);
    res.status(500).json({ message: e.message || 'Error al solicitar retiro' });
  }
});

// GET /crew/workers/me/wallet/withdrawals — lista de retiros del worker
router.get('/workers/me/wallet/withdrawals', requireWorker, async (req, res) => {
  const withdrawals = await CrewWithdrawalRequest.find({ workerId: req.worker._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ success: true, withdrawals });
});

module.exports = router;
