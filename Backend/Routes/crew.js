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
const CrewEmployer = require('../Models/CrewEmployer');
const Vacancy = require('../Models/Vacancy');
const VacancyApplication = require('../Models/VacancyApplication');
const { tenantAuth } = require('../middleware/tenantAuth');
const { requireEmployer, requireEmployerAny } = require('../middleware/crewEmployerAuth');
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
 * Genera un código de check-in de 6 caracteres alfanuméricos sin caracteres
 * ambiguos (0/O/I/1/L). Suficiente entropía para que el worker no lo adivine
 * (32^6 ≈ 1.000 millones) y suficientemente corto para mostrarlo en grande.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCheckInCode() {
  let s = '';
  const arr = new Uint32Array(6);
  // Usamos crypto si está disponible (mejor distribución que Math.random)
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      const buf = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
      return s;
    } catch {}
  }
  for (let i = 0; i < 6; i++) {
    arr[i] = Math.floor(Math.random() * CODE_ALPHABET.length);
    s += CODE_ALPHABET[arr[i]];
  }
  return s;
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
 *  CREW EMPLOYER — auth (negocios/personas externas a MenuBy)
 *  Onboarding curado: signup → status pending_approval → SuperAdmin aprueba.
 * ───────────────────────────────────────────── */

function signEmployerToken(employerId) {
  return jwt.sign({ id: employerId, kind: 'crew_employer' }, JWT_SECRET, { expiresIn: WORKER_TOKEN_TTL });
}

// POST /crew/employers/signup
router.post('/employers/signup', async (req, res) => {
  try {
    const {
      kind, phone, name, password, email,
      // Específicos de business
      businessType, address, whatsappNumber,
    } = req.body || {};

    if (!['individual', 'business'].includes(kind)) {
      return res.status(400).json({ message: 'kind debe ser "individual" o "business"' });
    }
    if (!phone || !name || !password) {
      return res.status(400).json({ message: 'phone, name y password son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Contraseña mínima 6 caracteres' });
    }
    if (kind === 'business' && !businessType) {
      return res.status(400).json({ message: 'businessType requerido para cuentas de negocio' });
    }

    // Chequeo de duplicados también contra Worker (mismo phone) para evitar
    // conflictos de identidad en el ecosistema Crew.
    const exists = await CrewEmployer.findOne({ phone });
    if (exists) return res.status(409).json({ message: 'Ya hay una cuenta con ese teléfono' });

    const employer = await CrewEmployer.create({
      kind,
      phone,
      name: name.trim(),
      password,
      email: email ? email.trim().toLowerCase() : null,
      businessType: kind === 'business' ? businessType : undefined,
      whatsappNumber: whatsappNumber || null,
      address: address || {},
      status: 'pending_approval',
    });

    // Notificar a SuperAdmin via socket si está disponible
    const io = req.app.get('io');
    if (io) io.to('superadmin-channel').emit('crew-employer-pending', {
      employerId: String(employer._id),
      kind,
      name: employer.name,
    });

    const token = signEmployerToken(employer._id);
    res.status(201).json({
      success: true,
      token,
      employer: sanitizeEmployer(employer),
      next: 'pending_approval',
      message: 'Cuenta creada. Estamos revisando tu solicitud. Te avisamos en cuanto se apruebe.',
    });
  } catch (e) {
    logger.error('crew employer signup error', e);
    res.status(500).json({ message: e.message || 'Error al registrar' });
  }
});

// POST /crew/employers/login
router.post('/employers/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};
    const employer = await CrewEmployer.findOne({ phone });
    if (!employer || !(await employer.comparePassword(password))) {
      return res.status(401).json({ message: 'Teléfono o contraseña incorrectos' });
    }
    if (['banned'].includes(employer.status)) {
      return res.status(403).json({ message: 'Tu cuenta está bloqueada.' });
    }
    employer.lastLoginAt = new Date();
    await employer.save();
    const token = signEmployerToken(employer._id);
    res.json({
      success: true,
      token,
      employer: sanitizeEmployer(employer),
    });
  } catch (e) {
    logger.error('crew employer login error', e);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// GET /crew/employers/me — permite ver el perfil aún si está pending/rejected
router.get('/employers/me', requireEmployerAny, async (req, res) => {
  res.json({ success: true, employer: sanitizeEmployer(req.employer) });
});

// PUT /crew/employers/me — actualizar perfil (campos limitados)
router.put('/employers/me', requireEmployerAny, async (req, res) => {
  try {
    const allowed = ['name', 'email', 'photo', 'coverImage', 'description', 'website',
                     'whatsappNumber', 'address', 'location', 'businessType', 'nit', 'birthDate'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    Object.assign(req.employer, patch);
    await req.employer.save();
    res.json({ success: true, employer: sanitizeEmployer(req.employer) });
  } catch (e) {
    logger.error('crew employer update error', e);
    res.status(500).json({ message: e.message || 'Error al actualizar perfil' });
  }
});

function sanitizeEmployer(emp) {
  const o = emp.toObject ? emp.toObject() : emp;
  delete o.password;
  delete o.refreshToken;
  return o;
}

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
      // Para legacy: si no hay ownerDisplay, hacemos populate del business como fallback.
      .populate('businessId', 'businessName slug logo coverImage businessType')
      .lean();

    // Normalizar el shape del card: el frontend lee de `ownerDisplay`, pero los
    // shifts viejos (creados antes del refactor polimórfico) no tienen ese snapshot,
    // así que lo construimos al vuelo desde el businessId populated.
    const enriched = shifts.map((s) => {
      if (!s.ownerDisplay?.name && s.businessId) {
        s.ownerDisplay = {
          name: s.businessId.businessName || '',
          logo: s.businessId.logo || null,
          coverImage: s.businessId.coverImage || null,
          businessType: s.businessId.businessType || '',
          verified: true,
        };
      }
      return { ...s, matchScore: calcMatchScore(s, req.worker) };
    });
    res.json({ success: true, shifts: enriched });
  } catch (e) {
    logger.error('crew feed error', e);
    res.status(500).json({ message: e.message || 'Error al cargar el feed', error: e.name });
  }
});

