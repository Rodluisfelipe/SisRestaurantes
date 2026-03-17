const express = require('express');
const router = express.Router();
const Announcement = require('../Models/Announcement');
const BusinessConfig = require('../Models/BusinessConfig');
const authMiddleware = require('../middleware/authMiddleware');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const sanitizeUpload = require('../middleware/sanitizeUpload');

// ═══════════════════════════════════════════════════
// Configuración de multer para imágenes de anuncios
// ═══════════════════════════════════════════════════
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/announcements');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'announcement-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

// ═══════════════════════════════════════════════════
// RUTAS SUPERADMIN — CRUD de anuncios
// ═══════════════════════════════════════════════════

// POST /api/announcements — Crear anuncio (SuperAdmin)
router.post('/', protectSuperAdmin, upload.single('image'), sanitizeUpload({ maxWidth: 1200 }), async (req, res) => {
  try {
    const { title, body, priority } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    
    const announcementData = {
      title: title.trim(),
      body: body.trim(),
      priority: priority || 'medium',
      createdBy: req.user.id,
      isActive: true
    };
    
    if (req.file) {
      announcementData.image = `/uploads/announcements/${req.file.filename}`;
    }
    
    const announcement = new Announcement(announcementData);
    await announcement.save();
    
    logger.info(`Anuncio creado: "${title}" por SuperAdmin ${req.user.id}`);
    
    res.status(201).json({
      message: 'Anuncio creado exitosamente',
      announcement
    });
  } catch (error) {
    logger.error('Error al crear anuncio', error);
    res.status(500).json({ message: 'Error al crear anuncio' });
  }
});

// GET /api/announcements — Listar todos los anuncios con estadísticas (SuperAdmin)
router.get('/', protectSuperAdmin, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean();
    
    // Obtener total de negocios activos para calcular porcentaje de lectura
    const totalBusinesses = await BusinessConfig.countDocuments({ isActive: true });
    
    const announcementsWithStats = announcements.map(a => ({
      ...a,
      seenCount: a.seenBy ? a.seenBy.length : 0,
      totalBusinesses,
      seenPercentage: totalBusinesses > 0 
        ? Math.round(((a.seenBy ? a.seenBy.length : 0) / totalBusinesses) * 100) 
        : 0
    }));
    
    res.json(announcementsWithStats);
  } catch (error) {
    logger.error('Error al obtener anuncios', error);
    res.status(500).json({ message: 'Error al obtener anuncios' });
  }
});

// ═══════════════════════════════════════════════════
// RUTAS NEGOCIO — Ver anuncios pendientes y marcar como leído
// (IMPORTANTE: Estas rutas van ANTES de /:id para evitar conflicto)
// ═══════════════════════════════════════════════════

// GET /api/announcements/pending/me — Obtener anuncios no leídos para el negocio actual
router.get('/pending/me', authMiddleware, async (req, res) => {
  try {
    // Solo para dueños de negocio, no superadmins
    if (req.user.role === 'superadmin') {
      return res.json([]);
    }
    
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.json([]);
    }
    
    // Buscar anuncios activos que este negocio NO ha visto
    const announcements = await Announcement.find({
      isActive: true,
      'seenBy.businessId': { $ne: businessId }
    })
    .sort({ priority: -1, createdAt: -1 })
    .select('title body image priority createdAt')
    .lean();
    
    res.json(announcements);
  } catch (error) {
    logger.error('Error al obtener anuncios pendientes', error);
    res.status(500).json({ message: 'Error al obtener anuncios pendientes' });
  }
});

// POST /api/announcements/:id/seen — Marcar anuncio como leído
router.post('/:id/seen', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.json({ message: 'SuperAdmin no necesita marcar lectura' });
    }
    
    const businessId = req.user.businessId;
    const adminId = req.user.id;
    
    if (!businessId) {
      return res.status(400).json({ message: 'No se encontró businessId' });
    }
    
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Anuncio no encontrado' });
    }
    
    // Verificar si ya lo vio
    const alreadySeen = announcement.seenBy.some(
      s => s.businessId.toString() === businessId.toString()
    );
    
    if (alreadySeen) {
      return res.json({ message: 'Ya marcado como leído' });
    }
    
    announcement.seenBy.push({
      businessId,
      adminId,
      seenAt: new Date()
    });
    
    await announcement.save();
    
    logger.info(`Anuncio "${announcement.title}" marcado como leído por negocio ${businessId}`);
    
    res.json({ message: 'Anuncio marcado como leído' });
  } catch (error) {
    logger.error('Error al marcar anuncio como leído', error);
    res.status(500).json({ message: 'Error al marcar lectura' });
  }
});

// ═══════════════════════════════════════════════════
// RUTAS SUPERADMIN — Detalle, actualizar, eliminar (con :id param)
// ═══════════════════════════════════════════════════

// GET /api/announcements/:id — Detalle de un anuncio con lista de quién lo vio (SuperAdmin)
router.get('/:id', protectSuperAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('seenBy.businessId', 'restaurantName slug')
      .populate('seenBy.adminId', 'name email')
      .lean();
    
    if (!announcement) {
      return res.status(404).json({ message: 'Anuncio no encontrado' });
    }
    
    const totalBusinesses = await BusinessConfig.countDocuments({ isActive: true });
    
    res.json({
      ...announcement,
      seenCount: announcement.seenBy ? announcement.seenBy.length : 0,
      totalBusinesses,
      seenPercentage: totalBusinesses > 0 
        ? Math.round(((announcement.seenBy ? announcement.seenBy.length : 0) / totalBusinesses) * 100) 
        : 0
    });
  } catch (error) {
    logger.error('Error al obtener detalle de anuncio', error);
    res.status(500).json({ message: 'Error al obtener anuncio' });
  }
});

// PUT /api/announcements/:id — Actualizar anuncio (SuperAdmin)
router.put('/:id', protectSuperAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, body, priority, isActive } = req.body;
    
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Anuncio no encontrado' });
    }
    
    if (title) announcement.title = title.trim();
    if (body) announcement.body = body.trim();
    if (priority) announcement.priority = priority;
    if (isActive !== undefined) announcement.isActive = isActive === 'true' || isActive === true;
    
    if (req.file) {
      // Eliminar imagen anterior si existe
      if (announcement.image) {
        const oldPath = path.join(__dirname, '..', announcement.image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      announcement.image = `/uploads/announcements/${req.file.filename}`;
    }
    
    await announcement.save();
    
    logger.info(`Anuncio actualizado: "${announcement.title}" por SuperAdmin ${req.user.id}`);
    
    res.json({
      message: 'Anuncio actualizado exitosamente',
      announcement
    });
  } catch (error) {
    logger.error('Error al actualizar anuncio', error);
    res.status(500).json({ message: 'Error al actualizar anuncio' });
  }
});

// DELETE /api/announcements/:id — Eliminar anuncio (SuperAdmin)
router.delete('/:id', protectSuperAdmin, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Anuncio no encontrado' });
    }
    
    // Eliminar imagen si existe
    if (announcement.image) {
      const imagePath = path.join(__dirname, '..', announcement.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await Announcement.findByIdAndDelete(req.params.id);
    
    logger.info(`Anuncio eliminado: "${announcement.title}" por SuperAdmin ${req.user.id}`);
    
    res.json({ message: 'Anuncio eliminado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar anuncio', error);
    res.status(500).json({ message: 'Error al eliminar anuncio' });
  }
});

module.exports = router;