// GET /crew/shifts/:id — detalle público + transparency
// Polimórfico: si ownerType=business, populate businessId + menú; si crew_employer,
// populate employerId (sin menú, no aplica).
router.get('/shifts/:id', requireWorker, async (req, res) => {
  try {
    let shift = await ShiftPost.findById(req.params.id).lean();
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });

    const ownerType = shift.ownerType || 'business';

    if (ownerType === 'business' && shift.businessId) {
      shift = await ShiftPost.findById(req.params.id)
        .populate('businessId', 'businessName slug logo coverImage description businessType address whatsappNumber')
        .lean();
    } else if (ownerType === 'crew_employer' && shift.employerId) {
      shift = await ShiftPost.findById(req.params.id)
        .populate('employerId', 'name photo coverImage description businessType address whatsappNumber kind verifiedAt')
        .lean();
    }

    // Reviews: para business buscamos por businessId; para crew_employer por employerId.
    const reviewFilter = ownerType === 'business'
      ? { businessId: shift.businessId?._id, 'reviewByWorker.rating': { $exists: true } }
      : { employerId: shift.employerId?._id, 'reviewByWorker.rating': { $exists: true } };

    const [recentReviews, allReviews] = await Promise.all([
      ShiftBooking.find(reviewFilter)
        .sort({ 'reviewByWorker.reviewedAt': -1 })
        .limit(5)
        .select('reviewByWorker')
        .lean(),
      ShiftBooking.find(reviewFilter).select('reviewByWorker').lean(),
    ]);

    const scores = {
      reviewCount: allReviews.length,
      avgRating: allReviews.length
        ? allReviews.reduce((s, b) => s + b.reviewByWorker.rating, 0) / allReviews.length
        : null,
    };

    // Menú: solo aplica para negocios MenuBy (los empleadores Crew no tienen catálogo).
    let menu = [];
    if (ownerType === 'business' && shift.businessId?._id) {
      const [categories, products] = await Promise.all([
        Category.find({ businessId: shift.businessId._id }).sort({ displayOrder: 1, name: 1 }).lean(),
        Product.find({ businessId: shift.businessId._id, active: true })
          .sort({ displayOrder: 1, name: 1 })
          .select('name description price image category displayOrder')
          .lean(),
      ]);
      const byCategory = {};
      for (const p of products) {
        const k = String(p.category || 'sin_categoria');
        if (!byCategory[k]) byCategory[k] = [];
        byCategory[k].push(p);
      }
      menu = categories.map((c) => ({
        _id: c._id, name: c.name, displayOrder: c.displayOrder || 0,
        products: byCategory[String(c._id)] || [],
      })).filter((c) => c.products.length > 0);
      if (byCategory.sin_categoria?.length) {
        menu.push({ _id: 'sin_categoria', name: 'Otros', displayOrder: 999, products: byCategory.sin_categoria });
      }
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

// POST /crew/bookings/:id/checkin — validar con código del empleador
// El negocio le muestra al worker un código de 6 caracteres (que el worker
// ve solo cuando llega físicamente). Sin código correcto no hay check-in,
// así garantizamos presencia real. Lat/lng/foto son opcionales para auditoría.
router.post('/bookings/:id/checkin', requireWorker, async (req, res) => {
  try {
    const { code, lat, lng, photo } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Falta el código de check-in', errorCode: 'MISSING_CODE' });
    }
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking no encontrado' });
    if (String(booking.workerId) !== String(req.worker._id)) {
      return res.status(403).json({ message: 'No es tu booking' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Este turno no se puede check-inear en este estado' });
    }

    // Throttle: si ya falló 8 veces, bloqueamos. El negocio puede regenerar el código.
    if ((booking.checkInAttempts || 0) >= 8) {
      return res.status(429).json({
        message: 'Demasiados intentos. Pide al empleador que regenere el código.',
        errorCode: 'TOO_MANY_ATTEMPTS',
      });
    }

    const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!booking.checkInCode || normalized !== booking.checkInCode) {
      // $inc atómico para que dos intentos simultáneos cuenten ambos.
      const updated = await ShiftBooking.findByIdAndUpdate(
        booking._id,
        { $inc: { checkInAttempts: 1 } },
        { new: true, select: 'checkInAttempts' },
      );
      const attempts = updated?.checkInAttempts || booking.checkInAttempts + 1;
      return res.status(400).json({
        message: 'Código incorrecto. Verifícalo con el empleador.',
        errorCode: 'INVALID_CODE',
        attemptsRemaining: Math.max(0, 8 - attempts),
      });
    }

    // Check-in atómico: solo si sigue en `confirmed`. Bloquea check-in duplicado.
    const checkedIn = await ShiftBooking.findOneAndUpdate(
      { _id: booking._id, status: 'confirmed' },
      {
        $set: {
          status: 'checked_in',
          checkInAt: new Date(),
          checkInLat: lat || null,
          checkInLng: lng || null,
          checkInPhoto: photo || null,
        },
      },
      { new: true },
    );
    if (!checkedIn) {
      return res.status(400).json({
        message: 'Este check-in ya fue registrado.',
        errorCode: 'ALREADY_CHECKED_IN',
      });
    }
    res.json({ success: true, booking: checkedIn });
  } catch (e) {
    logger.error('crew checkin error', e);
    res.status(500).json({ message: 'Error al hacer check-in' });
  }
});

// POST /crew/businesses/bookings/:id/regenerate-checkin-code — solo el negocio
router.post('/businesses/bookings/:id/regenerate-checkin-code', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.body.businessId;
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Solo turnos confirmados pueden regenerar código' });
    }
    booking.checkInCode = generateCheckInCode();
    booking.checkInAttempts = 0;
    await booking.save();
    res.json({ success: true, checkInCode: booking.checkInCode });
  } catch (e) {
    logger.error('crew regenerate code error', e);
    res.status(500).json({ message: 'Error al regenerar' });
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
      ownerType: 'business',
      businessId,
      postedBy: req.user.id,
      ownerDisplay: {
        name: biz.businessName || '',
        logo: biz.logo || null,
        coverImage: biz.coverImage || null,
        businessType: biz.businessType || '',
        verified: true, // los negocios MenuBy son verificados por default
      },
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
      // Auto-expira en la hora exacta de inicio del shift. Antes era +24h
      // fijo desde medianoche de la fecha, lo que dejaba shifts "abiertos"
      // mucho después de empezar.
      expiresAt: (() => {
        const exp = new Date(date);
        if (startTime) {
          const [hh, mm] = String(startTime).split(':');
          if (!Number.isNaN(Number(hh))) exp.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
        }
        return exp;
      })(),
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

// GET /crew/businesses/shifts/:id/bookings — bookings creados de este shift
// Devuelve el checkInCode visible solo para el negocio (auth tenantAuth).
router.get('/businesses/shifts/:id/bookings', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const shift = await ShiftPost.findOne({ _id: req.params.id, businessId });
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });

    const bookings = await ShiftBooking.find({ shiftId: shift._id })
      .populate('workerId', 'name photo phone level rating')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, bookings });
  } catch (e) {
    logger.error('crew biz bookings list error', e);
    res.status(500).json({ message: 'Error al cargar bookings' });
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
// Reservar el cupo es ATÓMICO: $inc condicionado a workersBooked < workersNeeded.
// Esto previene la race "dos accepts simultáneos para el último cupo" que crearía
// dos bookings cuando solo había uno disponible. Si la reserva falla, no creamos
// booking ni cambiamos la application.
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

    // No aceptar a un turno cuya fecha ya pasó
    const shiftPreview = await ShiftPost.findById(app.shiftId).select('date startTime').lean();
    if (shiftPreview?.date) {
      const shiftStart = new Date(shiftPreview.date);
      if (shiftPreview.startTime) {
        const [hh, mm] = String(shiftPreview.startTime).split(':');
        if (!Number.isNaN(Number(hh))) {
          shiftStart.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
        }
      }
      if (shiftStart.getTime() < Date.now()) {
        return res.status(400).json({
          message: 'Este turno ya pasó. No puedes aceptar postulantes.',
          code: 'SHIFT_PAST_DATE',
        });
      }
    }

    // Reserva atómica del cupo. El filtro condicional garantiza que dos accepts
    // simultáneos para el último cupo solo dejan pasar uno. Mongo arbitra.
    const claimedShift = await ShiftPost.findOneAndUpdate(
      {
        _id: app.shiftId,
        status: { $in: ['open', 'partially_filled'] },
        $expr: { $lt: ['$workersBooked', '$workersNeeded'] },
      },
      { $inc: { workersBooked: 1 } },
      { new: true },
    );
    if (!claimedShift) {
      return res.status(409).json({
        message: 'Este turno ya está lleno o no acepta más postulantes.',
        code: 'SHIFT_FULL_OR_CLOSED',
      });
    }
    // Status final del shift según el contador post-inc
    if (claimedShift.workersBooked >= claimedShift.workersNeeded && claimedShift.status !== 'filled') {
      claimedShift.status = 'filled';
      await claimedShift.save();
    } else if (claimedShift.status === 'open' && claimedShift.workersBooked > 0) {
      claimedShift.status = 'partially_filled';
      await claimedShift.save();
    }

    // Crear booking — snapshot del pago y la comisión vigente al momento del accept.
    // `checkInCode`: 6 caracteres alfanuméricos sin ambigüedad (sin 0/O/I/1).
    const checkInCode = generateCheckInCode();
    let booking;
    try {
      booking = await ShiftBooking.create({
        shiftId: claimedShift._id, workerId: app.workerId,
        ownerType: claimedShift.ownerType || 'business',
        businessId: claimedShift.businessId || null,
        employerId: claimedShift.employerId || null,
        agreedRate: claimedShift.hourlyRate, agreedHours: claimedShift.hoursTotal,
        agreedTotal: claimedShift.totalPay,
        agreedCommission: claimedShift.commissionAmount,
        payoutStatus: 'held',
        status: 'confirmed',
        checkInCode,
      });
    } catch (bookingErr) {
      // Rollback del cupo si no pudimos crear el booking — devolvemos la reserva.
      await ShiftPost.findByIdAndUpdate(claimedShift._id, { $inc: { workersBooked: -1 } });
      throw bookingErr;
    }

    // Marcar app aceptada
    app.status = 'accepted';
    app.respondedAt = new Date();
    await app.save();

    // Si el shift quedó lleno con este accept, expirar el resto de applications
    // pending para que los otros workers vean su estado actualizado en su UI.
    // No bloqueamos la respuesta — el bulk corre y respondemos igual.
    let expiredApps = 0;
    if (claimedShift.status === 'filled') {
      const expireRes = await ShiftApplication.updateMany(
        { shiftId: claimedShift._id, status: 'pending', _id: { $ne: app._id } },
        { $set: { status: 'expired', respondedAt: new Date() } },
      );
      expiredApps = expireRes.modifiedCount || 0;
    }

    res.json({ success: true, booking, shiftStatus: claimedShift.status, expiredApps });
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
// Reglas:
//  - El booking DEBE haber pasado por check-in (status: checked_in o completed-stuck)
//    para que el negocio pueda liberar el pago. Esto cierra el agujero por el cual un
//    negocio podía pagar a un worker que nunca llegó.
//  - El admin puede saltarse el check-in en casos excepcionales con `force: true` en el body.
//    Queda registrado en metadata del ledger para auditoría.
router.post('/businesses/bookings/:id/complete', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId || req.query.businessId || req.body.businessId;
    const force = !!req.body?.force;
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.businessId) !== String(businessId)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    // Bloqueo de status: solo `checked_in` o `completed-stuck` pueden completarse.
    // Sin esto, un negocio podría completar un booking sin check-in del worker.
    const isStuckCompleted = booking.status === 'completed' && booking.payoutStatus !== 'released';
    if (!isStuckCompleted && booking.status !== 'checked_in' && !force) {
      return res.status(400).json({
        message: booking.status === 'confirmed'
          ? 'El trabajador aún no ha hecho check-in. Pide que ingrese el código antes de completar el turno.'
          : `No puedes completar un booking en estado ${booking.status}`,
        code: 'CHECKIN_REQUIRED',
        currentStatus: booking.status,
      });
    }
    if (booking.status === 'completed' && !isStuckCompleted) {
      return res.status(400).json({ message: 'Ya completado' });
    }
    if (isStuckCompleted) {
      logger.warn('Reprocessing stuck completed booking', { bookingId: String(booking._id) });
    }
    if (force && booking.status !== 'checked_in' && !isStuckCompleted) {
      logger.warn('Force-completing booking without check-in', {
        bookingId: String(booking._id),
        businessId: String(businessId),
        adminId: String(req.user?.id || ''),
        originalStatus: booking.status,
      });
    }

    // 1) Liberar el dinero PRIMERO (si falla, no marcamos completed para que
    // el negocio pueda reintentar). El ledger maneja el modo legacy si no hay escrow.
    const release = await crewLedger.releaseBookingFunds({
      bookingId: booking._id,
      performedBy: { kind: 'admin', id: req.user.id },
    });

    // 2) Marcar completed (idempotente: si ya estaba, no afecta)
    if (booking.status !== 'completed') {
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.confirmedByBusinessAt = new Date();
    }

    // 3) Awards — XP + stats + badges. Solo si el booking no había sido procesado antes
    // (xpAwarded > 0 indica que ya pasó por aquí). Evita doble-XP en reintentos.
    let xpGained = 0;
    let leveledUp = false;
    if (!booking.xpAwarded || booking.xpAwarded === 0) {
      xpGained = Math.round(booking.agreedHours * 25);
      const result = await Worker.addXP(booking.workerId, xpGained);
      leveledUp = result.leveledUp;
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
      await worker.save();
    }

    await booking.save();

    res.json({
      success: true, booking,
      leveledUp,
      xpGained,
      payout: release.payout,
      commission: release.commission,
      legacy: release.legacy || false,
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

// GET /crew/workers/me/wallet — balance + historial (compat: la UI nueva usa
// `/wallet/transactions` que lee del ledger real).
//
// Para no mostrar "ingresos fantasma" cuando un booking quedó marcado como
// completed pero el release nunca terminó, solo incluimos bookings cuyo
// payoutStatus es `released` (i.e. el worker SÍ recibió la plata).
router.get('/workers/me/wallet', requireWorker, async (req, res) => {
  try {
    const w = req.worker;
    const completedBookings = await ShiftBooking.find({
      workerId: w._id,
      status: 'completed',
      payoutStatus: 'released',
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
      date: b.releasedAt || b.completedAt || b.updatedAt,
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

// POST /crew/bookings/:id/checkout — worker marca fin de turno
// IMPORTANTE: el worker NO marca `status: completed`. El status sigue siendo
// `checked_in` con `workerCheckoutAt` setteado. La autoridad de cerrar el booking
// (y liberar pago) es del negocio (POST /businesses/bookings/:id/complete).
// Si el negocio no confirma en 24h tras el checkout del worker, el cron
// `auto-release-stale-bookings` libera automáticamente — ningún worker
// queda sin pago por inacción del negocio.
router.post('/bookings/:id/checkout', requireWorker, async (req, res) => {
  try {
    const booking = await ShiftBooking.findOneAndUpdate(
      {
        _id: req.params.id,
        workerId: req.worker._id,
        status: 'checked_in',
        workerCheckoutAt: null,
      },
      { $set: { workerCheckoutAt: new Date() } },
      { new: true },
    );
    if (!booking) {
      const existing = await ShiftBooking.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ message: 'Booking no encontrado' });
      if (String(existing.workerId) !== String(req.worker._id)) {
        return res.status(403).json({ message: 'No es tu booking' });
      }
      if (existing.workerCheckoutAt) {
        return res.status(400).json({ message: 'Ya hiciste check-out de este turno' });
      }
      return res.status(400).json({
        message: 'Solo puedes hacer check-out de un turno activo (debes haber hecho check-in primero)',
        currentStatus: existing.status,
      });
    }
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
// El frontend puede mandar `Idempotency-Key` (recomendado) o `idempotencyKey`
// en body para que doble-clicks no creen dos retiros con el saldo bloqueado.
router.post('/workers/me/wallet/withdraw', requireWorker, async (req, res) => {
  try {
    const { amount, payoutMethod, idempotencyKey: bodyKey } = req.body || {};
    const headerKey = req.get('Idempotency-Key');
    const clientIdempotencyKey = headerKey || bodyKey || null;

    const result = await crewLedger.requestWithdrawal({
      workerId: req.worker._id,
      amount: Math.round(Number(amount)),
      payoutMethod,
      clientIdempotencyKey,
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

/* ─────────────────────────────────────────────
 *  CREW EMPLOYER — shifts y wallet (espejo de /businesses/*)
 *  Mismo modelo de negocio, mismo escrow, misma comisión.
 *  Auth: requireEmployer (status: approved).
 * ───────────────────────────────────────────── */

// POST /crew/employers/shifts — publicar shift (mismo flujo que /businesses/shifts)
router.post('/employers/shifts', requireEmployer, async (req, res) => {
  try {
    const employer = req.employer;
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

    const available = employer.crewWallet?.balance || 0;
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
      ownerType: 'crew_employer',
      employerId: employer._id,
      ownerDisplay: {
        name: employer.name,
        logo: employer.photo || null,
        coverImage: employer.coverImage || null,
        businessType: employer.kind === 'business' ? (employer.businessType || '') : 'individual',
        verified: !!employer.verifiedAt,
      },
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
        city: employer.address?.city || '',
        neighborhood: employer.address?.neighborhood || '',
        lat: employer.location?.lat || null,
        lng: employer.location?.lng || null,
        address: employer.address?.full || '',
      },
      expiresAt: (() => {
        const exp = new Date(date);
        if (startTime) {
          const [hh, mm] = String(startTime).split(':');
          if (!Number.isNaN(Number(hh))) exp.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
        }
        return exp;
      })(),
    });
    await shift.save();

    try {
      const result = await crewLedger.reserveShiftEscrow({
        shift, performedBy: { kind: 'crew_employer', id: employer._id },
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
    logger.error('crew employer post shift error', e);
    res.status(500).json({ message: e.message || 'Error al publicar shift' });
  }
});

// GET /crew/employers/shifts — mis shifts
router.get('/employers/shifts', requireEmployer, async (req, res) => {
  try {
    const { status } = req.query;
    const q = { employerId: req.employer._id, ownerType: 'crew_employer' };
    if (status) q.status = status;
    const shifts = await ShiftPost.find(q).sort({ date: -1 }).limit(50).lean();
    res.json({ success: true, shifts });
  } catch (e) {
    logger.error('crew employer shifts list error', e);
    res.status(500).json({ message: 'Error al cargar shifts' });
  }
});

// GET /crew/employers/shifts/:id/applicants
router.get('/employers/shifts/:id/applicants', requireEmployer, async (req, res) => {
  try {
    const shift = await ShiftPost.findOne({
      _id: req.params.id, employerId: req.employer._id,
    });
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });
    const applications = await ShiftApplication.find({ shiftId: shift._id })
      .sort({ matchScore: -1, appliedAt: 1 })
      .populate('workerId', 'name photo level xp rating stats badgesEarned skills languages university bio kyc.status acceptsSOS')
      .lean();
    res.json({ success: true, applications });
  } catch (e) {
    logger.error('crew employer applicants error', e);
    res.status(500).json({ message: 'Error al cargar postulantes' });
  }
});

// GET /crew/employers/shifts/:id/bookings — bookings con checkInCode visible
router.get('/employers/shifts/:id/bookings', requireEmployer, async (req, res) => {
  try {
    const shift = await ShiftPost.findOne({ _id: req.params.id, employerId: req.employer._id });
    if (!shift) return res.status(404).json({ message: 'Shift no encontrado' });
    const bookings = await ShiftBooking.find({ shiftId: shift._id })
      .populate('workerId', 'name photo phone level rating')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, bookings });
  } catch (e) {
    logger.error('crew employer bookings list error', e);
    res.status(500).json({ message: 'Error al cargar bookings' });
  }
});

// POST /crew/employers/applications/:id/accept
router.post('/employers/applications/:id/accept', requireEmployer, async (req, res) => {
  try {
    const app = await ShiftApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application no encontrada' });
    const shift = await ShiftPost.findById(app.shiftId);
    if (!shift || String(shift.employerId) !== String(req.employer._id)) {
      return res.status(403).json({ message: 'No es tu shift' });
    }
    if (app.status !== 'pending') {
      return res.status(400).json({ message: `Application está ${app.status}` });
    }

    const start = new Date(shift.date);
    if (shift.startTime) {
      const [hh, mm] = String(shift.startTime).split(':');
      if (!Number.isNaN(Number(hh))) start.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    }
    if (start.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Este turno ya pasó.', code: 'SHIFT_PAST_DATE' });
    }

    const claimedShift = await ShiftPost.findOneAndUpdate(
      {
        _id: app.shiftId,
        status: { $in: ['open', 'partially_filled'] },
        $expr: { $lt: ['$workersBooked', '$workersNeeded'] },
      },
      { $inc: { workersBooked: 1 } },
      { new: true },
    );
    if (!claimedShift) {
      return res.status(409).json({ message: 'Este turno ya está lleno.', code: 'SHIFT_FULL_OR_CLOSED' });
    }
    if (claimedShift.workersBooked >= claimedShift.workersNeeded && claimedShift.status !== 'filled') {
      claimedShift.status = 'filled';
      await claimedShift.save();
    } else if (claimedShift.status === 'open' && claimedShift.workersBooked > 0) {
      claimedShift.status = 'partially_filled';
      await claimedShift.save();
    }

    const checkInCode = generateCheckInCode();
    let booking;
    try {
      booking = await ShiftBooking.create({
        shiftId: claimedShift._id, workerId: app.workerId,
        ownerType: 'crew_employer',
        employerId: claimedShift.employerId,
        agreedRate: claimedShift.hourlyRate, agreedHours: claimedShift.hoursTotal,
        agreedTotal: claimedShift.totalPay,
        agreedCommission: claimedShift.commissionAmount,
        payoutStatus: 'held',
        status: 'confirmed',
        checkInCode,
      });
    } catch (bookingErr) {
      await ShiftPost.findByIdAndUpdate(claimedShift._id, { $inc: { workersBooked: -1 } });
      throw bookingErr;
    }

    app.status = 'accepted';
    app.respondedAt = new Date();
    await app.save();

    let expiredApps = 0;
    if (claimedShift.status === 'filled') {
      const r = await ShiftApplication.updateMany(
        { shiftId: claimedShift._id, status: 'pending', _id: { $ne: app._id } },
        { $set: { status: 'expired', respondedAt: new Date() } },
      );
      expiredApps = r.modifiedCount || 0;
    }

    res.json({ success: true, booking, shiftStatus: claimedShift.status, expiredApps });
  } catch (e) {
    logger.error('crew employer accept error', e);
    res.status(500).json({ message: e.message || 'Error al aceptar' });
  }
});

// POST /crew/employers/applications/:id/reject
router.post('/employers/applications/:id/reject', requireEmployer, async (req, res) => {
  try {
    const app = await ShiftApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application no encontrada' });
    const shift = await ShiftPost.findById(app.shiftId).select('employerId');
    if (!shift || String(shift.employerId) !== String(req.employer._id)) {
      return res.status(403).json({ message: 'No es tu shift' });
    }
    app.status = 'rejected';
    app.respondedAt = new Date();
    await app.save();
    res.json({ success: true });
  } catch (e) {
    logger.error('crew employer reject error', e);
    res.status(500).json({ message: 'Error al rechazar' });
  }
});

// POST /crew/employers/bookings/:id/complete
router.post('/employers/bookings/:id/complete', requireEmployer, async (req, res) => {
  try {
    const force = !!req.body?.force;
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.employerId) !== String(req.employer._id)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    const isStuckCompleted = booking.status === 'completed' && booking.payoutStatus !== 'released';
    if (!isStuckCompleted && booking.status !== 'checked_in' && !force) {
      return res.status(400).json({
        message: booking.status === 'confirmed'
          ? 'El trabajador aún no ha hecho check-in. Pide que ingrese el código antes de completar el turno.'
          : `No puedes completar un booking en estado ${booking.status}`,
        code: 'CHECKIN_REQUIRED',
        currentStatus: booking.status,
      });
    }
    if (booking.status === 'completed' && !isStuckCompleted) {
      return res.status(400).json({ message: 'Ya completado' });
    }

    const release = await crewLedger.releaseBookingFunds({
      bookingId: booking._id,
      performedBy: { kind: 'crew_employer', id: req.employer._id },
    });

    if (booking.status !== 'completed') {
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.confirmedByBusinessAt = new Date(); // mismo campo de "negocio confirmó"
    }

    let xpGained = 0;
    let leveledUp = false;
    if (!booking.xpAwarded || booking.xpAwarded === 0) {
      xpGained = Math.round(booking.agreedHours * 25);
      const result = await Worker.addXP(booking.workerId, xpGained);
      leveledUp = result.leveledUp;
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
      await worker.save();
    }
    await booking.save();

    res.json({
      success: true, booking, leveledUp, xpGained,
      payout: release.payout, commission: release.commission,
      legacy: release.legacy || false,
    });
  } catch (e) {
    logger.error('crew employer complete booking error', e);
    res.status(500).json({ message: e.message || 'Error al completar booking' });
  }
});

// POST /crew/employers/bookings/:id/regenerate-checkin-code
router.post('/employers/bookings/:id/regenerate-checkin-code', requireEmployer, async (req, res) => {
  try {
    const booking = await ShiftBooking.findById(req.params.id);
    if (!booking || String(booking.employerId) !== String(req.employer._id)) {
      return res.status(404).json({ message: 'Booking no encontrado' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Solo turnos confirmados pueden regenerar código' });
    }
    booking.checkInCode = generateCheckInCode();
    booking.checkInAttempts = 0;
    await booking.save();
    res.json({ success: true, checkInCode: booking.checkInCode });
  } catch (e) {
    logger.error('crew employer regenerate code error', e);
    res.status(500).json({ message: 'Error al regenerar' });
  }
});

// POST /crew/employers/shifts/:id/cancel
router.post('/employers/shifts/:id/cancel', requireEmployer, async (req, res) => {
  try {
    const shift = await ShiftPost.findById(req.params.id);
    if (!shift || String(shift.employerId) !== String(req.employer._id)) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }
    const result = await crewLedger.cancelShiftPost({
      shiftId: shift._id,
      reason: req.body?.reason,
      performedBy: { kind: 'crew_employer', id: req.employer._id },
    });
    res.json({ success: true, ...result });
  } catch (e) {
    if (e.code === 'INVALID_STATE') return res.status(400).json({ message: e.message });
    logger.error('crew employer cancel shift error', e);
    res.status(500).json({ message: e.message || 'Error al cancelar' });
  }
});

/* ─────────────────────────────────────────────
 *  CREW EMPLOYER — wallet
 * ───────────────────────────────────────────── */

// GET /crew/employers/wallet
router.get('/employers/wallet', requireEmployerAny, async (req, res) => {
  res.json({
    success: true,
    wallet: req.employer.crewWallet || {
      balance: 0, pendingBalance: 0, totalReserved: 0, totalSpent: 0, totalCommissionPaid: 0, currency: 'COP',
    },
    employer: { name: req.employer.name, status: req.employer.status, kind: req.employer.kind },
    rates: {
      standardCommission: crewLedger.STANDARD_COMMISSION,
      sosCommission: crewLedger.SOS_COMMISSION,
      minRecharge: crewLedger.MIN_RECHARGE,
    },
  });
});

// POST /crew/employers/wallet/quote-shift
router.post('/employers/wallet/quote-shift', requireEmployer, async (req, res) => {
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

// POST /crew/employers/wallet/recharge-requests — subir comprobante a Llave Breve/Nequi
router.post(
  '/employers/wallet/recharge-requests',
  requireEmployer,
  memUpload.single('proof'),
  async (req, res) => {
    try {
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

      const upload = await uploadImage(req.file.buffer, `crew/recharges/employer-${req.employer._id}`, {
        maxWidth: 1600, quality: 88,
      });

      const request = await CrewRechargeRequest.create({
        ownerType: 'crew_employer',
        employerId: req.employer._id,
        amount: Math.round(amt),
        paymentMethod,
        proofUrl: upload.url,
        notes: (req.body.notes || '').slice(0, 200),
      });

      const io = req.app.get('io');
      if (io) io.to('superadmin-channel').emit('crew-recharge-pending', { request });

      res.status(201).json({ success: true, request });
    } catch (e) {
      logger.error('crew employer recharge request error', e);
      res.status(500).json({ message: e.message || 'Error al crear solicitud' });
    }
  }
);

// GET /crew/employers/wallet/recharge-requests
router.get('/employers/wallet/recharge-requests', requireEmployerAny, async (req, res) => {
  const requests = await CrewRechargeRequest.find({ employerId: req.employer._id })
    .sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, requests });
});

// GET /crew/employers/wallet/transactions
router.get('/employers/wallet/transactions', requireEmployerAny, async (req, res) => {
  const { limit = 50, kind } = req.query;
  const q = { actorType: 'crew_employer', actorId: req.employer._id };
  if (kind) q.kind = kind;
  const txns = await CrewWalletTxn.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit), 200))
    .populate('shiftId', 'title date')
    .lean();
  res.json({ success: true, transactions: txns });
});

/* ═════════════════════════════════════════════════════════════════════════
 *  VACANTES — feature paralela a turnos
 *  Fee fijo $10.000 COP por publicar. Postulaciones ilimitadas.
 *  Coexisten con turnos en el feed del worker.
 *  Polimórfico: business MenuBy y crew_employer pueden publicar.
 * ═════════════════════════════════════════════════════════════════════════ */

// Snapshot del owner para denormalizar en la vacante (igual que en shifts)
async function buildOwnerSnapshot(ownerType, ownerId) {
  if (ownerType === 'business') {
    const b = await BusinessConfig.findById(ownerId).select('businessName logo coverImage businessType address').lean();
    if (!b) throw new Error('Negocio no encontrado');
    return {
      ownerDisplay: {
        name: b.businessName || '',
        logo: b.logo || null,
        coverImage: b.coverImage || null,
        businessType: b.businessType || '',
        verified: true,
      },
      location: {
        city: b.address?.city || '',
        neighborhood: b.address?.neighborhood || '',
        address: b.address?.full || '',
      },
    };
  }
  const e = await CrewEmployer.findById(ownerId).select('name photo coverImage businessType kind address location verifiedAt').lean();
  if (!e) throw new Error('Empleador no encontrado');
  return {
    ownerDisplay: {
      name: e.name,
      logo: e.photo || null,
      coverImage: e.coverImage || null,
      businessType: e.kind === 'business' ? (e.businessType || '') : 'individual',
      verified: !!e.verifiedAt,
    },
    location: {
      city: e.address?.city || '',
      neighborhood: e.address?.neighborhood || '',
      address: e.address?.full || '',
      lat: e.location?.lat || null,
      lng: e.location?.lng || null,
    },
  };
}

// Crea la vacante + cobra el fee. Maneja insufficient funds. Si el cobro falla,
// borra la vacante para no dejarla huérfana.
async function createAndChargeVacancy({ ownerType, ownerId, postedById, body }) {
  const {
    title, role, description, responsibilities, benefits,
    requirements, schedule, hoursPerWeek, salary, location: locOverride,
    customQuestions, requireCv, applicationDeadline, expiresAt,
  } = body || {};

  if (!title?.trim()) { const e = new Error('Título es requerido'); e.code = 'BAD_INPUT'; throw e; }
  if (!VALID_SKILLS.includes(role)) { const e = new Error('Rol inválido'); e.code = 'BAD_INPUT'; throw e; }

  const snap = await buildOwnerSnapshot(ownerType, ownerId);

  // Default: expira en 30 días
  const finalExpiresAt = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const vacancy = await Vacancy.create({
    ownerType,
    businessId: ownerType === 'business' ? ownerId : null,
    employerId: ownerType === 'crew_employer' ? ownerId : null,
    postedBy: postedById || null,
    ownerDisplay: snap.ownerDisplay,
    title: title.trim(),
    role,
    description: (description || '').slice(0, 4000),
    responsibilities: Array.isArray(responsibilities) ? responsibilities.slice(0, 20) : [],
    benefits: Array.isArray(benefits) ? benefits.slice(0, 15) : [],
    requirements: requirements || {},
    schedule: schedule || 'full_time',
    hoursPerWeek: hoursPerWeek || null,
    salary: salary || {},
    location: { ...snap.location, ...(locOverride || {}) },
    customQuestions: Array.isArray(customQuestions) ? customQuestions.slice(0, 15) : [],
    requireCv: !!requireCv,
    applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
    expiresAt: finalExpiresAt,
    status: 'draft', // arranca en draft, se publica con el cobro
  });

  // Cobrar fee al publicar
  try {
    const charge = await crewLedger.chargeVacancyFee({
      ownerType, ownerId,
      vacancyId: vacancy._id,
      performedBy: { kind: ownerType === 'business' ? 'admin' : 'crew_employer', id: postedById || ownerId },
    });

    vacancy.status = 'published';
    vacancy.publishedAt = new Date();
    vacancy.pricePaid = charge.charged;
    vacancy.paymentTxnId = charge.txn._id;
    await vacancy.save();

    return { vacancy, charge };
  } catch (chargeErr) {
    await Vacancy.deleteOne({ _id: vacancy._id }).catch(() => {});
    throw chargeErr;
  }
}

/* ─────────── WORKER ─────────── */

// GET /crew/vacancies/feed — descubrimiento
router.get('/vacancies/feed', requireWorker, async (req, res) => {
  try {
    const { city, role, schedule, isRemote, limit = 30 } = req.query;
    const q = { status: 'published', expiresAt: { $gt: new Date() } };
    if (city) q['location.city'] = city;
    if (role) q.role = role;
    if (schedule) q.schedule = schedule;
    if (isRemote === 'true') q['location.isRemote'] = true;

    // Excluir vacantes a las que ya aplicó
    const appliedIds = await VacancyApplication.find({ workerId: req.worker._id }).distinct('vacancyId');
    if (appliedIds.length) q._id = { $nin: appliedIds };

    const vacancies = await Vacancy.find(q)
      .sort({ featured: -1, publishedAt: -1 })
      .limit(Math.min(Number(limit), 60))
      .select('title role ownerDisplay location salary schedule benefits applicationCount publishedAt expiresAt requireCv')
      .lean();

    res.json({ success: true, vacancies });
  } catch (e) {
    logger.error('crew vacancy feed error', e);
    res.status(500).json({ message: e.message || 'Error al cargar vacantes' });
  }
});

// GET /crew/vacancies/:id — detalle (incluye customQuestions para el form)
router.get('/vacancies/:id', requireWorker, async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id).lean();
    if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });
    if (vacancy.status !== 'published') {
      return res.status(403).json({ message: 'Esta vacante ya no está disponible' });
    }
    // Incrementar viewCount best-effort
    Vacancy.updateOne({ _id: vacancy._id }, { $inc: { viewCount: 1 } }).catch(() => {});

    // Si ya aplicó, indicarlo (para que UI muestre el estado en vez de "postularme")
    const myApp = await VacancyApplication.findOne({
      vacancyId: vacancy._id, workerId: req.worker._id,
    }).select('status appliedAt').lean();

    res.json({ success: true, vacancy, myApplication: myApp });
  } catch (e) {
    logger.error('crew vacancy detail error', e);
    res.status(500).json({ message: e.message || 'Error' });
  }
});

// POST /crew/vacancies/:id/apply
router.post('/vacancies/:id/apply', requireWorker, async (req, res) => {
  try {
    const { coverLetter, answers, cvUrl } = req.body || {};
    const vacancy = await Vacancy.findById(req.params.id);
    if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });
    if (vacancy.status !== 'published') {
      return res.status(400).json({ message: 'Esta vacante ya no recibe postulaciones' });
    }
    if (vacancy.expiresAt && vacancy.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Esta vacante expiró' });
    }
    if (vacancy.requireCv && !cvUrl) {
      return res.status(400).json({ message: 'Esta vacante requiere subir tu hoja de vida (PDF)' });
    }

    // Validar respuestas: las preguntas required deben venir contestadas
    const answersMap = new Map();
    if (Array.isArray(answers)) {
      for (const a of answers) {
        if (a?.questionId && a?.value != null) answersMap.set(String(a.questionId), a.value);
      }
    }
    const snapshotAnswers = [];
    for (const q of vacancy.customQuestions || []) {
      const v = answersMap.get(String(q._id));
      if (q.required && (v == null || v === '' || (Array.isArray(v) && v.length === 0))) {
        return res.status(400).json({
          message: `Falta responder: "${q.question}"`,
          questionId: String(q._id),
        });
      }
      if (v != null) {
        snapshotAnswers.push({ questionId: q._id, question: q.question, value: v });
      }
    }

    try {
      const app = await VacancyApplication.create({
        vacancyId: vacancy._id,
        workerId: req.worker._id,
        ownerType: vacancy.ownerType,
        businessId: vacancy.businessId || null,
        employerId: vacancy.employerId || null,
        coverLetter: (coverLetter || '').slice(0, 2000),
        answers: snapshotAnswers,
        cvUrl: cvUrl || null,
      });

      // Increment counter denormalizado
      await Vacancy.updateOne({ _id: vacancy._id }, { $inc: { applicationCount: 1 } });

      res.status(201).json({ success: true, application: app });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        return res.status(409).json({ message: 'Ya te postulaste a esta vacante' });
      }
      throw dupErr;
    }
  } catch (e) {
    logger.error('crew vacancy apply error', e);
    res.status(500).json({ message: e.message || 'Error al postular' });
  }
});

// GET /crew/workers/me/vacancy-applications
router.get('/workers/me/vacancy-applications', requireWorker, async (req, res) => {
  const apps = await VacancyApplication.find({ workerId: req.worker._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'vacancyId', select: 'title role ownerDisplay location salary status' })
    .lean();
  res.json({ success: true, applications: apps });
});

// POST /crew/workers/me/vacancy-applications/:id/withdraw
router.post('/workers/me/vacancy-applications/:id/withdraw', requireWorker, async (req, res) => {
  const app = await VacancyApplication.findOne({ _id: req.params.id, workerId: req.worker._id });
  if (!app) return res.status(404).json({ message: 'Postulación no encontrada' });
  if (!['pending', 'shortlisted', 'interviewing'].includes(app.status)) {
    return res.status(400).json({ message: `No se puede retirar desde estado ${app.status}` });
  }
  app.status = 'withdrawn';
  app.withdrawnAt = new Date();
  await app.save();
  res.json({ success: true });
});

/* ─────────── OWNER (business + employer) ─────────── */

// Helper polimórfico: handler genérico para list / detail / lifecycle / applicants
async function listOwnerVacancies(ownerType, ownerId, status) {
  const q = ownerType === 'business' ? { businessId: ownerId } : { employerId: ownerId };
  if (status) q.status = status;
  return Vacancy.find(q).sort({ createdAt: -1 }).limit(60).lean();
}

async function getOwnerVacancy(vacancyId, ownerType, ownerId) {
  const v = await Vacancy.findById(vacancyId);
  if (!v) return null;
  const ownerIdField = ownerType === 'business' ? v.businessId : v.employerId;
  if (String(ownerIdField) !== String(ownerId)) return null;
  return v;
}

// ── Business: publish vacancy ──
router.post('/businesses/vacancies', tenantAuth, async (req, res) => {
  try {
    const businessId = req.resolvedBusinessId || req.user?.businessId;
    if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
    const result = await createAndChargeVacancy({
      ownerType: 'business',
      ownerId: businessId,
      postedById: req.user?.id,
      body: req.body,
    });
    res.status(201).json({ success: true, vacancy: result.vacancy, charged: result.charge.charged });
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') {
      return res.status(402).json({
        message: e.message, code: 'INSUFFICIENT_FUNDS',
        required: e.required, available: e.available,
      });
    }
    if (e.code === 'BAD_INPUT') return res.status(400).json({ message: e.message });
    logger.error('crew biz post vacancy error', e);
    res.status(500).json({ message: e.message || 'Error al publicar vacante' });
  }
});

// ── Employer: publish vacancy ──
router.post('/employers/vacancies', requireEmployer, async (req, res) => {
  try {
    const result = await createAndChargeVacancy({
      ownerType: 'crew_employer',
      ownerId: req.employer._id,
      postedById: req.employer._id,
      body: req.body,
    });
    res.status(201).json({ success: true, vacancy: result.vacancy, charged: result.charge.charged });
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') {
      return res.status(402).json({
        message: e.message, code: 'INSUFFICIENT_FUNDS',
        required: e.required, available: e.available,
      });
    }
    if (e.code === 'BAD_INPUT') return res.status(400).json({ message: e.message });
    logger.error('crew employer post vacancy error', e);
    res.status(500).json({ message: e.message || 'Error al publicar vacante' });
  }
});

// ── List mine ──
router.get('/businesses/vacancies', tenantAuth, async (req, res) => {
  const businessId = req.resolvedBusinessId || req.user?.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId requerido' });
  const vacancies = await listOwnerVacancies('business', businessId, req.query.status);
  res.json({ success: true, vacancies });
});

router.get('/employers/vacancies', requireEmployer, async (req, res) => {
  const vacancies = await listOwnerVacancies('crew_employer', req.employer._id, req.query.status);
  res.json({ success: true, vacancies });
});

// ── Vacancy detail (owner side, con applications inline) ──
async function vacancyDetailHandler(ownerType, ownerId, vacancyId, res) {
  const vacancy = await getOwnerVacancy(vacancyId, ownerType, ownerId);
  if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });
  const applicationCounts = await VacancyApplication.aggregate([
    { $match: { vacancyId: vacancy._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const counts = applicationCounts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
  res.json({ success: true, vacancy, applicationCounts: counts });
}

router.get('/businesses/vacancies/:id', tenantAuth, (req, res) =>
  vacancyDetailHandler('business', req.resolvedBusinessId || req.user?.businessId, req.params.id, res));
router.get('/employers/vacancies/:id', requireEmployer, (req, res) =>
  vacancyDetailHandler('crew_employer', req.employer._id, req.params.id, res));

// ── List applications ──
async function listApplicationsHandler(ownerType, ownerId, vacancyId, query, res) {
  const vacancy = await getOwnerVacancy(vacancyId, ownerType, ownerId);
  if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });
  const q = { vacancyId: vacancy._id };
  if (query.status) q.status = query.status;
  const apps = await VacancyApplication.find(q)
    .sort({ matchScore: -1, appliedAt: 1 })
    .populate('workerId', 'name photo phone email level xp rating stats badgesEarned skills languages university bio kyc.status experiences education')
    .lean();
  res.json({ success: true, applications: apps });
}

router.get('/businesses/vacancies/:id/applications', tenantAuth, (req, res) =>
  listApplicationsHandler('business', req.resolvedBusinessId || req.user?.businessId, req.params.id, req.query, res));
router.get('/employers/vacancies/:id/applications', requireEmployer, (req, res) =>
  listApplicationsHandler('crew_employer', req.employer._id, req.params.id, req.query, res));

// ── Decide on application (shortlist / reject / hire / interviewing) ──
const VALID_DECISIONS = ['shortlisted', 'interviewing', 'rejected', 'hired'];
async function decideApplicationHandler(ownerType, ownerId, applicationId, action, note, res) {
  if (!VALID_DECISIONS.includes(action)) {
    return res.status(400).json({ message: 'Acción inválida', valid: VALID_DECISIONS });
  }
  const app = await VacancyApplication.findById(applicationId);
  if (!app) return res.status(404).json({ message: 'Postulación no encontrada' });
  const ownerIdField = ownerType === 'business' ? app.businessId : app.employerId;
  if (String(ownerIdField) !== String(ownerId)) {
    return res.status(403).json({ message: 'No es tu vacante' });
  }
  app.status = action;
  app.respondedAt = new Date();
  if (note) app.internalNote = String(note).slice(0, 500);
  await app.save();
  res.json({ success: true, application: app });
}

router.post('/businesses/vacancy-applications/:id/:action', tenantAuth, (req, res) =>
  decideApplicationHandler('business', req.resolvedBusinessId || req.user?.businessId, req.params.id, req.params.action, req.body?.note, res));
router.post('/employers/vacancy-applications/:id/:action', requireEmployer, (req, res) =>
  decideApplicationHandler('crew_employer', req.employer._id, req.params.id, req.params.action, req.body?.note, res));

// ── Lifecycle: pause / resume / close ──
const LIFECYCLE_MAP = { pause: 'paused', resume: 'published', close: 'closed' };
async function lifecycleHandler(ownerType, ownerId, vacancyId, action, res) {
  const targetStatus = LIFECYCLE_MAP[action];
  if (!targetStatus) return res.status(400).json({ message: 'Acción inválida' });
  const vacancy = await getOwnerVacancy(vacancyId, ownerType, ownerId);
  if (!vacancy) return res.status(404).json({ message: 'Vacante no encontrada' });

  if (action === 'resume' && vacancy.status !== 'paused') {
    return res.status(400).json({ message: 'Solo se pueden reactivar vacantes pausadas' });
  }
  if (action === 'pause' && vacancy.status !== 'published') {
    return res.status(400).json({ message: 'Solo se pueden pausar vacantes publicadas' });
  }
  if (action === 'close' && vacancy.status === 'closed') {
    return res.status(400).json({ message: 'Ya está cerrada' });
  }

  vacancy.status = targetStatus;
  if (action === 'close') vacancy.closedAt = new Date();
  await vacancy.save();
  res.json({ success: true, vacancy });
}

router.post('/businesses/vacancies/:id/:action', tenantAuth, (req, res) =>
  lifecycleHandler('business', req.resolvedBusinessId || req.user?.businessId, req.params.id, req.params.action, res));
router.post('/employers/vacancies/:id/:action', requireEmployer, (req, res) =>
  lifecycleHandler('crew_employer', req.employer._id, req.params.id, req.params.action, res));

// ── Quote: cuánto cuesta publicar (para preview en UI) ──
router.get('/vacancies/quote', (req, res) => {
  res.json({ success: true, fee: crewLedger.VACANCY_POST_FEE });
});

module.exports = router;
